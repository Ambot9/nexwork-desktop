import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Card,
  Typography,
  Space,
  Button,
  Input,
  Tag,
  Progress,
  Empty,
  Alert,
  Row,
  Col,
  Segmented,
  Collapse,
  message,
} from 'antd'
import {
  RefreshCw,
  ArrowDown,
  AlertTriangle,
  CheckCircle2,
  FolderGit2,
  Search,
  Settings as SettingsIcon,
  FolderOpen,
} from 'lucide-react'

const { Title, Text } = Typography
const { Panel } = Collapse

type HealthStatus = {
  name: string
  path: string
  branch: string
  ahead: number
  behind: number
  dirty: boolean
  noRemote: boolean
  loading: boolean
  error?: string
}

interface WorkspaceHealthProps {
  onOpenSettings: () => void
}

interface ProjectGroup {
  name: string
  projects: Array<{ name: string; path: string }>
}

const groupProjects = (items: Array<{ name: string; path: string }>, workspaceRoot: string): ProjectGroup[] => {
  if (!items.length) return []
  const root = workspaceRoot.replace(/\\/g, '/')
  const groups: Record<string, Array<{ name: string; path: string }>> = {}

  for (const project of items) {
    const fullPath = project.path.replace(/\\/g, '/')
    let relative = fullPath
    if (root && fullPath.startsWith(root)) {
      relative = fullPath.slice(root.length)
      if (relative.startsWith('/')) relative = relative.slice(1)
    }
    const parts = relative.split('/').filter(Boolean)
    const groupName = parts.length > 1 ? parts[0] : 'Ungrouped'
    if (!groups[groupName]) groups[groupName] = []
    groups[groupName].push(project)
  }

  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, projects]) => ({
      name,
      projects: projects.sort((a, b) => a.name.localeCompare(b.name)),
    }))
}

