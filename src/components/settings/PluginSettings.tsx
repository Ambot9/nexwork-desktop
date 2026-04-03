import { Alert, Button, Card, Input, Modal, Space, Switch, Tag, Typography, message } from 'antd'
import { AlertCircle, Cable, CheckCircle2, Puzzle, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { PluginDescriptor } from '../../plugins/types'

const { Text } = Typography

interface Props {
  plugins: PluginDescriptor[]
  workspaceRoot?: string
  onToggle: (pluginId: string, enabled: boolean) => Promise<boolean>
  onSaveConfig: (pluginId: string, config: Record<string, any>) => Promise<boolean>
  onRefresh: () => Promise<void>
}

function getStatusTag(plugin: PluginDescriptor) {
  switch (plugin.status.state) {
    case 'ready':
      return <Tag color="success">Ready</Tag>
    case 'not_configured':
      return <Tag color="warning">Needs Setup</Tag>
    case 'error':
      return <Tag color="error">Error</Tag>
    default:
      return <Tag>Disabled</Tag>
  }
}

export function PluginSettings({ plugins, workspaceRoot, onToggle, onSaveConfig, onRefresh }: Props) {
  const [drafts, setDrafts] = useState<Record<string, Record<string, any>>>({})
  const [savingPluginId, setSavingPluginId] = useState<string | null>(null)
  const [validatingPluginId, setValidatingPluginId] = useState<string | null>(null)
  const [togglingPluginId, setTogglingPluginId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [repoPickerPluginId, setRepoPickerPluginId] = useState<string | null>(null)
  const [repoPickerLoading, setRepoPickerLoading] = useState(false)
  const [repoPickerToken, setRepoPickerToken] = useState('')
  const [repoPickerUpdatingToken, setRepoPickerUpdatingToken] = useState(false)
  const [repoPickerAccountLabel, setRepoPickerAccountLabel] = useState('')
  const [repoPickerError, setRepoPickerError] = useState<{ message: string; isTokenExpired: boolean } | null>(null)
  const [repoPickerRepos, setRepoPickerRepos] = useState<
    Array<{
      id: string
      fullName: string
      name: string
      owner: string
      defaultBranch: string
      provider: string
      visibility?: string
      webUrl?: string
    }>
  >([])
  const [docsLayoutState, setDocsLayoutState] = useState<
    Record<string, { hasOldLayout: boolean; message?: string; issues?: string[] }>
  >({})
  const [migratingPluginId, setMigratingPluginId] = useState<string | null>(null)

  const installedPlugins = plugins

  const getDraftValue = (plugin: PluginDescriptor, key: string) =>
    drafts[plugin.id]?.[key] ?? plugin.config?.[key] ?? ''
  const getEffectiveConfig = (plugin: PluginDescriptor) => ({
    ...(plugin.config || {}),
    ...(drafts[plugin.id] || {}),
  })
  const getSuggestedMemstackRepoPath = () => (workspaceRoot ? `${workspaceRoot}/Wiki` : '')
  const updatePluginDraft = (pluginId: string, next: Record<string, any>) =>
    setDrafts((prev) => ({
      ...prev,
      [pluginId]: {
        ...(prev[pluginId] || plugins.find((plugin) => plugin.id === pluginId)?.config || {}),
        ...next,
      },
    }))

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev }
      for (const plugin of plugins) {
        if (next[plugin.id]) {
          next[plugin.id] = {
            ...plugin.config,
            ...next[plugin.id],
          }
        }
      }
      return next
    })
  }, [plugins])

  useEffect(() => {
    const memstackPlugin = plugins.find((plugin) => plugin.id === 'memstack' && plugin.enabled)
    if (!memstackPlugin) return

    const effectiveConfig = {
      ...(memstackPlugin.config || {}),
      ...(drafts[memstackPlugin.id] || {}),
    }

    if (effectiveConfig.storageWriteMode !== 'desktop' || !effectiveConfig.localStorageRepoPath) {
      return
    }

    window.nexworkAPI.plugins
      .runAction(memstackPlugin.id, 'detectDocsLayout')
      .then((result) => {
        if (result.success) {
          setDocsLayoutState((prev) => ({
            ...prev,
            [memstackPlugin.id]: result.result,
          }))
        }
      })
      .catch(() => {
        // ignore detection failures in background UI
      })
  }, [plugins, drafts])

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  const handleValidate = async (pluginId: string) => {
    try {
      setValidatingPluginId(pluginId)
      const result = await window.nexworkAPI.plugins.runAction(pluginId, 'validateConfig')
      if (result.success) {
        if (result.result?.state === 'error' || result.result?.state === 'not_configured') {
          message.error(result.result?.message || 'This setup still needs more configuration.')
        } else {
          message.success(result.result?.message || 'Plugin configuration looks valid.')
        }
      } else {
        message.error(result.error || 'Failed to validate plugin configuration.')
      }
      await handleRefresh()
    } finally {
      setValidatingPluginId(null)
    }
  }

  const handleLoadRepos = async (plugin: PluginDescriptor) => {
    try {
      setRepoPickerLoading(true)
      setRepoPickerError(null)
      const result = await window.nexworkAPI.plugins.runAction(plugin.id, 'listStorageRepos')
      if (!result.success) {
        const errorMsg = result.error || 'Failed to load repositories from the active Git account.'
        if (errorMsg.includes('TOKEN_EXPIRED')) {
          setRepoPickerError({
            message: 'Your Git token has expired or belongs to a different session. Please re-authenticate.',
            isTokenExpired: true,
          })
          setRepoPickerPluginId(plugin.id)
        } else {
          message.error(errorMsg)
        }
        return
      }

      const account = result.result?.account
      const repos = Array.isArray(result.result?.repos) ? result.result.repos : []
      setRepoPickerRepos(repos)
      setRepoPickerAccountLabel(
        account
          ? `${account.user} (${account.provider}${account.gitlabUrl ? ` · ${account.gitlabUrl}` : ''})`
          : 'Active Git account',
      )
      setRepoPickerPluginId(plugin.id)
    } finally {
      setRepoPickerLoading(false)
    }
  }

  return (
    <Card
      title={
        <Space>
          <Puzzle size={16} />
          Extensions
        </Space>
      }
      extra={
        <Button size="small" icon={<RefreshCw size={14} />} onClick={handleRefresh} loading={refreshing}>
          Refresh
        </Button>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Alert
          type="info"
          showIcon
          message="Optional extensions"
          description="Extensions add focused workflow capabilities without changing the Nexwork core flow. Install only the ones your team actually uses."
        />

        {installedPlugins.length === 0 ? (
          <Card size="small">
            <Space direction="vertical" style={{ width: '100%', textAlign: 'center' }} size="middle">
              <div>
                <Text strong>No extensions available</Text>
                <div>
                  <Text type="secondary">No registered extensions were found for this Nexwork build.</Text>
                </div>
              </div>
            </Space>
          </Card>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Installed extensions
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Turn an extension on or off without removing its saved setup.
            </Text>
          </div>
        )}

        {installedPlugins.map((plugin) => (
          <Card key={plugin.id} size="small">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <Space>
                    <Cable size={16} />
                    <Text strong>{plugin.name}</Text>
                    {getStatusTag(plugin)}
                    <Tag>{getExtensionCategory(plugin)}</Tag>
                  </Space>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {plugin.description}
                    </Text>
                  </div>
                  {plugin.status.message && (
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {plugin.status.message}
                      </Text>
                    </div>
                  )}
                </div>
                <Switch
                  checked={plugin.enabled}
                  loading={togglingPluginId === plugin.id}
                  onChange={async (checked) => {
                    try {
                      setTogglingPluginId(plugin.id)
                      await onToggle(plugin.id, checked)
                    } finally {
                      setTogglingPluginId(null)
                    }
                  }}
                />
              </div>

              {plugin.enabled && plugin.settingsSchema.length > 0 && (
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {plugin.settingsSchema
                    .filter((field) => isVisibleSettingField(plugin, field.key, getEffectiveConfig(plugin)))
                    .map((field) => (
                      <div key={field.key}>
                        <Text strong style={{ fontSize: 12 }}>
                          {field.label}
                        </Text>
                        <Input
                          type={field.type === 'password' ? 'password' : 'text'}
                          placeholder={field.placeholder}
                          value={getDraftValue(plugin, field.key)}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [plugin.id]: {
                                ...(prev[plugin.id] || plugin.config || {}),
                                [field.key]: event.target.value,
                              },
                            }))
                          }
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    ))}

                  {plugin.id === 'memstack' && (
                    <>
                      <Alert
                        type="info"
                        showIcon
                        style={{ borderRadius: 12 }}
                        message="Feature Memory Setup"
                        description={
                          getEffectiveConfig(plugin).storageWriteMode === 'desktop'
                            ? 'Use Desktop Sync when the docs repo is only reachable from this laptop, such as private Git behind VPN or WARP.'
                            : 'Use Server Sync when the MemStack service itself can reach the docs repo directly.'
                        }
                      />

                      <Card size="small" style={{ borderRadius: 12 }}>
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          <Text strong style={{ fontSize: 13 }}>
                            Storage Write Mode
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Server Sync lets MemStack write docs directly. Desktop Sync is for private Git behind VPN or
                            WARP, where this laptop will push the docs.
                          </Text>
                          <Space>
                            <Button
                              type={
                                (getEffectiveConfig(plugin).storageWriteMode || 'server') === 'server'
                                  ? 'primary'
                                  : 'default'
                              }
                              onClick={() =>
                                updatePluginDraft(plugin.id, {
                                  storageWriteMode: 'server',
                                })
                              }
                            >
                              Server Sync
                            </Button>
                            <Button
                              type={getEffectiveConfig(plugin).storageWriteMode === 'desktop' ? 'primary' : 'default'}
                              onClick={() =>
                                updatePluginDraft(plugin.id, {
                                  storageWriteMode: 'desktop',
                                  ...(getEffectiveConfig(plugin).localStorageRepoPath
                                    ? {}
                                    : getSuggestedMemstackRepoPath()
                                      ? { localStorageRepoPath: getSuggestedMemstackRepoPath() }
                                      : {}),
                                })
                              }
                            >
                              Desktop Sync
                            </Button>
                          </Space>
                        </Space>
                      </Card>

                      <Card
                        size="small"
                        style={{
                          borderRadius: 12,
                          background: 'linear-gradient(135deg, rgba(22,119,255,0.06), rgba(16,185,129,0.05))',
                        }}
                      >
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          <Text strong style={{ fontSize: 13 }}>
                            Storage Repository
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {getEffectiveConfig(plugin).storageWriteMode === 'desktop'
                              ? 'Choose the Git repository this laptop should push Feature Memory docs to.'
                              : 'Choose the repository where MemStack should write Feature Memory docs.'}
                          </Text>
                          <div>
                            <Button loading={repoPickerLoading} onClick={() => handleLoadRepos(plugin)}>
                              Choose Repository
                            </Button>
                          </div>
                        </Space>
                      </Card>

                      {getEffectiveConfig(plugin).storageRepoFullName && (
                        <Card size="small" style={{ borderRadius: 12 }}>
                          <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            <Text strong style={{ fontSize: 13 }}>
                              Saved Storage
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Feature repos hold code changes. The docs repo holds Feature Memory markdown. MemStack
                              prepares the content that gets written there.
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Mode:{' '}
                              {getEffectiveConfig(plugin).storageWriteMode === 'desktop'
                                ? 'Desktop Sync'
                                : 'Server Sync'}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Repository: {getEffectiveConfig(plugin).storageRepoFullName}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Branch: {getEffectiveConfig(plugin).storageBranch || 'main'}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Feature Path:{' '}
                              {(getEffectiveConfig(plugin).storagePath || 'Features') + '/<year>/<feature>/'}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Topic Wiki Path: {'Wiki/<topic>.md'}
                            </Text>
                            <Alert
                              type="success"
                              showIcon
                              style={{ marginTop: 8, borderRadius: 12 }}
                              message="Setup Summary"
                              description={
                                getEffectiveConfig(plugin).storageWriteMode === 'desktop'
                                  ? 'Desktop Sync will prepare docs through MemStack, then commit them from this laptop.'
                                  : 'Server Sync will let MemStack prepare and write the docs directly.'
                              }
                            />
                          </Space>
                        </Card>
                      )}

                      {getEffectiveConfig(plugin).storageWriteMode === 'desktop' && (
                        <Card size="small" style={{ borderRadius: 12 }}>
                          <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            <Text strong style={{ fontSize: 13 }}>
                              Local Storage Repo
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Nexwork uses a dedicated <strong>Wiki</strong> repo under your workspace root. This path
                              is created automatically when you save Desktop Sync.
                            </Text>
                            <Input
                              readOnly
                              value={getEffectiveConfig(plugin).localStorageRepoPath || getSuggestedMemstackRepoPath()}
                            />
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Happy path: choose the docs repo, save config, validate, then complete a feature to commit
                              the final memory docs.
                            </Text>
                          </Space>
                        </Card>
                      )}

                      {getEffectiveConfig(plugin).storageWriteMode === 'desktop' &&
                        docsLayoutState[plugin.id]?.hasOldLayout && (
                          <Alert
                            type="warning"
                            showIcon
                            style={{ borderRadius: 12 }}
                            message="Old docs layout detected"
                            description={
                              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  This docs repo still contains older MemStack paths. Run the migration once to move
                                  everything into the current `Wiki/PROJECT_CONTEXT.md`, `Wiki/Features/...`, and
                                  `Wiki/Topics/...` structure.
                                </Text>
                                {docsLayoutState[plugin.id]?.issues?.map((issue) => (
                                  <Text key={issue} type="secondary" style={{ fontSize: 12 }}>
                                    - {issue}
                                  </Text>
                                ))}
                                <div>
                                  <Button
                                    loading={migratingPluginId === plugin.id}
                                    onClick={async () => {
                                      try {
                                        setMigratingPluginId(plugin.id)
                                        const result = await window.nexworkAPI.plugins.runAction(
                                          plugin.id,
                                          'migrateDocsLayout',
                                        )
                                        if (!result.success) {
                                          message.error(result.error || 'Could not migrate docs layout')
                                          return
                                        }
                                        message.success(result.result?.message || 'Docs layout migrated')
                                        await onRefresh()
                                        const refreshed = await window.nexworkAPI.plugins.runAction(
                                          plugin.id,
                                          'detectDocsLayout',
                                        )
                                        if (refreshed.success) {
                                          setDocsLayoutState((prev) => ({
                                            ...prev,
                                            [plugin.id]: refreshed.result,
                                          }))
                                        }
                                      } finally {
                                        setMigratingPluginId(null)
                                      }
                                    }}
                                  >
                                    Migrate Docs Layout
                                  </Button>
                                </div>
                              </Space>
                            }
                          />
                        )}
                    </>
                  )}

                  <Space>
                    <Button
                      type="primary"
                      loading={savingPluginId === plugin.id}
                      onClick={async () => {
                        try {
                          setSavingPluginId(plugin.id)
                          const didSave = await onSaveConfig(plugin.id, drafts[plugin.id] || plugin.config || {})
                          if (didSave) {
                            setDrafts((prev) => ({
                              ...prev,
                              [plugin.id]: {},
                            }))
                          }
                        } finally {
                          setSavingPluginId(null)
                        }
                      }}
                    >
                      Save Config
                    </Button>
                    <Button
                      icon={plugin.status.state === 'ready' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      loading={validatingPluginId === plugin.id}
                      onClick={() => handleValidate(plugin.id)}
                    >
                      Validate
                    </Button>
                  </Space>
                </Space>
              )}
            </Space>
          </Card>
        ))}

        <Modal
          title="Choose Storage Repository"
          open={!!repoPickerPluginId}
          onCancel={() => {
            setRepoPickerPluginId(null)
            setRepoPickerRepos([])
            setRepoPickerAccountLabel('')
            setRepoPickerError(null)
            setRepoPickerToken('')
          }}
          footer={null}
          width={720}
          destroyOnClose
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Alert
              type="info"
              showIcon
              message="Active Nexwork Git account"
              description={repoPickerAccountLabel || 'Repository list loaded from the current Git account in Nexwork.'}
            />

            {repoPickerError ? (
              <Alert
                type="error"
                showIcon
                message="Authentication Required"
                description={
                  <Space direction="vertical" style={{ marginTop: 8 }}>
                    <Text>{repoPickerError.message}</Text>
                    {repoPickerError.isTokenExpired && (
                      <div style={{ marginTop: 8 }}>
                        <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
                          New Personal Access Token
                        </Text>
                        <Space>
                          <Input.Password
                            placeholder="Paste your new Git token here"
                            value={repoPickerToken}
                            onChange={(e) => setRepoPickerToken(e.target.value)}
                            style={{ minWidth: 300 }}
                          />
                          <Button
                            type="primary"
                            loading={repoPickerUpdatingToken}
                            disabled={!repoPickerToken.trim()}
                            onClick={async () => {
                              try {
                                if (!repoPickerPluginId) return
                                setRepoPickerUpdatingToken(true)

                                const auth = await window.nexworkAPI.gitAuth.checkAuth()
                                if (!auth.authenticated) throw new Error('No active account to update')

                                await window.nexworkAPI.gitAuth.saveAuth({
                                  provider: auth.provider,
                                  user: auth.user,
                                  avatar: auth.avatar,
                                  gitlabUrl: auth.gitlabUrl,
                                  token: repoPickerToken.trim(),
                                })

                                message.success('Token updated successfully')
                                setRepoPickerToken('')

                                // Auto-retry loading the repos
                                const plugin = plugins.find((p) => p.id === repoPickerPluginId)
                                if (plugin) await handleLoadRepos(plugin)
                              } catch (err: any) {
                                message.error(err.message || 'Failed to update token')
                              } finally {
                                setRepoPickerUpdatingToken(false)
                              }
                            }}
                          >
                            Update & Retry
                          </Button>
                        </Space>
                      </div>
                    )}
                  </Space>
                }
              />
            ) : repoPickerRepos.length === 0 ? (
              <Alert
                type="warning"
                showIcon
                message="No repositories found"
                description="Make sure the active Git account has repository access and a reusable token."
              />
            ) : (
              repoPickerRepos.map((repo) => (
                <Card key={repo.id} size="small">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <Space>
                        <Text strong>{repo.fullName}</Text>
                        <Tag>{repo.provider}</Tag>
                        {repo.visibility && <Tag color="blue">{repo.visibility}</Tag>}
                      </Space>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Default branch: {repo.defaultBranch || 'main'}
                        </Text>
                      </div>
                    </div>
                    <Button
                      type="primary"
                      onClick={() => {
                        if (!repoPickerPluginId) return
                        setDrafts((prev) => ({
                          ...prev,
                          [repoPickerPluginId]: {
                            ...(prev[repoPickerPluginId] ||
                              plugins.find((plugin) => plugin.id === repoPickerPluginId)?.config ||
                              {}),
                            storageRepoFullName: repo.fullName,
                            storageBranch: repo.defaultBranch || 'main',
                            storagePath:
                              (
                                prev[repoPickerPluginId] ||
                                plugins.find((plugin) => plugin.id === repoPickerPluginId)?.config ||
                                {}
                              ).storagePath || 'Features',
                          },
                        }))
                        setRepoPickerPluginId(null)
                        setRepoPickerRepos([])
                        setRepoPickerAccountLabel('')
                        message.success(`Selected ${repo.fullName} for Feature Memory storage`)
                      }}
                    >
                      Use Repo
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </Space>
        </Modal>
      </Space>
    </Card>
  )
}

function getExtensionCategory(plugin: PluginDescriptor): string {
  if (plugin.id === 'memstack') {
    return 'Knowledge'
  }

  return 'Workflow'
}

function isVisibleSettingField(plugin: PluginDescriptor, fieldKey: string, config: Record<string, any>): boolean {
  if (plugin.id !== 'memstack') {
    return true
  }

  const writeMode = config.storageWriteMode === 'desktop' ? 'desktop' : 'server'

  if (
    ['storageRepoFullName', 'storageBranch', 'storagePath', 'storageWriteMode', 'localStorageRepoPath'].includes(
      fieldKey,
    )
  ) {
    return false
  }

  if (writeMode === 'desktop' && ['baseUrl', 'apiKey'].includes(fieldKey)) {
    return false
  }

  return true
}
