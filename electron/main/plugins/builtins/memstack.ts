import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { authStore } from '../../auth-store'
import type { FeaturePluginRef, MainPlugin, PluginStatus } from '../types'

const execFileAsync = promisify(execFile)

function getMemstackStatus(config?: Record<string, any>): PluginStatus {
  const baseUrl = typeof config?.baseUrl === 'string' ? config.baseUrl.trim() : ''
  const storageRepoFullName = typeof config?.storageRepoFullName === 'string' ? config.storageRepoFullName.trim() : ''
  const writeMode = typeof config?.storageWriteMode === 'string' ? config.storageWriteMode.trim() : 'server'
  const localStorageRepoPath =
    typeof config?.localStorageRepoPath === 'string' ? config.localStorageRepoPath.trim() : ''

  if (!baseUrl) {
    return {
      state: 'not_configured',
      message: 'Add a service base URL to enable the Feature Memory integration.',
    }
  }

  return {
    state: 'ready',
    message:
      writeMode === 'desktop'
        ? localStorageRepoPath
          ? `Desktop Sync ready. Local repo: ${localStorageRepoPath}`
          : 'Desktop Sync selected. Save the setup to create the local Wiki repo.'
        : storageRepoFullName
          ? `Server Sync ready. Storage repo: ${storageRepoFullName}`
          : 'Server Sync selected. Choose a storage repo when you want Git-backed memory writes.',
  }
}

function requireBaseUrl(config?: Record<string, any>): string {
  const baseUrl = typeof config?.baseUrl === 'string' ? config.baseUrl.trim() : ''

  if (!baseUrl) {
    throw new Error('Configure the Feature Memory service base URL first.')
  }

  return baseUrl.replace(/\/$/, '')
}

function getActiveGitContext() {
  const auth = authStore.get()
  const active = (auth.accounts || []).find((account) => account.id === auth.activeAccountId)

  if (!active || !active.token) {
    throw new Error('No active Git account with a reusable token was found in Nexwork.')
  }

  return active
}

function buildStorageTarget(config?: Record<string, any>) {
  return {
    repository: typeof config?.storageRepoFullName === 'string' ? config.storageRepoFullName.trim() : '',
    branch:
      typeof config?.storageBranch === 'string' && config.storageBranch.trim() ? config.storageBranch.trim() : 'main',
    path: typeof config?.storagePath === 'string' && config.storagePath.trim() ? config.storagePath.trim() : 'Features',
    writeMode:
      typeof config?.storageWriteMode === 'string' && config.storageWriteMode.trim()
        ? config.storageWriteMode.trim()
        : 'server',
    localRepoPath:
      typeof config?.localStorageRepoPath === 'string' && config.localStorageRepoPath.trim()
        ? config.localStorageRepoPath.trim()
        : '',
  }
}

function isDesktopSync(config?: Record<string, any>) {
  return (typeof config?.storageWriteMode === 'string' ? config.storageWriteMode.trim() : 'server') === 'desktop'
}

function resolveDesktopSyncRepoPath(config?: Record<string, any>, workspaceRoot?: string) {
  const configuredPath = typeof config?.localStorageRepoPath === 'string' ? config.localStorageRepoPath.trim() : ''

  if (configuredPath) {
    return configuredPath
  }

  if (workspaceRoot?.trim()) {
    return join(workspaceRoot.trim(), 'Wiki')
  }

  return ''
}

function buildGitAccountPayload() {
  const active = getActiveGitContext()
  return {
    provider: active.provider,
    user: active.user,
    gitlabUrl: active.gitlabUrl || '',
    token: active.token || '',
  }
}

