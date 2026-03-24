import { Alert, Button, Card, Input, Modal, Space, Switch, Tag, Typography, message } from 'antd'
import { AlertCircle, Cable, CheckCircle2, Plus, Puzzle, RefreshCw, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { PluginDescriptor } from '../../plugins/types'

const { Text } = Typography
const { Search: SearchInput } = Input

interface Props {
  plugins: PluginDescriptor[]
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

export function PluginSettings({ plugins, onToggle, onSaveConfig, onRefresh }: Props) {
  const [drafts, setDrafts] = useState<Record<string, Record<string, any>>>({})
  const [savingPluginId, setSavingPluginId] = useState<string | null>(null)
  const [validatingPluginId, setValidatingPluginId] = useState<string | null>(null)
  const [addPluginOpen, setAddPluginOpen] = useState(false)
  const [togglingPluginId, setTogglingPluginId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [repoPickerPluginId, setRepoPickerPluginId] = useState<string | null>(null)
  const [repoPickerLoading, setRepoPickerLoading] = useState(false)
  const [repoPickerToken, setRepoPickerToken] = useState('')
  const [repoPickerUpdatingToken, setRepoPickerUpdatingToken] = useState(false)
  const [repoPickerAccountLabel, setRepoPickerAccountLabel] = useState('')
  const [repoPickerError, setRepoPickerError] = useState<{ message: string; isTokenExpired: boolean } | null>(null)
  const [catalogQuery, setCatalogQuery] = useState('')
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

  const enabledPlugins = plugins.filter((plugin) => plugin.enabled)
  const availablePlugins = plugins.filter((plugin) => !plugin.enabled)
  const normalizedCatalogQuery = catalogQuery.trim().toLowerCase()
  const filteredAvailablePlugins = availablePlugins.filter((plugin) => {
    if (!normalizedCatalogQuery) return true
    return (
      plugin.name.toLowerCase().includes(normalizedCatalogQuery) ||
      plugin.description.toLowerCase().includes(normalizedCatalogQuery) ||
      getExtensionCategory(plugin).toLowerCase().includes(normalizedCatalogQuery)
    )
  })

  const getDraftValue = (plugin: PluginDescriptor, key: string) =>
    drafts[plugin.id]?.[key] ?? plugin.config?.[key] ?? ''
  const getEffectiveConfig = (plugin: PluginDescriptor) => ({
    ...(plugin.config || {}),
    ...(drafts[plugin.id] || {}),
  })

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
        message.success(result.result?.message || 'Plugin configuration looks valid.')
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

        {enabledPlugins.length === 0 ? (
          <Card size="small">
            <Space direction="vertical" style={{ width: '100%', textAlign: 'center' }} size="middle">
              <div>
                <Text strong>No integrations enabled</Text>
                <div>
                  <Text type="secondary">Add an integration only when you need extra workflow support.</Text>
                </div>
              </div>
              <div>
                <Button type="primary" icon={<Plus size={14} />} onClick={() => setAddPluginOpen(true)}>
                  Browse Extensions
                </Button>
              </div>
            </Space>
          </Card>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Installed extensions
            </Text>
            <Button icon={<Plus size={14} />} onClick={() => setAddPluginOpen(true)}>
              Browse Extensions
            </Button>
          </div>
        )}

        {enabledPlugins.map((plugin) => (
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
                    .filter((field) => !isHiddenMemstackStorageField(plugin, field.key))
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
                            Reuse the active Nexwork Git account and choose one repository where Feature Memory should
                            store markdown.
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
                          </Space>
                        </Card>
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
          title="Extensions Library"
          open={addPluginOpen}
          onCancel={() => {
            setAddPluginOpen(false)
            setCatalogQuery('')
          }}
          footer={null}
          width={760}
          destroyOnClose
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Alert
              type="info"
              showIcon
              message="Install first-party extensions"
              description="This library lists supported Nexwork extensions. Enable one to add it to your workspace, then configure it from the installed extensions list."
            />

            <SearchInput
              allowClear
              placeholder="Search extensions by name, purpose, or category"
              value={catalogQuery}
              onChange={(event) => setCatalogQuery(event.target.value)}
              prefix={<Search size={14} />}
            />

            {availablePlugins.length === 0 ? (
              <Alert
                type="success"
                showIcon
                message="All available extensions are already installed"
                description="Disable one from the installed list above if you want to remove it from the active workspace."
              />
            ) : filteredAvailablePlugins.length === 0 ? (
              <Alert
                type="warning"
                showIcon
                message="No extensions match your search"
                description="Try a broader keyword like knowledge, workflow, or automation."
              />
            ) : (
              filteredAvailablePlugins.map((plugin) => (
                <Card key={plugin.id} size="small">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <Space>
                        <Cable size={16} />
                        <Text strong>{plugin.name}</Text>
                        <Tag>{getExtensionCategory(plugin)}</Tag>
                        <Tag>Available</Tag>
                      </Space>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {plugin.description}
                        </Text>
                      </div>
                    </div>
                    <Button
                      type="primary"
                      loading={togglingPluginId === plugin.id}
                      onClick={async () => {
                        try {
                          setTogglingPluginId(plugin.id)
                          const didEnable = await onToggle(plugin.id, true)
                          if (didEnable) {
                            setAddPluginOpen(false)
                            setCatalogQuery('')
                          }
                        } finally {
                          setTogglingPluginId(null)
                        }
                      }}
                    >
                      Install
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </Space>
        </Modal>

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

function isHiddenMemstackStorageField(plugin: PluginDescriptor, fieldKey: string): boolean {
  if (plugin.id !== 'memstack') {
    return false
  }

  return ['storageRepoFullName', 'storageBranch', 'storagePath'].includes(fieldKey)
}
