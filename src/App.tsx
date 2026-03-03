import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Layout,
  Menu,
  theme,
  Card,
  Progress,
  Button,
  Space,
  Typography,
  Statistic,
  Row,
  Col,
  Modal,
  message,
  Skeleton,
  Input,
  Segmented,
} from 'antd'
import {
  FolderGit2,
  Plus,
  Settings,
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  Search,
  History,
  LogOut,
  User,
} from 'lucide-react'
import { CreateFeatureModal } from './components/CreateFeatureModal'
import { FeatureDetails } from './pages/FeatureDetails'
import { Settings as SettingsPage } from './pages/Settings'
import { ActivityLog } from './pages/ActivityLog'
import { GitAuth } from './pages/GitAuth'
import { ErrorBoundary } from './components/ErrorBoundary'
import type { Feature } from './types'

const { Header, Content, Sider } = Layout
const { Title, Text } = Typography

type View = 'dashboard' | 'feature-details' | 'settings' | 'activity' | 'git-auth'

type StatusFilter = 'all' | 'in_progress' | 'completed' | 'pending' | 'expired'

const getMenuItems = (handlers: { onDashboard: () => void; onActivity: () => void; onSettings: () => void }) => [
  {
    key: 'dashboard',
    icon: <Activity size={18} />,
    label: 'Dashboard',
    onClick: handlers.onDashboard,
  },
  {
    key: 'activity',
    icon: <History size={18} />,
    label: 'Activity',
    onClick: handlers.onActivity,
  },
  {
    key: 'settings',
    icon: <Settings size={18} />,
    label: 'Settings',
    onClick: handlers.onSettings,
  },
]