async function postMemstackSync(config: Record<string, any> | undefined, payload: any) {
  const baseUrl = requireBaseUrl(config)
  const apiKey = typeof config?.apiKey === 'string' ? config.apiKey.trim() : ''
  const gitAccount = (() => {
    try {
      return buildGitAccountPayload()
    } catch {
      return null
    }
  })()

  const response = await fetch(`${baseUrl}/api/feature-memories/sync-from-nexwork`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      ...payload,
      storageTarget: buildStorageTarget(config),
      gitAccount,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Feature Memory sync failed (${response.status})`)
  }

  return response.json()
}

async function prepareDesktopSyncFiles(config: Record<string, any> | undefined, payload: any) {
  const baseUrl = requireBaseUrl(config)
  const apiKey = typeof config?.apiKey === 'string' ? config.apiKey.trim() : ''
  const response = await fetch(`${baseUrl}/api/feature-memories/prepare-sync-files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      ...payload,
      storageTarget: buildStorageTarget(config),
      gitAccount: null,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Feature Memory file prep failed (${response.status})`)
  }

  return response.json()
}

async function runGit(repoPath: string, args: string[]) {
  return execFileAsync('git', ['-C', repoPath, ...args], { maxBuffer: 10 * 1024 * 1024 })
}

async function runGitAllowFailure(repoPath: string, args: string[]) {
  try {
    const result = await runGit(repoPath, args)
    return { success: true, stdout: result.stdout, stderr: result.stderr }
  } catch (error: any) {
    return {
      success: false,
      stdout: error?.stdout || '',
      stderr: error?.stderr || error?.message || '',
      code: error?.code,
    }
  }
}

async function ensureDesktopSyncBranch(repoPath: string, branch: string) {
  await runGitAllowFailure(repoPath, ['fetch', 'origin', '--prune'])

  const localBranch = await runGitAllowFailure(repoPath, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`])
  const remoteBranch = await runGitAllowFailure(repoPath, [
    'show-ref',
    '--verify',
    '--quiet',
    `refs/remotes/origin/${branch}`,
  ])

  if (localBranch.success) {
    const checkout = await runGitAllowFailure(repoPath, ['checkout', branch])
    if (!checkout.success) throw new Error(checkout.stderr || `Could not checkout ${branch}`)
  } else if (remoteBranch.success) {
    const checkout = await runGitAllowFailure(repoPath, ['checkout', '-b', branch, '--track', `origin/${branch}`])
    if (!checkout.success) throw new Error(checkout.stderr || `Could not checkout ${branch}`)
  } else {
    const checkout = await runGitAllowFailure(repoPath, ['checkout', '-b', branch])
    if (!checkout.success) throw new Error(checkout.stderr || `Could not create ${branch}`)
  }

  if (remoteBranch.success) {
    const pull = await runGitAllowFailure(repoPath, ['pull', '--ff-only', 'origin', branch])
    if (!pull.success) throw new Error(pull.stderr || `Could not pull ${branch}`)
  }
}

async function ensureDesktopSyncRepo(repoPath: string) {
  await fs.mkdir(repoPath, { recursive: true })

  if (!existsSync(join(repoPath, '.git'))) {
    await runGit(repoPath, ['init'])
  }

  const docsRoot = join(repoPath, 'Wiki')
  const featuresDir = join(docsRoot, 'Features')
  const topicsDir = join(docsRoot, 'Topics')
  await fs.mkdir(docsRoot, { recursive: true })
  await fs.mkdir(featuresDir, { recursive: true })
  await fs.mkdir(topicsDir, { recursive: true })

  const docsProjectContextPath = join(docsRoot, 'PROJECT_CONTEXT.md')

  if (!existsSync(docsProjectContextPath)) {
    await fs.writeFile(
      docsProjectContextPath,
      [
        '# MemStack Project Context',
        '',
        '## What Is MemStack',
        'MemStack is a knowledge backend for storing and structuring business feature memory.',
        '',
        '## Why MemStack Exists',
        'Teams need a durable record of:',
        '- what customers requested',
        '- what was implemented',
        '- how business logic currently works',
        '- how money-related logic is handled',
        '- how to answer customer questions later',
        '',
        '## Relationship With Nexwork',
        'Nexwork is the workflow tool.',
        'MemStack is the knowledge store.',
        'Nexwork sends requirement and implementation context to MemStack, and MemStack writes structured markdown plus searchable metadata.',
        '',
        '## Core Document Types',
        '- `Features/<year>/<feature-slug>/requirement.md`',
        '- `Features/<year>/<feature-slug>/implementation.md`',
        '- `Wiki/<topic>.md`',
        '',
        '## Why Markdown Is Used',
        'Markdown is readable by humans, easy to version in Git, and easy for AI retrieval when sectioned correctly.',
        '',
        '## Retrieval Guidance',
        'AI should prefer:',
        '1. metadata filters',
        '2. section-level retrieval',
        '3. small grounded answers with sources',
        '',
        '## Long-Term Goal',
        'MemStack should help answer future questions like:',
        '- what was requested?',
        '- what changed?',
        '- how does this business rule work now?',
        '- is this likely expected behavior or a bug?',
      ].join('\n'),
      'utf8',
    )
  }
}

