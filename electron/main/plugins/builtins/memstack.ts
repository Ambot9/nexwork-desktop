import { authStore } from '../../auth-store'
import type { MainPlugin, PluginStatus } from '../types'

function getMemstackStatus(config?: Record<string, any>): PluginStatus {
  const baseUrl = typeof config?.baseUrl === 'string' ? config.baseUrl.trim() : ''
  const storageRepoFullName = typeof config?.storageRepoFullName === 'string' ? config.storageRepoFullName.trim() : ''

  if (!baseUrl) {
    return {
      state: 'not_configured',
      message: 'Add a service base URL to enable the Feature Memory integration.',
    }
  }

  return {
    state: 'ready',
    message: storageRepoFullName
      ? `Configured for plugin integration. Storage repo: ${storageRepoFullName}`
      : 'Configured for plugin integration. Choose a storage repo when you want Git-backed memory writes.',
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
  }
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

async function listGithubRepos(token: string) {
  const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  })

  if (!response.ok) {
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
  ],
  getStatus: (state) => getMemstackStatus(state.config),
  runAction: async (action, _payload, context) => {
    if (action === 'validateConfig') {
      return getMemstackStatus(context.state.config)
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

    const result = await postMemstackSync(context.state.config, {
      eventName: 'feature.created',
      feature: payload.feature,
      pluginData: {
        memstack: memstackData,
      },
      workspaceRoot: payload.workspaceRoot,
    })

    return {
      pluginRef: {
        tracked: true,
        externalId: result?.externalFeatureId || payload.feature.name,
        lastSyncAt: new Date().toISOString(),
        status: 'synced',
      },
    }
  },
  onFeatureCompleted: async (payload, context) => {
    await postMemstackSync(context.state.config, {
      eventName: 'feature.completed',
      feature: payload.feature,
      workspaceRoot: payload.workspaceRoot,
    })
  },
  onProjectStatusUpdated: async (payload, context) => {
    await postMemstackSync(context.state.config, {
      eventName: 'project.status.updated',
      feature: payload.feature,
      featureName: payload.featureName,
      projectName: payload.projectName,
      status: payload.status,
      workspaceRoot: payload.workspaceRoot,
    })
  },
}