function App() {
  const [features, setFeatures] = useState<Feature[]>([])
  const [loading, setLoading] = useState(true)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [authUser, setAuthUser] = useState('')
  const [authAvatar, setAuthAvatar] = useState('')
  const [_authProvider, setAuthProvider] = useState('')
  const [_authChecked, setAuthChecked] = useState(false)
  const {
    token: { colorBgContainer },
  } = theme.useToken()

  useEffect(() => {
    // Check auth on startup
    window.nexworkAPI.gitAuth
      .checkAuth()
      .then((auth) => {
        if (auth.authenticated) {
          setAuthUser(auth.user)
          setAuthAvatar(auth.avatar)
          setAuthProvider(auth.provider)
          loadFeatures()
        } else {
          setCurrentView('git-auth')
          setLoading(false)
        }
        setAuthChecked(true)
      })
      .catch(() => {
        setCurrentView('git-auth')
        setLoading(false)
        setAuthChecked(true)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadFeatures = async () => {
    try {
      const data = await window.nexworkAPI.features.getAll()
      setFeatures(data)
    } catch {
      // Workspace may not be set yet
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={14} style={{ color: 'var(--color-success)' }} />
      case 'in_progress':
        return <Activity size={14} style={{ color: 'var(--color-accent)' }} />
      case 'pending':
        return <Clock size={14} style={{ opacity: 0.4 }} />
      default:
        return <AlertCircle size={14} style={{ opacity: 0.4 }} />
    }
  }

  const calculateProgress = (feature: Feature) => {
    const completed = feature.projects.filter((p) => p.status === 'completed').length
    return Math.round((completed / feature.projects.length) * 100)
  }

  const handleFeatureClick = (featureName: string) => {
    setSelectedFeatureId(featureName)
    setCurrentView('feature-details')
  }

  const handleAuthenticated = useCallback((info: { provider: string; user: string; avatar: string }) => {
    setAuthUser(info.user)
    setAuthAvatar(info.avatar)
    setAuthProvider(info.provider)
    setCurrentView('dashboard')
    loadFeatures()
  }, [])

  const handleLogout = useCallback(async () => {
    await window.nexworkAPI.gitAuth.logout()
    setAuthUser('')
    setAuthAvatar('')
    setAuthProvider('')
    setCurrentView('git-auth')
  }, [])

  const handleBackToDashboard = useCallback(() => {
    setCurrentView('dashboard')
    setSelectedFeatureId(null)
    loadFeatures()
  }, [])

  const handleCreateFeature = useCallback(async () => {
    try {
      const config = await window.nexworkAPI.config.load()
      if (!config?.workspaceRoot) {
        message.warning('Please select a workspace in Settings before creating a feature.')
        setCurrentView('settings')
        return
      }
      setCreateModalOpen(true)
    } catch {
      message.warning('Please select a workspace in Settings before creating a feature.')
      setCurrentView('settings')
    }
  }, [])

  useEffect(() => {
    const handleOpenCreate = () => handleCreateFeature()
    const handleOpenSettings = () => setCurrentView('settings')

    window.nexworkAPI.on('open-create-dialog', handleOpenCreate)
    window.nexworkAPI.on('open-settings', handleOpenSettings)

    return () => {
      window.nexworkAPI.off('open-create-dialog', handleOpenCreate)
      window.nexworkAPI.off('open-settings', handleOpenSettings)
    }
  }, [handleCreateFeature])

  const handleCompleteFeature = (featureName: string, event: React.MouseEvent) => {
    event.stopPropagation()
    Modal.confirm({
      title: 'Complete Feature',
      content: `Mark "${featureName}" as complete?`,
      okText: 'Complete',
      okType: 'primary',
      onOk: async () => {
        try {
          await window.nexworkAPI.features.complete(featureName)
          message.success('Feature marked as complete')
          loadFeatures()
        } catch {
          message.error('Failed to complete feature')
        }
      },
    })
  }

  const handleDeleteFeature = (featureName: string, event: React.MouseEvent) => {
    event.stopPropagation()
    Modal.confirm({
      title: 'Delete Feature',
      content: `Delete "${featureName}"? This cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await window.nexworkAPI.features.delete(featureName)
          message.success('Feature deleted')
          loadFeatures()
        } catch {
          message.error('Failed to delete feature')
        }
      },
    })
  }

  // Stat computations
  const stats = useMemo(() => {
    const inProgress = features.filter((f) => f.projects.some((p) => p.status === 'in_progress')).length
    const completed = features.filter((f) => f.projects.every((p) => p.status === 'completed')).length
    const pending = features.filter((f) => f.projects.every((p) => p.status === 'pending')).length
    return { total: features.length, inProgress, completed, pending }
  }, [features])

  // Filtered features
  const filteredFeatures = useMemo(() => {
    let result = features

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (f) => f.name.toLowerCase().includes(q) || f.projects.some((p) => p.name.toLowerCase().includes(q)),
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((f) => {
        if (statusFilter === 'expired') {
          return f.expiresAt && new Date(f.expiresAt).getTime() < Date.now()
        }
        if (statusFilter === 'completed') {
          return f.projects.every((p) => p.status === 'completed')
        }
        if (statusFilter === 'in_progress') {
          return f.projects.some((p) => p.status === 'in_progress')
        }
        // pending
        return f.projects.every((p) => p.status === 'pending')
      })
    }

    return result
  }, [features, searchQuery, statusFilter])

  const menuItems = useMemo(
    () =>
      getMenuItems({
        onDashboard: handleBackToDashboard,
        onActivity: () => setCurrentView('activity'),
        onSettings: () => setCurrentView('settings'),
      }),
    [handleBackToDashboard],
  )

  const selectedMenuKey = currentView === 'feature-details' ? 'dashboard' : currentView

  const pageTitle =
    currentView === 'settings'
      ? 'Settings'
      : currentView === 'activity'
        ? 'Activity'
        : currentView === 'feature-details'
          ? selectedFeatureId || 'Feature'
          : 'Dashboard'

  // Render content based on current view
  const renderContent = () => {
    if (currentView === 'git-auth') {
      return null // git-auth is rendered outside the Layout
    }

    if (currentView === 'feature-details' && selectedFeatureId) {
      return (
        <ErrorBoundary fallbackTitle="Failed to load feature details">
          <FeatureDetails featureName={selectedFeatureId} onBack={handleBackToDashboard} />
        </ErrorBoundary>
      )
    }

    if (currentView === 'settings') {
      return (
        <ErrorBoundary fallbackTitle="Failed to load settings">
          <SettingsPage />
        </ErrorBoundary>
      )
    }

    if (currentView === 'activity') {
      return (
        <ErrorBoundary fallbackTitle="Failed to load activity log">
          <ActivityLog />
        </ErrorBoundary>
      )
    }

    // Dashboard
    return (
      <ErrorBoundary fallbackTitle="Failed to load dashboard">
        {/* Statistics */}
        <Row gutter={[16, 16]} style={{ marginBottom: 28 }}>
          {[
            { title: 'Total Features', value: stats.total, icon: <FolderGit2 size={18} />, color: undefined },
            {
              title: 'In Progress',
              value: stats.inProgress,
              icon: <Activity size={18} />,
              color: 'var(--color-accent)',
            },
            {
              title: 'Completed',
              value: stats.completed,
              icon: <CheckCircle2 size={18} />,
              color: 'var(--color-success)',
            },
            { title: 'Pending', value: stats.pending, icon: <Clock size={18} />, color: 'var(--color-warning)' },
          ].map((stat) => (
            <Col xs={12} md={6} key={stat.title}>
              <Card className="stat-card" style={{ borderRadius: 12 }}>
                <Statistic
                  title={stat.title}
                  value={stat.value}
                  prefix={stat.icon}
                  valueStyle={stat.color ? { color: stat.color } : undefined}
                />
              </Card>
            </Col>
          ))}
        </Row>

        {/* Search & Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search features or projects..."
            prefix={<Search size={14} style={{ opacity: 0.4 }} />}
            allowClear
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ maxWidth: 280 }}
          />
          <Segmented
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            options={[
              { label: 'All', value: 'all' },
              { label: 'In Progress', value: 'in_progress' },
              { label: 'Completed', value: 'completed' },
              { label: 'Pending', value: 'pending' },
              { label: 'Expired', value: 'expired' },
            ]}
            size="small"
          />
        </div>

        {loading ? (
          <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
            {[1, 2, 3].map((i) => (
              <Card key={i} style={{ borderRadius: 12 }}>
                <Skeleton active paragraph={{ rows: 2 }} />
              </Card>
            ))}
          </Space>
        ) : features.length === 0 ? (
          <Card style={{ borderRadius: 12 }}>
            <div className="empty-state" style={{ textAlign: 'center', padding: '48px 0' }}>
              <FolderGit2 size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
              <Title level={4} type="secondary" style={{ fontWeight: 500 }}>
                No Features Yet
              </Title>
              <Text type="secondary">Create your first feature to get started</Text>
              <br />
              <Button type="primary" icon={<Plus size={16} />} style={{ marginTop: 20 }} onClick={handleCreateFeature}>
                Create Feature
              </Button>
            </div>
          </Card>
        ) : filteredFeatures.length === 0 ? (
          <Card style={{ borderRadius: 12 }}>
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <Search size={36} style={{ opacity: 0.12, marginBottom: 12 }} />
              <Text type="secondary" style={{ display: 'block' }}>
                No features match your search
              </Text>
            </div>
          </Card>
        ) : (
          <Space direction="vertical" size={12} style={{ display: 'flex' }}>
            {filteredFeatures.map((feature) => {
              const progress = calculateProgress(feature)
              return (
                <Card
                  key={feature.name}
                  className="feature-card"
                  style={{ borderRadius: 12 }}
                  onClick={() => handleFeatureClick(feature.name)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Feature name + status dot */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background:
                              progress === 100
                                ? 'var(--color-success)'
                                : feature.projects.some((p) => p.status === 'in_progress')
                                  ? 'var(--color-accent)'
                                  : 'var(--color-warning)',
                            flexShrink: 0,
                          }}
                        />
                        <Title level={5} style={{ margin: 0, fontWeight: 600 }} ellipsis>
                          {feature.name}
                        </Title>
                      </div>

                      {/* Projects list */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
                        {feature.projects.map((project) => (
                          <Space key={project.name} size={4} style={{ fontSize: 13 }}>
                            {getStatusIcon(project.status)}
                            <Text style={{ fontSize: 13 }}>{project.name}</Text>
                          </Space>
                        ))}
                      </div>

                      {/* Meta */}
                      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(feature.createdAt).toLocaleDateString()}
                        </Text>
                        {feature.expiresAt &&
                          (() => {
                            const daysRemaining = Math.ceil(
                              (new Date(feature.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                            )
                            return (
                              <Text
                                type={daysRemaining < 0 ? 'danger' : daysRemaining <= 7 ? 'warning' : 'secondary'}
                                style={{ fontSize: 12 }}
                              >
                                {daysRemaining < 0 ? 'Expired' : `${daysRemaining}d left`}
                              </Text>
                            )
                          })()}
                      </div>

                      {/* Actions */}
                      <div style={{ marginTop: 12 }}>
                        <Space size={8}>
                          <Button
                            size="small"
                            type="primary"
                            icon={<CheckCircle2 size={14} />}
                            onClick={(e) => handleCompleteFeature(feature.name, e)}
                          >
                            Complete
                          </Button>
                          <Button
                            size="small"
                            danger
                            icon={<Trash2 size={14} />}
                            onClick={(e) => handleDeleteFeature(feature.name, e)}
                          >
                            Delete
                          </Button>
                        </Space>
                      </div>
                    </div>

                    {/* Progress */}
                    <div style={{ minWidth: 160, textAlign: 'right' }}>
                      <Progress
                        percent={progress}
                        status={progress === 100 ? 'success' : 'active'}
                        strokeColor={progress === 100 ? 'var(--color-success)' : 'var(--color-accent)'}
                        size="small"
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {feature.projects.filter((p) => p.status === 'completed').length}/{feature.projects.length}{' '}
                        completed
                      </Text>
                    </div>
                  </div>
                </Card>
              )
            })}
          </Space>
        )}
      </ErrorBoundary>
    )
  }

  // Render full-screen auth page without sidebar
  if (currentView === 'git-auth') {
    return <GitAuth onAuthenticated={handleAuthenticated} />
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth="0"
        collapsed={sidebarCollapsed}
        onCollapse={(collapsed) => setSidebarCollapsed(collapsed)}
        style={{ background: colorBgContainer, display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* App logo area — padded below macOS traffic lights */}
          <div
            style={{
              height: 64,
              marginTop: 28,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: sidebarCollapsed ? 0 : '0 20px',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              borderBottom: '1px solid rgba(128,128,128,0.08)',
            }}
          >
            {!sidebarCollapsed && (
              <>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, var(--color-accent), #7c5cfc)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <FolderGit2 size={15} style={{ color: '#fff' }} />
                </div>
                <Text strong style={{ fontSize: 16, letterSpacing: '-0.3px' }}>
                  Nexwork
                </Text>
              </>
            )}
          </div>

          {/* Navigation */}
          <Menu
            mode="inline"
            selectedKeys={[selectedMenuKey]}
            items={menuItems}
            style={{ border: 'none', marginTop: 8, flex: 1 }}
          />

          {/* User & Version footer */}
          {!sidebarCollapsed && (
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid rgba(128,128,128,0.08)',
              }}
            >
              {authUser && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    {authAvatar ? (
                      <img src={authAvatar} alt="" style={{ width: 22, height: 22, borderRadius: '50%' }} />
                    ) : (
                      <User size={14} style={{ opacity: 0.5 }} />
                    )}
                    <Text style={{ fontSize: 12, flex: 1 }} ellipsis>
                      {authUser}
                    </Text>
                  </div>
                  <Button
                    type="text"
                    size="small"
                    icon={<LogOut size={12} />}
                    onClick={handleLogout}
                    style={{ padding: '2px 0', height: 'auto', fontSize: 11, color: 'inherit', opacity: 0.5 }}
                  >
                    Switch Account
                  </Button>
                </div>
              )}
              <Text type="secondary" style={{ fontSize: 11 }}>
                v1.0.11
              </Text>
            </div>
          )}
        </div>
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 64,
            borderBottom: '1px solid rgba(128,128,128,0.08)',
          }}
        >
          <Title level={4} style={{ margin: 0, fontWeight: 600 }}>
            {pageTitle}
          </Title>
          {currentView === 'dashboard' && (
            <Button type="primary" icon={<Plus size={16} />} onClick={handleCreateFeature}>
              Create Feature
            </Button>
          )}
        </Header>
        <Content style={{ padding: 24, overflow: 'auto', maxHeight: 'calc(100vh - 64px)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>{renderContent()}</div>
        </Content>
      </Layout>

      <CreateFeatureModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => loadFeatures()}
      />
    </Layout>
  )
}

export default App