async function detectDesktopDocsLayout(repoPath: string) {
  const issues: string[] = []

  if (!existsSync(repoPath) || !existsSync(join(repoPath, '.git'))) {
    return {
      hasOldLayout: false,
      issues,
      message: 'Docs repo is not ready yet.',
    }
  }

  if (existsSync(join(repoPath, 'PROJECT_CONTEXT.md'))) {
    issues.push('Root PROJECT_CONTEXT.md should move into Wiki/PROJECT_CONTEXT.md')
  }

  if (existsSync(join(repoPath, 'Features'))) {
    issues.push('Root Features/ should move into Wiki/Features/')
  }

  const legacyTopicFiles = ['coloris.md', 'core.api.md', 'hermes.md', 'monika.md', 'tycho.md'].filter((name) =>
    existsSync(join(repoPath, 'Wiki', name)),
  )
  if (legacyTopicFiles.length > 0) {
    issues.push(`Legacy topic files found in Wiki/: ${legacyTopicFiles.join(', ')}`)
  }

  if (existsSync(join(repoPath, 'Wiki', 'Wiki'))) {
    issues.push('Legacy Wiki/Wiki/ folder should move into Wiki/Topics/')
  }

  return {
    hasOldLayout: issues.length > 0,
    issues,
    message:
      issues.length > 0 ? 'Old docs layout detected.' : 'Docs layout already matches the current Wiki structure.',
  }
}

async function migrateDesktopDocsLayout(repoPath: string) {
  await ensureDesktopSyncRepo(repoPath)

  const moves: string[] = []
  const docsRoot = join(repoPath, 'Wiki')
  const featuresDir = join(docsRoot, 'Features')
  const topicsDir = join(docsRoot, 'Topics')

  const rootProjectContextPath = join(repoPath, 'PROJECT_CONTEXT.md')
  const docsProjectContextPath = join(docsRoot, 'PROJECT_CONTEXT.md')
  if (existsSync(rootProjectContextPath) && !existsSync(docsProjectContextPath)) {
    await fs.rename(rootProjectContextPath, docsProjectContextPath)
    moves.push('PROJECT_CONTEXT.md -> Wiki/PROJECT_CONTEXT.md')
  }

  const rootFeaturesDir = join(repoPath, 'Features')
  if (existsSync(rootFeaturesDir)) {
    const yearEntries = await fs.readdir(rootFeaturesDir, { withFileTypes: true }).catch(() => [])
    for (const entry of yearEntries) {
      const sourcePath = join(rootFeaturesDir, entry.name)
      const targetPath = join(featuresDir, entry.name)
      if (!existsSync(targetPath)) {
        await fs.rename(sourcePath, targetPath)
        moves.push(`Features/${entry.name} -> Wiki/Features/${entry.name}`)
      }
    }
  }

  const legacyWikiDir = join(docsRoot, 'Wiki')
  if (existsSync(legacyWikiDir)) {
    const legacyEntries = await fs.readdir(legacyWikiDir, { withFileTypes: true }).catch(() => [])
    for (const entry of legacyEntries) {
      const sourcePath = join(legacyWikiDir, entry.name)
      const targetPath = join(topicsDir, entry.name)
      if (!existsSync(targetPath)) {
        await fs.rename(sourcePath, targetPath)
        moves.push(`Wiki/Wiki/${entry.name} -> Wiki/Topics/${entry.name}`)
      }
    }
  }

  const docsRootEntries = await fs.readdir(docsRoot, { withFileTypes: true }).catch(() => [])
  for (const entry of docsRootEntries) {
    if (!entry.isFile()) continue
    if (entry.name === 'PROJECT_CONTEXT.md') continue
    if (!entry.name.toLowerCase().endsWith('.md')) continue

    const sourcePath = join(docsRoot, entry.name)
    const targetPath = join(topicsDir, entry.name)
    if (!existsSync(targetPath)) {
      await fs.rename(sourcePath, targetPath)
      moves.push(`Wiki/${entry.name} -> Wiki/Topics/${entry.name}`)
    }
  }

  return {
    moved: moves.length,
    moves,
    message:
      moves.length > 0 ? `Moved ${moves.length} item(s) into the new Wiki structure.` : 'No migration was needed.',
  }
}