export function WorkspaceHealth({ onOpenSettings }: WorkspaceHealthProps) {
  const [workspaceRoot, setWorkspaceRoot] = useState('')
  const [projects, setProjects] = useState<Array<{ name: string; path: string }>>([])
  const [health, setHealth] = useState<Record<string, HealthStatus>>({})
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'needs_pull' | 'dirty' | 'no_remote' | 'errors'>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const blockedRemotesRef = useRef<Record<string, { until: number; reason: string }>>({})

  const refreshHealth = useCallback(async (config?: any) => {
    setRefreshing(true)
    try {
      const currentConfig = config || (await window.nexworkAPI.config.load())
      const next: Record<string, HealthStatus> = {}

      await Promise.all(
        (currentConfig.projects || []).map(async (project: any) => {
          const projectPath = `${currentConfig.workspaceRoot}/${project.path}`
          next[project.name] = {
            name: project.name,
            path: project.path,
            branch: 'unknown',
            ahead: 0,
            behind: 0,
            dirty: false,
            noRemote: false,
            loading: true,
          }
          setHealth((prev) => ({ ...prev, ...next }))

          try {
            const blocked = blockedRemotesRef.current[project.name]
            if (blocked && blocked.until > Date.now()) {
              next[project.name] = {
                ...next[project.name],
                loading: false,
                error: blocked.reason,
              }
              setHealth((prev) => ({ ...prev, [project.name]: next[project.name] }))
              return
            }

            const branchResult = await window.nexworkAPI.runCommand('git rev-parse --abbrev-ref HEAD', projectPath)
            const branch = branchResult.success ? branchResult.output.trim() : 'unknown'

            const dirtyResult = await window.nexworkAPI.runCommand('git status --porcelain', projectPath)
            const dirty = dirtyResult.success ? dirtyResult.output.trim().length > 0 : false

            const fetchResult = await window.nexworkAPI.runCommand('git fetch --quiet --no-progress', projectPath)
            const fetchError = fetchResult.success ? '' : fetchResult.error || 'Fetch failed'
            const fetchErrorText = fetchError.toLowerCase()
            if (fetchErrorText.includes('not found') || fetchErrorText.includes('permission')) {
              blockedRemotesRef.current[project.name] = {
                until: Date.now() + 10 * 60 * 1000,
                reason: 'Remote unavailable (not found or no permission)',
              }
            }

            const remoteCheck = await window.nexworkAPI.runCommand(
              `git rev-parse --verify origin/${branch}`,
              projectPath,
            )
            if (!remoteCheck.success) {
              next[project.name] = {
                ...next[project.name],
                branch,
                dirty,
                noRemote: true,
                loading: false,
                error: fetchError,
              }
              setHealth((prev) => ({ ...prev, [project.name]: next[project.name] }))
              return
            }

            const localRef = await window.nexworkAPI.runCommand(
              `git rev-parse --verify ${branch} 2>/dev/null || git rev-parse --verify origin/${branch}`,
              projectPath,
            )

            if (!localRef.success) {
              next[project.name] = {
                ...next[project.name],
                branch,
                dirty,
                loading: false,
                error: 'Failed to resolve branch',
              }
              setHealth((prev) => ({ ...prev, [project.name]: next[project.name] }))
              return
            }

            const localHash = localRef.output.trim()
            const remoteHash = remoteCheck.output.trim()

            if (localHash === remoteHash) {
              next[project.name] = {
                ...next[project.name],
                branch,
                dirty,
                ahead: 0,
                behind: 0,
                loading: false,
              }
              setHealth((prev) => ({ ...prev, [project.name]: next[project.name] }))
              return
            }

            const statusResult = await window.nexworkAPI.runCommand(
              `git rev-list --left-right --count ${localHash}...${remoteHash}`,
              projectPath,
            )
            if (statusResult.success) {
              const parts = statusResult.output.trim().split(/\s+/)
              const ahead = parseInt(parts[0]) || 0
              const behind = parseInt(parts[1]) || 0
              next[project.name] = {
                ...next[project.name],
                branch,
                dirty,
                ahead,
                behind,
                loading: false,
                error: fetchError,
              }
              setHealth((prev) => ({ ...prev, [project.name]: next[project.name] }))
              return
            }

            next[project.name] = {
              ...next[project.name],
              branch,
              dirty,
              loading: false,
              error: 'Unable to compute status',
            }
            setHealth((prev) => ({ ...prev, [project.name]: next[project.name] }))
          } catch (error: any) {
            next[project.name] = {
              ...next[project.name],
              loading: false,
              error: error.message || 'Failed to load status',
            }
            setHealth((prev) => ({ ...prev, [project.name]: next[project.name] }))
          }
        }),
      )
    } finally {
      setRefreshing(false)
    }
  }, [])

  const loadProjects = useCallback(async () => {
    setLoading(true)
    try {
      const config = await window.nexworkAPI.config.load()
      setWorkspaceRoot(config.workspaceRoot || '')
      setProjects(config.projects || [])
      await refreshHealth(config)
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [refreshHealth])

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter((project) => {
      const status = health[project.name]
      const matchesText = !q || project.name.toLowerCase().includes(q) || project.path.toLowerCase().includes(q)
      if (!matchesText) return false

      if (filter === 'all') return true
      if (!status) return false
      if (filter === 'needs_pull') return status.behind > 0
      if (filter === 'dirty') return status.dirty
      if (filter === 'no_remote') return status.noRemote
      if (filter === 'errors') return !!status.error
      return true
    })
  }, [projects, search, filter, health])

  const groupedProjects = useMemo(() => {
    return groupProjects(filteredProjects, workspaceRoot)
  }, [filteredProjects, workspaceRoot])

  const summary = useMemo(() => {
    const values = Object.values(health)
    const total = values.length
    const dirty = values.filter((p) => p.dirty).length
    const behind = values.filter((p) => p.behind > 0).length
    const ahead = values.filter((p) => p.ahead > 0).length
    const noRemote = values.filter((p) => p.noRemote).length
    const issues = values.filter((p) => p.dirty || p.behind > 0 || p.noRemote || p.error).length
    return { total, dirty, behind, ahead, noRemote, issues }
  }, [health])

  const handlePullAll = async () => {
    setRefreshing(true)
    try {
      for (const project of projects) {
        const projectPath = `${workspaceRoot}/${project.path}`
        await window.nexworkAPI.runCommand('git pull --no-edit', projectPath)
      }
      await refreshHealth()
    } finally {
      setRefreshing(false)
    }
  }

  const handlePullGroup = async (groupProjects: Array<{ name: string; path: string }>) => {
    const pullable = groupProjects.filter((project) => {
      const status = health[project.name]
      const errorText = status?.error?.toLowerCase() || ''
      const blockedRef = blockedRemotesRef.current[project.name]
      const blocked =
        status?.noRemote ||
        errorText.includes('not found') ||
        errorText.includes('permission') ||
        (blockedRef && blockedRef.until > Date.now())
      return !status?.loading && !blocked
    })
    if (pullable.length === 0) {
      message.warning('No projects in this group can be pulled. Check remote access first.')
      return
    }

    setRefreshing(true)
    try {
      for (const project of pullable) {
        const projectPath = `${workspaceRoot}/${project.path}`
        await window.nexworkAPI.runCommand('git pull --no-edit', projectPath)
      }
      await refreshHealth()
    } finally {
      setRefreshing(false)
    }
  }

  const handlePullProject = async (projectName: string) => {
    const project = projects.find((p) => p.name === projectName)
    if (!project) return
    const status = health[projectName]
    const errorText = status?.error?.toLowerCase() || ''
    const blockedRef = blockedRemotesRef.current[projectName]
    const blocked =
      status?.noRemote ||
      errorText.includes('not found') ||
      errorText.includes('permission') ||
      (blockedRef && blockedRef.until > Date.now())
    if (blocked) {
      message.warning('Remote is unavailable. Fix access or update the origin URL before pulling.')
      return
    }
    setHealth((prev) => ({
      ...prev,
      [projectName]: { ...(prev[projectName] || ({} as HealthStatus)), loading: true },
    }))
    try {
      const projectPath = `${workspaceRoot}/${project.path}`
      await window.nexworkAPI.runCommand('git pull --no-edit', projectPath)
      await refreshHealth()
    } finally {
      setHealth((prev) => ({
        ...prev,
        [projectName]: { ...(prev[projectName] || ({} as HealthStatus)), loading: false },
      }))
    }
  }

  const handleOpenInVSCode = async (projectName: string) => {
    const project = projects.find((p) => p.name === projectName)
    if (!project) return
    const projectPath = `${workspaceRoot}/${project.path}`
    await window.nexworkAPI.openInVSCode(projectPath)
  }

  const handleOpenInTerminal = async (projectName: string) => {
    const project = projects.find((p) => p.name === projectName)
    if (!project) return
    const projectPath = `${workspaceRoot}/${project.path}`
    await window.nexworkAPI.openInTerminal(projectPath)
  }

  const handleOpenInFinder = async (projectName: string) => {
    const project = projects.find((p) => p.name === projectName)
    if (!project) return
    const projectPath = `${workspaceRoot}/${project.path}`
    await window.nexworkAPI.openInFinder(projectPath)
  }

  if (loading) {
    return (
      <Card style={{ borderRadius: 12 }}>
        <Alert message="Loading workspace health..." type="info" showIcon />
      </Card>
    )
  }

  if (!workspaceRoot) {
    return (
      <Card style={{ borderRadius: 12 }}>
        <Empty
          description={
            <Space direction="vertical" size="small">
              <Text type="secondary">Select a workspace to see health checks.</Text>
              <Button type="primary" icon={<SettingsIcon size={16} />} onClick={onOpenSettings}>
                Open Settings
              </Button>
            </Space>
          }
        />
      </Card>
    )
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card style={{ borderRadius: 12 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <Title level={4} style={{ margin: 0 }}>
                Workspace Health
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Track repo sync status, dirty working trees, and remote availability.
              </Text>
            </div>
            <Space>
              <Button icon={<RefreshCw size={14} />} onClick={() => refreshHealth()} loading={refreshing}>
                Refresh
              </Button>
              <Button type="primary" icon={<ArrowDown size={14} />} onClick={handlePullAll} loading={refreshing}>
                Pull All
              </Button>
            </Space>
          </div>
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}>
              <Card style={{ borderRadius: 10 }}>
                <Text type="secondary">Projects</Text>
                <Title level={3} style={{ margin: 0 }}>
                  {summary.total}
                </Title>
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card style={{ borderRadius: 10 }}>
                <Text type="secondary">Needs Pull</Text>
                <Title level={3} style={{ margin: 0, color: 'var(--color-warning)' }}>
                  {summary.behind}
                </Title>
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card style={{ borderRadius: 10 }}>
                <Text type="secondary">Dirty</Text>
                <Title level={3} style={{ margin: 0, color: 'var(--color-accent)' }}>
                  {summary.dirty}
                </Title>
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card style={{ borderRadius: 10 }}>
                <Text type="secondary">No Remote</Text>
                <Title level={3} style={{ margin: 0, color: 'var(--color-danger)' }}>
                  {summary.noRemote}
                </Title>
              </Card>
            </Col>
          </Row>
        </Space>
      </Card>

      <Card style={{ borderRadius: 12 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <Input
              placeholder="Search projects..."
              prefix={<Search size={14} style={{ opacity: 0.4 }} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 280 }}
            />
            <Segmented
              size="small"
              value={filter}
              onChange={(value) => setFilter(value as typeof filter)}
              options={[
                { label: 'All', value: 'all' },
                { label: 'Needs Pull', value: 'needs_pull' },
                { label: 'Dirty', value: 'dirty' },
                { label: 'No Remote', value: 'no_remote' },
                { label: 'Errors', value: 'errors' },
              ]}
            />
          </div>

          {projects.length === 0 ? (
            <Empty description="No projects discovered in this workspace." />
          ) : filteredProjects.length === 0 ? (
            <Empty description="No projects match your search." />
          ) : (
            <Collapse bordered={false} defaultActiveKey={groupedProjects.map((g) => g.name)}>
              {groupedProjects.map((group) => (
                <Panel
                  key={group.name}
                  header={
                    <div
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
                    >
                      <Space size={8}>
                        <Text strong>
                          {group.name === 'Ungrouped' ? 'Ungrouped (directly in workspace)' : group.name}
                        </Text>
                        <Tag>{group.projects.length}</Tag>
                      </Space>
                      <Button
                        size="small"
                        icon={<ArrowDown size={12} />}
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePullGroup(group.projects)
                        }}
                        loading={refreshing}
                      >
                        Pull Group
                      </Button>
                    </div>
                  }
                >
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    {group.projects.map((project) => {
                      const status = health[project.name]
                      const isBehind = status?.behind > 0
                      const isDirty = status?.dirty
                      const noRemote = status?.noRemote
                      const hasError = !!status?.error
                      const errorText = status?.error?.toLowerCase() || ''
                      const blockedRef = blockedRemotesRef.current[project.name]
                      const pullBlocked =
                        status?.noRemote ||
                        errorText.includes('not found') ||
                        errorText.includes('permission') ||
                        (blockedRef && blockedRef.until > Date.now())
                      const isClean = status && !isBehind && !isDirty && !noRemote && !hasError
                      return (
                        <Card key={project.name} size="small" style={{ borderRadius: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                            <div style={{ minWidth: 0 }}>
                              <Space size={8} style={{ marginBottom: 6 }}>
                                <FolderGit2 size={16} />
                                <Text strong>{project.name}</Text>
                              </Space>
                              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                                {project.path}
                              </Text>
                              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                                Branch: {status?.branch || 'unknown'}
                              </Text>
                            </div>
                            <Space direction="vertical" size={6} style={{ alignItems: 'flex-end' }}>
                              {status?.loading ? (
                                <Tag>Checking...</Tag>
                              ) : isClean ? (
                                <Tag color="success" icon={<CheckCircle2 size={12} />}>
                                  Healthy
                                </Tag>
                              ) : (
                                <>
                                  {isBehind && (
                                    <Tag color="warning" icon={<AlertTriangle size={12} />}>
                                      {status?.behind} behind
                                    </Tag>
                                  )}
                                  {isDirty && <Tag color="processing">Dirty</Tag>}
                                  {noRemote && <Tag color="default">No remote</Tag>}
                                  {hasError && (
                                    <Tag color="error" title={status?.error}>
                                      Remote issue
                                    </Tag>
                                  )}
                                </>
                              )}
                              {status && !status.loading && (status.ahead > 0 || status.behind > 0) && (
                                <Progress
                                  percent={Math.min(100, Math.max(5, status.behind * 10))}
                                  showInfo={false}
                                  size="small"
                                  status={status.behind > 0 ? 'active' : 'success'}
                                  strokeColor={status.behind > 0 ? 'var(--color-warning)' : 'var(--color-success)'}
                                />
                              )}
                              <Space size={6}>
                                <Button
                                  size="small"
                                  onClick={() => handlePullProject(project.name)}
                                  disabled={!!status?.loading || pullBlocked}
                                >
                                  Pull
                                </Button>
                                <Button
                                  size="small"
                                  onClick={() => handleOpenInVSCode(project.name)}
                                  disabled={!!status?.loading}
                                >
                                  VSCode
                                </Button>
                                <Button
                                  size="small"
                                  icon={<FolderOpen size={14} />}
                                  onClick={() => handleOpenInFinder(project.name)}
                                  disabled={!!status?.loading}
                                >
                                  Finder
                                </Button>
                                <Button
                                  size="small"
                                  onClick={() => handleOpenInTerminal(project.name)}
                                  disabled={!!status?.loading}
                                >
                                  Terminal
                                </Button>
                              </Space>
                            </Space>
                          </div>
                        </Card>
                      )
                    })}
                  </Space>
                </Panel>
              ))}
            </Collapse>
          )}
        </Space>
      </Card>
    </Space>
  )
}
