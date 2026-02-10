import { useState, useEffect } from 'react'
import { Layout, Menu, theme, Card, Progress, Badge, Button, Space, Typography, Statistic, Row, Col, Modal, message } from 'antd'
import {
  FolderGit2,
  Plus,
  Settings,
  FileText,
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  Archive,
  Lock
} from 'lucide-react'
import { CreateFeatureModal } from './components/CreateFeatureModal'
import { FeatureDetails } from './pages/FeatureDetails'
import { Settings as SettingsPage } from './pages/Settings'
import type { Feature } from './types'

const { Header, Content, Sider } = Layout
const { Title, Text } = Typography

type View = 'dashboard' | 'feature-details' | 'settings'

function App() {
  const [features, setFeatures] = useState<Feature[]>([])
  const [loading, setLoading] = useState(true)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  // Configure message position to top right
  message.config({
    top: 24,
    duration: 3,
    maxCount: 3,
    rtl: false,
    prefixCls: 'my-message',
    getContainer: () => document.body
  })

  useEffect(() => {
    loadFeatures()

    // Listen for tray menu actions
    const handleOpenCreate = () => setCreateModalOpen(true)
    const handleOpenSettings = () => setCurrentView('settings')

    window.nexworkAPI.on('open-create-dialog', handleOpenCreate)
    window.nexworkAPI.on('open-settings', handleOpenSettings)

    return () => {
      window.nexworkAPI.off('open-create-dialog', handleOpenCreate)
      window.nexworkAPI.off('open-settings', handleOpenSettings)
    }
  }, [])

  const loadFeatures = async () => {
    try {
      const data = await window.nexworkAPI.features.getAll()
      setFeatures(data)
    } catch (error) {
      console.error('Failed to load features:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success'
      case 'in_progress': return 'processing'
      case 'pending': return 'default'
      default: return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 size={16} />
      case 'in_progress': return <Activity size={16} />
      case 'pending': return <Clock size={16} />
      default: return <AlertCircle size={16} />
    }
  }

  const calculateProgress = (feature: Feature) => {
    const completed = feature.projects.filter(p => p.status === 'completed').length
    return Math.round((completed / feature.projects.length) * 100)
  }

  const handleFeatureClick = (featureName: string) => {
    setSelectedFeatureId(featureName)
    setCurrentView('feature-details')
  }

  const handleBackToDashboard = () => {
    setCurrentView('dashboard')
    setSelectedFeatureId(null)
    loadFeatures()
  }

  const handleCreateSuccess = () => {
    loadFeatures()
  }

  const handleCompleteFeature = async (featureName: string, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent card click
    Modal.confirm({
      title: 'Complete Feature',
      content: `Are you sure you want to mark "${featureName}" as complete?`,
      okText: 'Complete',
      okType: 'primary',
      onOk: async () => {
        try {
          await window.nexworkAPI.features.complete(featureName)
          message.success('Feature marked as complete')
          loadFeatures()
        } catch (error) {
          message.error('Failed to complete feature')
          console.error(error)
        }
      }
    })
  }

  const handleDeleteFeature = async (featureName: string, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent card click
    Modal.confirm({
      title: 'Delete Feature',
      content: `Are you sure you want to delete "${featureName}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await window.nexworkAPI.features.delete(featureName)
          message.success('Feature deleted successfully')
          loadFeatures()
        } catch (error) {
          message.error('Failed to delete feature')
          console.error(error)
        }
      }
    })
  }

  const handleMoveToRecent = async (featureName: string, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent card click
    // This would typically update the feature's status or timestamp to move it to "recent"
    message.info('Move to Recent feature coming soon')
  }

  // Render feature details view
  if (currentView === 'feature-details' && selectedFeatureId) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
          <Sider
            breakpoint="lg"
            collapsedWidth="0"
            collapsed={sidebarCollapsed}
            onCollapse={(collapsed) => setSidebarCollapsed(collapsed)}
            style={{
              background: colorBgContainer,
              borderRight: '1px solid #f0f0f0',
            }}
          >
            <Menu
              mode="inline"
              selectedKeys={['dashboard']}
              style={{ marginTop: 64, border: 'none' }}
            items={[
              {
                key: 'dashboard',
                icon: <Activity size={18} />,
                label: 'Dashboard',
                onClick: handleBackToDashboard
              },
              {
                key: 'features',
                icon: <FolderGit2 size={18} />,
                label: (
                  <Space>
                    Features
                    <Badge count="Coming Soon" style={{ backgroundColor: '#faad14' }} />
                  </Space>
                ),
                disabled: true,
              },
              {
                key: 'templates',
                icon: <FileText size={18} />,
                label: (
                  <Space>
                    Templates
                    <Badge count="Coming Soon" style={{ backgroundColor: '#faad14' }} />
                  </Space>
                ),
                disabled: true,
              },
              {
                key: 'settings',
                icon: <Settings size={18} />,
                label: 'Settings',
                onClick: () => setCurrentView('settings')
              },
            ]}
          />
        </Sider>
        <Layout>
          <Header style={{ 
            padding: '0 24px', 
            background: colorBgContainer, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            paddingLeft: 24,
            borderBottom: '1px solid #f0f0f0',
            height: 64
          }}>
            <Title level={3} style={{ margin: 0, fontWeight: 600 }}>{selectedFeatureId}</Title>
          </Header>
          <Content style={{ margin: '24px 16px 0', overflow: 'auto', maxHeight: 'calc(100vh - 64px - 24px)' }}>
            <div style={{ padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG }}>
              <FeatureDetails featureName={selectedFeatureId} onBack={handleBackToDashboard} />
            </div>
          </Content>
        </Layout>
      </Layout>
    )
  }

  // Render settings view
  if (currentView === 'settings') {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Sider
          breakpoint="lg"
          collapsedWidth="0"
          collapsed={sidebarCollapsed}
          onCollapse={(collapsed) => setSidebarCollapsed(collapsed)}
          style={{
            background: colorBgContainer,
            borderRight: '1px solid #f0f0f0',
          }}
        >
          <Menu
            mode="inline"
            selectedKeys={['settings']}
            style={{ marginTop: 64, border: 'none' }}
            items={[
              {
                key: 'dashboard',
                icon: <Activity size={18} />,
                label: 'Dashboard',
                onClick: () => {
                  setCurrentView('dashboard')
                  setSelectedFeatureId(null)
                }
              },
               {
                key: 'features',
                icon: <Lock size={18} style={{ opacity: 0.5 }} />,
                label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>Features</span>
                    <Badge 
                      count="Soon" 
                      style={{ 
                        backgroundColor: '#faad14',
                        fontSize: 10,
                        height: 18,
                        lineHeight: '18px',
                        padding: '0 6px'
                      }} 
                    />
                  </div>
                ),
                disabled: true,
              },
              {
                key: 'templates',
                icon: <Lock size={18} style={{ opacity: 0.5 }} />,
                label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>Templates</span>
                    <Badge 
                      count="Soon" 
                      style={{ 
                        backgroundColor: '#faad14',
                        fontSize: 10,
                        height: 18,
                        lineHeight: '18px',
                        padding: '0 6px'
                      }} 
                    />
                  </div>
                ),
                disabled: true,
              },
              {
                key: 'settings',
                icon: <Settings size={18} />,
                label: 'Settings',
              },
            ]}
          />
        </Sider>
        <Layout>
          <Header style={{ 
            padding: '0 24px', 
            background: colorBgContainer, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            paddingLeft: 24,
            borderBottom: '1px solid #f0f0f0',
            height: 64
          }}>
            <Title level={3} style={{ margin: 0, fontWeight: 600 }}>Settings</Title>
          </Header>
          <Content style={{ margin: '24px 16px 0', overflow: 'auto', maxHeight: 'calc(100vh - 64px - 24px)' }}>
            <div style={{ padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG }}>
              <SettingsPage />
            </div>
          </Content>
        </Layout>
      </Layout>
    )
  }

  // Render dashboard view
  return (
    <Layout style={{ minHeight: '100vh' }}>
        <Sider
          breakpoint="lg"
          collapsedWidth="0"
          collapsed={sidebarCollapsed}
          onCollapse={(collapsed) => setSidebarCollapsed(collapsed)}
          style={{
            background: colorBgContainer,
            borderRight: '1px solid #f0f0f0',
          }}
        >
          <Menu
            style={{ marginTop: 64, border: 'none' }}
          mode="inline"
          selectedKeys={[currentView === 'dashboard' ? 'dashboard' : currentView]}
          items={[
            {
              key: 'dashboard',
              icon: <Activity size={18} />,
              label: 'Dashboard',
              onClick: () => {
                setCurrentView('dashboard')
                setSelectedFeatureId(null)
              }
            },
              {
                key: 'features',
                icon: <Lock size={18} style={{ opacity: 0.5 }} />,
                label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>Features</span>
                    <Badge 
                      count="Soon" 
                      style={{ 
                        backgroundColor: '#faad14',
                        fontSize: 10,
                        height: 18,
                        lineHeight: '18px',
                        padding: '0 6px'
                      }} 
                    />
                  </div>
                ),
                disabled: true,
              },
              {
                key: 'templates',
                icon: <Lock size={18} style={{ opacity: 0.5 }} />,
                label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>Templates</span>
                    <Badge 
                      count="Soon" 
                      style={{ 
                        backgroundColor: '#faad14',
                        fontSize: 10,
                        height: 18,
                        lineHeight: '18px',
                        padding: '0 6px'
                      }} 
                    />
                  </div>
                ),
                disabled: true,
              },
            {
              key: 'settings',
              icon: <Settings size={18} />,
              label: 'Settings',
              onClick: () => setCurrentView('settings')
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ 
          padding: '0 24px', 
          background: colorBgContainer, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          paddingLeft: 24,
          borderBottom: '1px solid #f0f0f0',
          height: 64
        }}>
          <Title level={3} style={{ margin: 0, fontWeight: 600 }}>
            {currentView === 'dashboard' ? 'Dashboard' : currentView === 'settings' ? 'Settings' : selectedFeatureId || 'Feature Details'}
          </Title>
          <Button type="primary" icon={<Plus size={16} />} size="large" onClick={() => setCreateModalOpen(true)}>
            Create Feature
          </Button>
        </Header>
        <Content style={{ margin: '24px 16px 0', overflow: 'auto', maxHeight: 'calc(100vh - 64px - 24px)' }}>
          <div style={{ padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG }}>
            {/* Statistics */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Total Features"
                    value={features.length}
                    prefix={<FolderGit2 size={20} />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="In Progress"
                    value={features.filter(f => f.projects.some(p => p.status === 'in_progress')).length}
                    prefix={<Activity size={20} />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Completed"
                    value={features.filter(f => f.projects.every(p => p.status === 'completed')).length}
                    prefix={<CheckCircle2 size={20} />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Pending"
                    value={features.filter(f => f.projects.every(p => p.status === 'pending')).length}
                    prefix={<Clock size={20} />}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>
            </Row>

            {/* Feature List */}
            <Title level={4} style={{ marginBottom: 16 }}>Recent Features</Title>
            <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
              {features.map((feature) => (
                <Card
                  key={feature.name}
                  hoverable
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleFeatureClick(feature.name)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <Space>
                        <Badge status={getStatusColor(feature.projects[0]?.status || 'pending')} />
                        <Title level={5} style={{ margin: 0 }}>{feature.name}</Title>
                      </Space>
                      <div style={{ marginTop: 12 }}>
                        <Space size="large">
                          {feature.projects.map((project) => (
                            <Space key={project.name} size={4}>
                              {getStatusIcon(project.status)}
                              <Text>{project.name}</Text>
                            </Space>
                          ))}
                        </Space>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <Space size={12}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Created: {new Date(feature.createdAt).toLocaleDateString()}
                          </Text>
                          {feature.expiresAt && (() => {
                            const expiresDate = new Date(feature.expiresAt)
                            const now = new Date()
                            const daysRemaining = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                            const isExpired = daysRemaining < 0
                            const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0
                            
                            return (
                              <Text 
                                type={isExpired ? 'danger' : isExpiringSoon ? 'warning' : 'secondary'} 
                                style={{ fontSize: 12 }}
                              >
                                {isExpired 
                                  ? `⚠️ Expired`
                                  : `⏱️ ${daysRemaining}d left`
                                }
                              </Text>
                            )
                          })()}
                        </Space>
                      </div>
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
                          <Button 
                            size="small" 
                            icon={<Archive size={14} />}
                            onClick={(e) => handleMoveToRecent(feature.name, e)}
                          >
                            Move to Recent
                          </Button>
                        </Space>
                      </div>
                    </div>
                    <div style={{ minWidth: 200 }}>
                      <Progress
                        percent={calculateProgress(feature)}
                        status={calculateProgress(feature) === 100 ? 'success' : 'active'}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {feature.projects.filter(p => p.status === 'completed').length} of {feature.projects.length} completed
                      </Text>
                    </div>
                  </div>
                </Card>
              ))}
              
              {features.length === 0 && !loading && (
                <Card>
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <FolderGit2 size={48} style={{ color: '#d9d9d9', marginBottom: 16 }} />
                    <Title level={4} type="secondary">No Features Yet</Title>
                    <Text type="secondary">Create your first feature to get started</Text>
                    <br />
                    <Button type="primary" icon={<Plus size={16} />} style={{ marginTop: 16 }} onClick={() => setCreateModalOpen(true)}>
                      Create Feature
                    </Button>
                  </div>
                </Card>
              )}
            </Space>
          </div>
        </Content>
      </Layout>

      {/* Create Feature Modal */}
      <CreateFeatureModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </Layout>
  )
}

export default App