async function writeDesktopSyncFiles(
  config: Record<string, any> | undefined,
  prepared: { files?: Array<{ path: string; content: string }>; commitMessage?: string },
  workspaceRoot?: string,
  branchOverride?: string,
) {
  const repoPath = resolveDesktopSyncRepoPath(config, workspaceRoot)
  if (!repoPath) {
    throw new Error('Save Desktop Sync setup first so Nexwork can create the local Wiki repo.')
  }

  await ensureDesktopSyncRepo(repoPath)

  const branch = branchOverride?.trim()
    ? branchOverride.trim()
    : typeof config?.storageBranch === 'string' && config.storageBranch.trim()
      ? config.storageBranch.trim()
      : 'main'

  await ensureDesktopSyncBranch(repoPath, branch)

  const files = Array.isArray(prepared.files) ? prepared.files : []
  if (files.length === 0) {
    return { changed: false, repoPath, branch, docsPath: join(repoPath, 'Wiki') }
  }

  const writtenPaths: string[] = []
  const docsPath = join(repoPath, 'Wiki')
  const resolvedDocsPath = resolve(docsPath)
  for (const file of files) {
    let relativePath = String(file.path || '').replace(/^\/+/, '')
    if (relativePath.startsWith('Wiki/')) {
      relativePath = relativePath.replace(/^Wiki\//, 'Topics/')
    }
    if (!relativePath) continue
    const fullPath = resolve(docsPath, relativePath)
    if (!fullPath.startsWith(`${resolvedDocsPath}/`) && fullPath !== resolvedDocsPath) {
      throw new Error(`Refusing to write outside the local repo: ${relativePath}`)
    }
    await fs.mkdir(dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, file.content || '', 'utf8')
    writtenPaths.push(relativePath)
  }

  if (writtenPaths.length === 0) {
    return { changed: false, repoPath, branch, docsPath }
  }

  const stagePaths = writtenPaths.map((relativePath) => join('Wiki', relativePath).split('\\').join('/'))

  await runGit(repoPath, ['add', '--', ...stagePaths])
  const staged = await runGitAllowFailure(repoPath, ['diff', '--cached', '--name-only', '--', ...stagePaths])
  if (!staged.stdout.trim()) {
    return { changed: false, repoPath, branch, docsPath }
  }

  await runGit(repoPath, [
    'commit',
    '-m',
    prepared.commitMessage || 'docs(memstack): sync feature memory',
    '--',
    ...stagePaths,
  ])

  return { changed: true, repoPath, branch, docsPath, committed: true }
}

function buildDesktopSyncMessage(result: any) {
  const repoPath = result?.desktopSync?.docsPath || result?.desktopSync?.repoPath
  const branch = result?.desktopSync?.branch

  if (!repoPath) {
    return undefined
  }

  return branch ? `Docs committed in ${repoPath} on branch ${branch}` : `Docs committed in ${repoPath}`
}

async function syncFeatureMemory(config: Record<string, any> | undefined, payload: any) {
  if (isDesktopSync(config)) {
    const prepared = await prepareDesktopSyncFiles(config, payload)
    const desktopSync = await writeDesktopSyncFiles(
      config,
      prepared,
      typeof payload?.workspaceRoot === 'string' ? payload.workspaceRoot : '',
      payload?.desktopSyncBranch,
    )
    return {
      ...prepared,
      desktopSync,
    }
  }

  return postMemstackSync(config, payload)
}

function isTrackedFeature(feature?: any) {
  return feature?.pluginRefs?.memstack?.tracked === true
}

function buildSyncPluginRef(
  payload: { feature?: any },
  eventName: 'feature.created' | 'feature.completed' | 'project.status.updated' | 'feature.scope.updated',
  options: {
    status: 'success' | 'failed'
    error?: unknown
  },
): FeaturePluginRef {
  const existingRef = payload.feature?.pluginRefs?.memstack || {}

  return {
    tracked: existingRef.tracked ?? true,
    externalId: existingRef.externalId || payload.feature?.name,
    lastSyncAt: options.status === 'success' ? new Date().toISOString() : existingRef.lastSyncAt,
    lastSyncStatus: options.status,
    lastSyncEvent: eventName,
    lastSyncError:
      options.status === 'failed'
        ? options.error instanceof Error
          ? options.error.message
          : String(options.error || 'Feature Memory sync failed')
        : undefined,
  }
}

async function listGithubRepos(token: string) {
  const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED: Your GitHub token has expired or is invalid. Please re-authenticate.')
    }
    throw new Error(`Failed to load GitHub repositories (${response.status})`)
  }

  const repos = (await response.json()) as Array<any>
  return repos.map((repo) => ({
    id: String(repo.id),
    fullName: repo.full_name,
    name: repo.name,
    owner: repo.owner?.login || '',
    defaultBranch: repo.default_branch || 'main',
    provider: 'github',
    visibility: repo.private ? 'private' : 'public',
  }))
}

async function listGitlabRepos(token: string, baseUrl: string, provider: 'gitlab' | 'gitlab-self-hosted') {
  const response = await fetch(
    `${baseUrl.replace(/\/$/, '')}/api/v4/projects?membership=true&simple=true&per_page=100&order_by=last_activity_at&sort=desc`,
    {
      headers: {
        'PRIVATE-TOKEN': token,
      },
    },
  )

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED: Your GitLab token has expired or is invalid. Please re-authenticate.')
    }
    throw new Error(`Failed to load GitLab repositories (${response.status})`)
  }

  const repos = (await response.json()) as Array<any>
  return repos.map((repo) => ({
    id: String(repo.id),
    fullName: repo.path_with_namespace,
    name: repo.name,
    owner: repo.namespace?.full_path || '',
    defaultBranch: repo.default_branch || 'main',
    provider,
    visibility: repo.visibility || 'private',
    webUrl: repo.web_url,
  }))
}

export const memstackPlugin: MainPlugin = {
  id: 'memstack',
  name: 'Feature Memory',
  description: 'Optional feature memory integration for requirement capture and implementation summaries.',
  enabledByDefault: false,
  featureCreateStep: true,
  featureDetailsPanel: true,
  settingsSchema: [
    {
      key: 'baseUrl',
      label: 'Service Base URL',
      type: 'url',
      placeholder: 'https://feature-memory.example.com',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      placeholder: 'Optional for later integration',
    },
    {
      key: 'storageRepoFullName',
      label: 'Storage Repository',
      type: 'text',
      placeholder: 'owner/repository',
    },
    {
      key: 'storageBranch',
      label: 'Storage Branch',
      type: 'text',
      placeholder: 'main',
    },
    {
      key: 'storagePath',
      label: 'Storage Root Path',
      type: 'text',
      placeholder: 'Features',
    },
    {
      key: 'storageWriteMode',
      label: 'Storage Write Mode',
      type: 'text',
      placeholder: 'server',
    },
    {
      key: 'localStorageRepoPath',
      label: 'Local Storage Repo Path',
      type: 'text',
      placeholder: '/Users/name/workspace/Wiki',
    },
  ],
  getStatus: (state) => getMemstackStatus(state.config),
  runAction: async (action, _payload, context) => {
    if (action === 'validateConfig') {
      const status = getMemstackStatus(context.state.config)
      const writeMode =
        typeof context.state.config?.storageWriteMode === 'string'
          ? context.state.config.storageWriteMode.trim()
          : 'server'
      const baseUrl = typeof context.state.config?.baseUrl === 'string' ? context.state.config.baseUrl.trim() : ''
      const storageRepoFullName =
        typeof context.state.config?.storageRepoFullName === 'string'
          ? context.state.config.storageRepoFullName.trim()
          : ''
      const localStorageRepoPath =
        typeof context.state.config?.localStorageRepoPath === 'string'
          ? context.state.config.localStorageRepoPath.trim()
          : ''

      if (status.state !== 'ready') {
        return status
      }

      try {
        const health = await fetch(`${requireBaseUrl(context.state.config)}/healthz`)
        if (!health.ok) {
          return {
            state: 'error',
            message: 'Could not reach the MemStack service.',
          }
        }
      } catch {
        return {
          state: 'error',
          message: 'Could not reach the MemStack service.',
        }
      }

      if (writeMode === 'desktop') {
        if (!baseUrl) {
          return {
            state: 'error',
            message: 'Desktop Sync still needs a MemStack service URL.',
          }
        }

        if (!localStorageRepoPath) {
          return {
            state: 'error',
            message: 'Save Desktop Sync setup first so Nexwork can create the local Wiki repo.',
          }
        }

        if (!existsSync(localStorageRepoPath)) {
          return {
            state: 'error',
            message: 'Local storage repo path was not found.',
          }
        }

        if (!existsSync(join(localStorageRepoPath, '.git'))) {
          return {
            state: 'error',
            message: 'The local storage path is not a git repository.',
          }
        }

        return {
          state: 'ready',
          message: 'Desktop Sync is ready.',
        }
      }

      if (!storageRepoFullName) {
        return {
          state: 'error',
          message: 'Choose a storage repository first.',
        }
      }

      return {
        state: 'ready',
        message: 'Server Sync is ready.',
      }
    }

    if (action === 'listDesktopSyncBranches') {
      const localStorageRepoPath =
        typeof context.state.config?.localStorageRepoPath === 'string'
          ? context.state.config.localStorageRepoPath.trim()
          : ''

      if (!localStorageRepoPath || !existsSync(join(localStorageRepoPath, '.git'))) {
        return {
          branches: [
            typeof context.state.config?.storageBranch === 'string' && context.state.config.storageBranch.trim()
              ? context.state.config.storageBranch.trim()
              : 'main',
          ],
        }
      }

      await runGitAllowFailure(localStorageRepoPath, ['fetch', 'origin', '--prune'])
      const refs = await runGitAllowFailure(localStorageRepoPath, [
        'for-each-ref',
        '--format=%(refname:short)',
        'refs/heads',
        'refs/remotes/origin',
      ])

      const branches = Array.from(
        new Set(
          refs.stdout
            .split('\n')
            .map((line: string) => line.trim())
            .filter(Boolean)
            .map((line: string) => line.replace(/^origin\//, ''))
            .filter((line: string) => line !== 'HEAD'),
        ),
      )

      if (branches.length === 0) {
        branches.push(
          typeof context.state.config?.storageBranch === 'string' && context.state.config.storageBranch.trim()
            ? context.state.config.storageBranch.trim()
            : 'main',
        )
      }

      return { branches }
    }

    if (action === 'detectDocsLayout') {
      const repoPath = resolveDesktopSyncRepoPath(context.state.config)
      return detectDesktopDocsLayout(repoPath)
    }

    if (action === 'migrateDocsLayout') {
      const repoPath = resolveDesktopSyncRepoPath(context.state.config)
      if (!repoPath) {
        throw new Error('Save Desktop Sync setup first so Nexwork knows which docs repo to migrate.')
      }
      return migrateDesktopDocsLayout(repoPath)
    }

    if (action === 'listStorageRepos') {
      const active = getActiveGitContext()

      if (active.provider === 'github') {
        const token = active.token
        if (!token) {
          throw new Error('The active GitHub account does not have a reusable token.')
        }

        return {
          account: {
            provider: active.provider,
            user: active.user,
          },
          repos: await listGithubRepos(token),
        }
      }

      if (active.provider === 'gitlab' || active.provider === 'gitlab-self-hosted') {
        const token = active.token
        if (!token) {
          throw new Error('The active GitLab account does not have a reusable token.')
        }

        return {
          account: {
            provider: active.provider,
            user: active.user,
            gitlabUrl: active.gitlabUrl || 'https://gitlab.com',
          },
          repos: await listGitlabRepos(token, active.gitlabUrl || 'https://gitlab.com', active.provider),
        }
      }

      throw new Error(`Unsupported Git provider for repository listing: ${active.provider}`)
    }

    if (action === 'prepareRequirement' || action === 'askQuestion') {
      const baseUrl = requireBaseUrl(context.state.config)
      const apiKey = typeof context.state.config?.apiKey === 'string' ? context.state.config.apiKey.trim() : ''
      const endpoint =
        action === 'prepareRequirement' ? '/api/feature-memories/prepare-requirement' : '/api/feature-memories/ask'

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          ...(_payload || {}),
          storageTarget: {
            ...buildStorageTarget(context.state.config),
          },
          gitAccount: (() => {
            try {
              return buildGitAccountPayload()
            } catch {
              return null
            }
          })(),
        }),
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(body || `Feature Memory request failed (${response.status})`)
      }

      return response.json()
    }

    throw new Error(`Unsupported plugin action: ${action}`)
  },
  onFeatureCreated: async (payload, context) => {
    const memstackData = payload.pluginData?.memstack

    if (!memstackData?.tracked) {
      return
    }

    try {
      const result = await syncFeatureMemory(context.state.config, {
        eventName: 'feature.created',
        feature: payload.feature,
        pluginData: {
          memstack: memstackData,
        },
        workspaceRoot: payload.workspaceRoot,
      })

      return {
        pluginRef: {
          ...buildSyncPluginRef(payload, 'feature.created', { status: 'success' }),
          tracked: true,
          externalId: result?.externalFeatureId || payload.feature.name,
        },
        message: isDesktopSync(context.state.config) ? buildDesktopSyncMessage(result) : undefined,
      }
    } catch (error) {
      return {
        pluginRef: {
          ...buildSyncPluginRef(payload, 'feature.created', { status: 'failed', error }),
          tracked: true,
        },
      }
    }
  },
  onFeatureCompleted: async (payload, context) => {
    if (payload.syncToMemstack === false) {
      return
    }

    if (!isTrackedFeature(payload.feature)) {
      return
    }

    try {
      if (!isDesktopSync(context.state.config)) {
        const storageRepoFullName =
          typeof context.state.config?.storageRepoFullName === 'string'
            ? context.state.config.storageRepoFullName.trim()
            : ''
        if (!storageRepoFullName) {
          throw new Error(
            'MemStack push aborted: "Storage Repository" is completely empty! Please open Nexwork Settings -> Built-in Plugins -> Feature Memory and type your owner/repo target in the Storage Repository box.',
          )
        }

        try {
          getActiveGitContext()
        } catch {
          throw new Error(
            'MemStack push aborted: You have no active Git account with a saved token. Re-authenticate on the Dashboard.',
          )
        }
      }

      const result = await syncFeatureMemory(context.state.config, {
        eventName: 'feature.completed',
        feature: payload.feature,
        workspaceRoot: payload.workspaceRoot,
        desktopSyncBranch: payload.desktopSyncBranch,
      })

      return {
        pluginRef: buildSyncPluginRef(payload, 'feature.completed', { status: 'success' }),
        message: isDesktopSync(context.state.config) ? buildDesktopSyncMessage(result) : undefined,
      }
    } catch (error) {
      return {
        pluginRef: buildSyncPluginRef(payload, 'feature.completed', { status: 'failed', error }),
      }
    }
  },
  onFeatureScopeUpdated: async (payload, context) => {
    if (!isTrackedFeature(payload.feature)) {
      return
    }

    try {
      const result = await syncFeatureMemory(context.state.config, {
        eventName: 'feature.scope.updated',
        feature: payload.feature,
        featureName: payload.featureName,
        addedProjects: payload.addedProjects,
        workspaceRoot: payload.workspaceRoot,
      })

      return {
        pluginRef: buildSyncPluginRef(payload, 'feature.scope.updated', { status: 'success' }),
        message: isDesktopSync(context.state.config) ? buildDesktopSyncMessage(result) : undefined,
      }
    } catch (error) {
      return {
        pluginRef: buildSyncPluginRef(payload, 'feature.scope.updated', { status: 'failed', error }),
      }
    }
  },
}
