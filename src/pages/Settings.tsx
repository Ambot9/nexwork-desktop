import { useState, useEffect } from 'react'
import { Card, Form, Input, Select, Button, Space, Typography, Divider, Switch, message, Tag, Alert, Row, Col, Tooltip } from 'antd'
import { FolderOpen, Save, RefreshCw, Bot, Lock, Sun, Moon, Monitor, Check, Play, Music, Zap, Bell, CircleDot, Headphones, Volume2, Radio, Square, HelpCircle, Info } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { SelectableCard } from '../components/SelectableCard'
import { playNotificationSound, stopNotificationSound } from '../utils/sounds'
import type { Config } from '../types'

const { Title, Text, Paragraph } = Typography
const { Option } = Select
const { Password } = Input

type ThemeMode = 'system' | 'light' | 'dark' | 'ember' | 'monokai' | 'oneDarkPro'

interface ThemeOption {
  id: ThemeMode
  name: string
  author: string
  background: string
  textColors: {
    prompt: string
    command: string
    output: string
  }
  dots?: string[]
}

interface NotificationSound {
  id: string
  name: string
  description: string
  icon: any
  duration: string
  emoji: string
}

const notificationSounds: NotificationSound[] = [
  { id: 'shamisen', name: 'Shamisen', description: 'Japanese string instrument', icon: Music, duration: '1s', emoji: '🪕' },
  { id: 'arcade', name: 'Arcade', description: 'Retro game sounds', icon: CircleDot, duration: '3s', emoji: '🕹️' },
  { id: 'ping', name: 'Ping', description: 'Quick alert tone', icon: Bell, duration: '1s', emoji: '📍' },
  { id: 'quickPing', name: 'Quick Ping', description: 'Short & sweet', icon: Zap, duration: '3s', emoji: '⚡' },
  { id: 'dooWap', name: 'Doo-Wap', description: 'Retro vibes', icon: Radio, duration: '10s', emoji: '🎷' },
  { id: 'agentDone', name: 'Agent is Done', description: 'Your agent is done!', icon: Bot, duration: '8s', emoji: '🤖' },
  { id: 'codeComplete', name: 'Code Complete', description: 'World music energy', icon: Volume2, duration: '9s', emoji: '🌍' },
  { id: 'afrobeatComplete', name: 'Afrobeat Code Complete', description: 'Groovy celebration', icon: Music, duration: '9s', emoji: '🥁' },
  { id: 'longEDM', name: 'Long EDM', description: 'Bass goes brrrr', icon: Headphones, duration: '56s', emoji: '🎧' },
  { id: 'comeBack', name: 'Come Back!', description: 'Code needs you', icon: Bell, duration: '7s', emoji: '📢' },
  { id: 'shabalaba', name: 'Shabalaba', description: 'Ding dong vibes', icon: Music, duration: '7s', emoji: '🎉' }
]

const themes: ThemeOption[] = [
  {
    id: 'system',
    name: 'System',
    author: 'Follows OS preference',
    background: 'linear-gradient(90deg, #1f1f1f 50%, #ffffff 50%)',
    textColors: { prompt: '#888', command: '#888', output: '#888' }
  },
  {
    id: 'light',
    name: 'Light',
    author: 'Nexwork',
    background: '#ffffff',
    textColors: { prompt: '#52c41a', command: '#1890ff', output: '#faad14' },
    dots: ['#ff4d4f', '#52c41a', '#faad14', '#1890ff', '#722ed1', '#13c2c2']
  },
  {
    id: 'dark',
    name: 'Dark',
    author: 'Nexwork',
    background: '#1f1f1f',
    textColors: { prompt: '#52c41a', command: '#61dafb', output: '#ffd700' },
    dots: ['#ff6b6b', '#4ecdc4', '#ffe66d', '#4a9eff', '#ff6bcb', '#51d9e8']
  },
  {
    id: 'ember',
    name: 'Ember',
    author: 'Superset',
    background: '#16191f',
    textColors: { prompt: '#52c41a', command: '#61dafb', output: '#d4976c' },
    dots: ['#ff8a80', '#69f0ae', '#ffd180', '#82b1ff', '#ea80fc', '#80d8ff']
  },
  {
    id: 'monokai',
    name: 'Monokai',
    author: 'Wimer Hazenberg',
    background: '#272822',
    textColors: { prompt: '#52c41a', command: '#61dafb', output: '#d4976c' },
    dots: ['#f92672', '#a6e22e', '#f4bf75', '#66d9ef', '#ae81ff', '#66d9ef']
  },
  {
    id: 'oneDarkPro',
    name: 'One Dark Pro',
    author: 'Atom',
    background: '#282c34',
    textColors: { prompt: '#98c379', command: '#61afef', output: '#d19a66' },
    dots: ['#e06c75', '#98c379', '#e5c07b', '#61afef', '#c678dd', '#56b6c2']
  }
]

export function Settings() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<Config | null>(null)
  const [availableTemplates, setAvailableTemplates] = useState<string[]>([])
  const [aiEnabled, setAiEnabled] = useState(false)
  const { theme: selectedTheme, setTheme: setSelectedTheme, isDark } = useTheme()
  const [notificationSoundsEnabled, setNotificationSoundsEnabled] = useState(true)
  const [selectedSound, setSelectedSound] = useState('codeComplete')
  const [playingSound, setPlayingSound] = useState<string | null>(null)
  const [startOnStartup, setStartOnStartup] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const [configData, templates] = await Promise.all([
        window.nexworkAPI.config.load(),
        window.nexworkAPI.templates.getAll()
      ])
      
      
      setConfig(configData)
      setAvailableTemplates(templates)
      
      // Load notification preferences from electron-store (more reliable than localStorage)
      try {
        const [notifEnabledRes, soundRes, aiEnabledRes, aiProviderRes, aiApiKeyRes, aiModelRes, templateRes, searchPathsRes, excludeRes] = await Promise.all([
          window.nexworkAPI.settings.get('notificationSoundsEnabled'),
          window.nexworkAPI.settings.get('notificationSound'),
          window.nexworkAPI.settings.get('aiEnabled'),
          window.nexworkAPI.settings.get('aiProvider'),
          window.nexworkAPI.settings.get('aiApiKey'),
          window.nexworkAPI.settings.get('aiModel'),
          window.nexworkAPI.settings.get('defaultTemplate'),
          window.nexworkAPI.settings.get('searchPaths'),
          window.nexworkAPI.settings.get('exclude')
        ])
        
        // Apply saved settings if they exist
        if (notifEnabledRes.success && notifEnabledRes.value !== undefined) {
          setNotificationSoundsEnabled(notifEnabledRes.value)
        } else {
          // Fallback to localStorage
          const savedNotifEnabled = localStorage.getItem('notificationSoundsEnabled')
          if (savedNotifEnabled !== null) {
            setNotificationSoundsEnabled(savedNotifEnabled === 'true')
          }
        }
        
        if (soundRes.success && soundRes.value) {
          setSelectedSound(soundRes.value)
        } else {
          // Fallback to localStorage
          const savedSound = localStorage.getItem('notificationSound')
          if (savedSound) {
            setSelectedSound(savedSound)
          }
        }
        
        // Load AI settings
        if (aiEnabledRes.success && aiEnabledRes.value !== undefined) {
          setAiEnabled(aiEnabledRes.value)
        }
        
        // Build form values from electron-store settings or config
        const formValues: any = {
          workspaceRoot: configData.workspaceRoot,
          searchPaths: searchPathsRes.success && searchPathsRes.value 
            ? searchPathsRes.value 
            : (configData.userConfig?.searchPaths?.join(', ') || '*'),
          exclude: excludeRes.success && excludeRes.value 
            ? excludeRes.value 
            : (configData.userConfig?.exclude?.join(', ') || 'node_modules, dist, build'),
          defaultTemplate: templateRes.success && templateRes.value 
            ? templateRes.value 
            : (configData.userConfig?.defaultTemplate || 'default'),
          aiProvider: aiProviderRes.success && aiProviderRes.value 
            ? aiProviderRes.value 
            : (configData.userConfig?.ai?.provider || 'claude'),
          aiApiKey: aiApiKeyRes.success && aiApiKeyRes.value 
            ? aiApiKeyRes.value 
            : (configData.userConfig?.ai?.apiKey || ''),
          aiModel: aiModelRes.success && aiModelRes.value 
            ? aiModelRes.value 
            : (configData.userConfig?.ai?.model || 'claude-3-5-sonnet-20241022')
        }
        
        form.setFieldsValue(formValues)
      } catch (storageError) {
        console.warn('Could not load from electron-store, using localStorage fallback:', storageError)
        
        // Fallback to localStorage
        const savedNotifEnabled = localStorage.getItem('notificationSoundsEnabled')
        const savedSound = localStorage.getItem('notificationSound')
        if (savedNotifEnabled !== null) {
          setNotificationSoundsEnabled(savedNotifEnabled === 'true')
        }
        if (savedSound) {
          setSelectedSound(savedSound)
        }
        
        // Set form values from config
        const formValues = {
          workspaceRoot: configData.workspaceRoot,
          searchPaths: configData.userConfig?.searchPaths?.join(', ') || '*',
          exclude: configData.userConfig?.exclude?.join(', ') || 'node_modules, dist, build',
          defaultTemplate: configData.userConfig?.defaultTemplate || 'default',
          aiProvider: configData.userConfig?.ai?.provider || 'claude',
          aiApiKey: configData.userConfig?.ai?.apiKey || '',
          aiModel: configData.userConfig?.ai?.model || 'claude-3-5-sonnet-20241022'
        }
        
        setAiEnabled(!!configData.userConfig?.ai?.enabled)
        form.setFieldsValue(formValues)
      }
      
      // Load startup preference from localStorage
      const savedStartup = localStorage.getItem('startOnStartup')
      if (savedStartup !== null) {
        setStartOnStartup(savedStartup === 'true')
      }
      
      // Force form to re-render to show values
      setTimeout(() => {
      }, 100)
    } catch (error) {
      console.error('Failed to load settings:', error)
      message.error('Failed to load settings')
    }
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      const values = await form.validateFields()
      
      const updatedConfig: Config = {
        workspaceRoot: values.workspaceRoot,
        projects: config?.projects || [],
        features: config?.features || [],
        userConfig: {
          searchPaths: values.searchPaths.split(',').map((s: string) => s.trim()),
          exclude: values.exclude.split(',').map((s: string) => s.trim()),
          defaultTemplate: values.defaultTemplate,
          ai: {
            enabled: aiEnabled,
            provider: values.aiProvider,
            apiKey: values.aiApiKey,
            model: values.aiModel
          }
        }
      }
      
      await window.nexworkAPI.config.save(updatedConfig)
      
      // Save notification preferences to localStorage (for quick access)
      localStorage.setItem('notificationSoundsEnabled', notificationSoundsEnabled.toString())
      localStorage.setItem('notificationSound', selectedSound)
      
      // Save all settings to electron-store for persistence
      await window.nexworkAPI.settings.set('notificationSoundsEnabled', notificationSoundsEnabled)
      await window.nexworkAPI.settings.set('notificationSound', selectedSound)
      await window.nexworkAPI.settings.set('aiEnabled', aiEnabled)
      await window.nexworkAPI.settings.set('aiProvider', values.aiProvider)
      await window.nexworkAPI.settings.set('aiApiKey', values.aiApiKey)
      await window.nexworkAPI.settings.set('aiModel', values.aiModel)
      await window.nexworkAPI.settings.set('defaultTemplate', values.defaultTemplate)
      await window.nexworkAPI.settings.set('searchPaths', values.searchPaths)
      await window.nexworkAPI.settings.set('exclude', values.exclude)
      
      message.success('Settings saved successfully!')
      setConfig(updatedConfig)
    } catch (error: any) {
      console.error('Failed to save settings:', error)
      message.error(error.message || 'Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectWorkspace = async () => {
    try {
      const selectedPath = await window.nexworkAPI.selectFolder()
      
      if (selectedPath) {
        // Update the workspace in the backend first (this also discovers projects)
        await window.nexworkAPI.config.setWorkspace(selectedPath)
        
        // Update form field
        form.setFieldValue('workspaceRoot', selectedPath)
        
        // Update local config state immediately to refresh the display
        setConfig(prev => prev ? { ...prev, workspaceRoot: selectedPath } : null)
        
        message.success(`Workspace updated to: ${selectedPath}`)
        
        // Reload settings to get discovered projects
        // Use a small delay to ensure backend has finished initializing
        setTimeout(async () => {
          await loadSettings()
        }, 500)
      }
    } catch (error: any) {
      console.error('Failed to select workspace:', error)
      message.error(error.message || 'Failed to select workspace')
    }
  }

  const handleReset = () => {
    form.setFieldsValue({
      searchPaths: '*',
      exclude: 'node_modules, dist, build, .git, coverage',
      defaultTemplate: 'default',
      aiProvider: 'claude',
      aiApiKey: '',
      aiModel: 'claude-3-5-sonnet-20241022'
    })
    setAiEnabled(false)
  }

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Header */}
        <div>
          <Title level={2}>Settings</Title>
          <Paragraph type="secondary">
            Configure your Nexwork workspace and preferences
          </Paragraph>
        </div>

        {/* Workspace Configuration */}
        <Card 
          title={
            <Space>
              Workspace Configuration
              <Tooltip title="Configure where Nexwork looks for your repositories">
                <Info size={16} style={{ color: '#888', cursor: 'help' }} />
              </Tooltip>
            </Space>
          }
        >
          <Form
            form={form}
            layout="vertical"
          >
            <Form.Item
              label={
                <Space>
                  Workspace Root
                  <Tooltip title="The main folder that contains all your project repositories (e.g., /Users/you/Projects)">
                    <HelpCircle size={14} style={{ color: '#1890ff', cursor: 'help' }} />
                  </Tooltip>
                </Space>
              }
              extra="The root directory containing your repositories"
            >
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <Text code style={{ 
                  padding: '8px 12px', 
                  display: 'block', 
                  background: isDark ? '#2a2a2a' : '#f5f5f5',
                  color: isDark ? '#e8e8e8' : 'inherit',
                  borderRadius: 4 
                }}>
                  {config?.workspaceRoot || 'No workspace selected'}
                </Text>
                <Button
                  icon={<FolderOpen size={16} />}
                  onClick={handleSelectWorkspace}
                >
                  Change Workspace
                </Button>
              </Space>
            </Form.Item>
            
            <Form.Item name="workspaceRoot" hidden>
              <Input />
            </Form.Item>

            <Form.Item
              label={
                <Space>
                  Search Paths
                  <Tooltip 
                    title={
                      <div>
                        <div><strong>Where Nexwork searches for repositories</strong></div>
                        <div style={{ marginTop: 8 }}>Examples:</div>
                        <div>• <code>*</code> - All folders in workspace root</div>
                        <div>• <code>FE/*, BE/*</code> - Organized by frontend/backend</div>
                        <div>• <code>projects/*</code> - All folders in 'projects' directory</div>
                      </div>
                    }
                    styles={{ root: { maxWidth: 400 } }}
                  >
                    <HelpCircle size={14} style={{ color: '#1890ff', cursor: 'help' }} />
                  </Tooltip>
                </Space>
              }
              name="searchPaths"
              extra={
                <Space direction="vertical" size={0}>
                  <Text type="secondary">Comma-separated glob patterns to search for repositories</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    💡 Use <Text code>*</Text> for all folders in root, or <Text code>FE/*, BE/*</Text> for organized structure
                  </Text>
                </Space>
              }
            >
              <Input
                size="large"
                placeholder="* (all folders in workspace root)"
              />
            </Form.Item>

            <Form.Item
              label={
                <Space>
                  Exclude Patterns
                  <Tooltip title="Folders to ignore when searching for repositories (e.g., node_modules, dist, build)">
                    <HelpCircle size={14} style={{ color: '#1890ff', cursor: 'help' }} />
                  </Tooltip>
                </Space>
              }
              name="exclude"
              extra="Comma-separated folders to exclude from search"
            >
              <Input
                size="large"
                placeholder="node_modules, dist, build"
              />
            </Form.Item>
          </Form>
        </Card>

        {/* Appearance */}
        <Card title="Appearance">
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Text strong style={{ fontSize: 16 }}>Theme</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Customize how Nexwork looks on your device
              </Text>
            </div>

            <Row gutter={[16, 16]}>
              {themes.map((theme) => (
                <Col xs={24} sm={12} md={8} key={theme.id}>
                  <SelectableCard
                    selected={selectedTheme === theme.id}
                    onClick={() => setSelectedTheme(theme.id)}
                    isDark={isDark}
                    checkmarkPosition="bottom-right"
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 160 }}>
                      {/* Top section: Theme preview */}
                      <div style={{
                        flex: 1,
                        background: theme.background,
                        border: theme.id === 'light' ? '1px solid #e8e8e8' : 'none',
                        borderRadius: 4,
                        padding: '12px',
                        minHeight: 100,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {theme.id === 'system' ? (
                          <Monitor size={32} color="#888" />
                        ) : (
                          <div style={{ width: '100%' }}>
                            <div style={{ 
                              color: theme.textColors.prompt, 
                              fontSize: 11, 
                              marginBottom: 4,
                              fontFamily: 'monospace'
                            }}>
                              $ npm run dev
                            </div>
                            <div style={{ 
                              color: theme.textColors.command, 
                              fontSize: 10,
                              fontFamily: 'monospace',
                              marginBottom: 4
                            }}>
                              Starting development server...
                            </div>
                            <div style={{ 
                              color: theme.textColors.output, 
                              fontSize: 10,
                              fontFamily: 'monospace',
                              marginBottom: 8
                            }}>
                              Ready on http://localhost:3000
                            </div>
                            {theme.dots && (
                              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                {theme.dots.map((color, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      width: 12,
                                      height: 12,
                                      borderRadius: '50%',
                                      background: color
                                    }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Bottom section: Title and Description with subtle separator */}
                      <div style={{
                        borderTop: isDark ? '1px solid #3a3a3a' : '1px solid #e8e8e8',
                        paddingTop: 12,
                        paddingBottom: 12,
                        paddingRight: selectedTheme === theme.id ? 40 : 0
                      }}>
                        <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>
                          {theme.name}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {theme.author}
                        </Text>
                      </div>
                    </div>
                  </SelectableCard>
                </Col>
              ))}
            </Row>

            <Alert
              message={`Theme: ${themes.find(t => t.id === selectedTheme)?.name}`}
              description="Theme changes are applied instantly. Click on a theme card to switch."
              type="success"
              showIcon
            />
          </Space>
        </Card>

        {/* Preferences (AI + Other) */}
        <Card 
          title={
            <Space>
              Preferences
              <Tooltip title="Customize your Nexwork experience">
                <Info size={16} style={{ color: '#888', cursor: 'help' }} />
              </Tooltip>
            </Space>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Space>
                  <Lock size={16} />
                  <Text strong>AI Terminal</Text>
                  <Tag color="purple">Beta</Tag>
                  <Tooltip 
                    title={
                      <div>
                        <div><strong>AI-Powered Development Assistant</strong></div>
                        <div style={{ marginTop: 8 }}>Get help with:</div>
                        <div>• Code reviews</div>
                        <div>• Commit message generation</div>
                        <div>• Error explanations</div>
                        <div>• PR descriptions</div>
                        <div style={{ marginTop: 8 }}>Use <code>@ai</code> commands in the terminal</div>
                      </div>
                    }
                    styles={{ root: { maxWidth: 300 } }}
                  >
                    <HelpCircle size={14} style={{ color: '#1890ff', cursor: 'help' }} />
                  </Tooltip>
                </Space>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Enable AI assistance in feature terminals
                </Text>
              </div>
              <Switch 
                checked={aiEnabled} 
                onChange={setAiEnabled}
              />
            </div>

            {aiEnabled && (
              <>
                <Alert
                  message="AI-Powered Terminal"
                  description="Get code reviews, commit message generation, error explanations, and more."
                  type="info"
                  showIcon
                  style={{ marginTop: 8 }}
                />

                <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
                  <Form.Item
                    label="AI Provider"
                    name="aiProvider"
                    extra="Choose your AI service provider"
                  >
                    <Select size="large">
                      <Option value="claude">
                        <Space>
                          <span>Anthropic Claude</span>
                          <Tag color="blue">Recommended</Tag>
                        </Space>
                      </Option>
                      <Option value="openai">OpenAI GPT</Option>
                      <Option value="ollama">
                        <Space>
                          <span>Ollama (Local)</span>
                          <Tag color="green">Private</Tag>
                        </Space>
                      </Option>
                    </Select>
                  </Form.Item>

                  <Form.Item
                    label="API Key"
                    name="aiApiKey"
                    extra="Your AI provider API key (stored locally, never shared)"
                    rules={[
                      { required: aiEnabled, message: 'API key is required when AI is enabled' }
                    ]}
                  >
                    <Password
                      size="large"
                      placeholder="sk-ant-..."
                      prefix={<Bot size={14} />}
                    />
                  </Form.Item>

                  <Form.Item
                    label="Model"
                    name="aiModel"
                    extra="Select the AI model to use"
                  >
                    <Select size="large">
                      <Option value="claude-3-5-sonnet-20241022">
                        <Space>
                          <span>Claude 3.5 Sonnet</span>
                          <Tag color="blue">Best</Tag>
                        </Space>
                      </Option>
                      <Option value="claude-3-opus-20240229">Claude 3 Opus</Option>
                      <Option value="claude-3-sonnet-20240229">Claude 3 Sonnet</Option>
                      <Option value="gpt-4">GPT-4</Option>
                      <Option value="gpt-4-turbo">GPT-4 Turbo</Option>
                      <Option value="gpt-3.5-turbo">GPT-3.5 Turbo</Option>
                    </Select>
                  </Form.Item>

                  <Alert
                    message="Available AI Commands"
                    description={
                      <div style={{ marginTop: 8 }}>
                        <Text code style={{ display: 'block', marginBottom: 4 }}>@ai review</Text>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                          Review uncommitted changes and suggest improvements
                        </Text>
                        
                        <Text code style={{ display: 'block', marginBottom: 4 }}>@ai commit</Text>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                          Generate commit message from git diff
                        </Text>
                        
                        <Text code style={{ display: 'block', marginBottom: 4 }}>@ai explain [error]</Text>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                          Explain errors and suggest fixes
                        </Text>
                        
                        <Text code style={{ display: 'block', marginBottom: 4 }}>@ai pr</Text>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                          Generate PR description from commits
                        </Text>
                      </div>
                    }
                    type="success"
                    showIcon
                  />
                </Form>
              </>
            )}

            <Divider />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Space>
                  <Text strong>Start on System Startup</Text>
                  <Tooltip title="Automatically launch Nexwork when you log in to your computer">
                    <HelpCircle size={14} style={{ color: '#1890ff', cursor: 'help' }} />
                  </Tooltip>
                </Space>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Launch Nexwork when system starts
                </Text>
              </div>
              <Switch 
                checked={startOnStartup}
                onChange={async (checked) => {
                  try {
                    await window.nexworkAPI.system.setAutoLaunch(checked)
                    setStartOnStartup(checked)
                    localStorage.setItem('startOnStartup', checked.toString())
                    message.success(checked ? 'Auto-launch enabled' : 'Auto-launch disabled')
                  } catch (error: any) {
                    message.error(error.message || 'Failed to update auto-launch setting')
                  }
                }}
              />
            </div>
          </Space>
        </Card>

        {/* Notifications */}
        <Card 
          title={
            <Space>
              Notifications
              <Tooltip 
                title={
                  <div>
                    <div><strong>When do notifications play?</strong></div>
                    <div style={{ marginTop: 8 }}>Nexwork plays sounds when:</div>
                    <div>• Git operations complete (sync, merge, commit)</div>
                    <div>• Build processes finish</div>
                    <div>• Long-running commands complete</div>
                    <div>• Features are successfully created</div>
                    <div style={{ marginTop: 8 }}>Choose a sound that suits your workflow!</div>
                  </div>
                }
                styles={{ root: { maxWidth: 350 } }}
              >
                <Info size={16} style={{ color: '#888', cursor: 'help' }} />
              </Tooltip>
            </Space>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Get audio alerts when long-running tasks complete
              </Text>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Space>
                  <Text strong>Notification sounds</Text>
                  <Tooltip title="Enable/disable sound alerts for completed operations">
                    <HelpCircle size={14} style={{ color: '#1890ff', cursor: 'help' }} />
                  </Tooltip>
                </Space>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Play a sound when tasks complete
                </Text>
              </div>
              <Switch 
                checked={notificationSoundsEnabled} 
                onChange={setNotificationSoundsEnabled}
              />
            </div>

            {notificationSoundsEnabled && (
              <>
                <Divider style={{ margin: '8px 0' }} />
                
                <div>
                  <Text strong style={{ fontSize: 14 }}>Notification Sound</Text>
                </div>

                <Row gutter={[16, 16]}>
                  {notificationSounds.map((sound) => (
                    <Col xs={24} sm={12} md={8} key={sound.id}>
                      <SelectableCard
                        selected={selectedSound === sound.id}
                        onClick={() => setSelectedSound(sound.id)}
                        isDark={isDark}
                        checkmarkPosition="bottom-right"
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 160 }}>
                          {/* Top section: Emoji centered with duration and play button */}
                          <div style={{ 
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            paddingTop: 16,
                            paddingBottom: 16
                          }}>
                            {/* Duration - top right */}
                            <div style={{ 
                              position: 'absolute',
                              top: 8,
                              right: 8
                            }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {sound.duration}
                              </Text>
                            </div>

                            {/* Emoji - centered */}
                            <div style={{ 
                              fontSize: 40,
                              lineHeight: 1
                            }}>
                              {sound.emoji}
                            </div>

                            {/* Play button - bottom right of emoji area */}
                            <div style={{ 
                              position: 'absolute',
                              bottom: 8,
                              right: 8
                            }}>
                              <Button
                                type="default"
                                shape="circle"
                                size="large"
                                icon={playingSound === sound.id ? <Square size={18} /> : <Play size={18} />}
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  if (playingSound === sound.id) {
                                    stopNotificationSound()
                                    setPlayingSound(null)
                                  } else {
                                    try {
                                      stopNotificationSound()
                                      setPlayingSound(sound.id)
                                      await playNotificationSound(sound.id)
                                      setTimeout(() => {
                                        setPlayingSound(null)
                                      }, parseFloat(sound.duration) * 1000)
                                    } catch (error: any) {
                                      setPlayingSound(null)
                                      message.error(`Failed to play sound: ${error.message || 'Unknown error'}`)
                                      console.error('Sound playback error:', error)
                                    }
                                  }
                                }}
                              />
                            </div>
                          </div>

                          {/* Bottom section: Title and Description with subtle separator */}
                          <div style={{
                            borderTop: isDark ? '1px solid #3a3a3a' : '1px solid #e8e8e8',
                            paddingTop: 12,
                            paddingBottom: 12,
                            paddingRight: selectedSound === sound.id ? 40 : 0
                          }}>
                            <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>
                              {sound.name}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {sound.description}
                            </Text>
                          </div>
                        </div>
                      </SelectableCard>
                    </Col>
                  ))}
                </Row>

                <Alert
                  message="Preview sounds"
                  description="Click the play button to preview a sound. Click stop or play another to stop the current sound."
                  type="info"
                  showIcon
                  style={{ marginTop: 8 }}
                />
              </>
            )}
          </Space>
        </Card>

        {/* Template Settings */}
        <Card 
          title={
            <Space>
              Template Settings
              <Tooltip title="Templates define branch naming conventions and commit message formats for your features">
                <Info size={16} style={{ color: '#888', cursor: 'help' }} />
              </Tooltip>
            </Space>
          }
        >
          <Form form={form} layout="vertical">
            <Form.Item
              label={
                <Space>
                  Default Template
                  <Tooltip 
                    title={
                      <div>
                        <div><strong>What templates do:</strong></div>
                        <div style={{ marginTop: 4 }}>• Control how branches are named across repos</div>
                        <div>• Format commit messages consistently</div>
                        <div style={{ marginTop: 8 }}><strong>Examples:</strong></div>
                        <div style={{ marginTop: 4 }}>• <strong>default:</strong> feature/my-feature</div>
                        <div>• <strong>jira:</strong> feature/PROJ-123-my-feature</div>
                      </div>
                    }
                    styles={{ root: { maxWidth: 350 } }}
                  >
                    <HelpCircle size={14} style={{ color: '#1890ff', cursor: 'help' }} />
                  </Tooltip>
                </Space>
              }
              name="defaultTemplate"
              extra="Template automatically selected when creating new features"
            >
              <Select size="large">
                {availableTemplates.map((template) => (
                  <Option key={template} value={template}>
                    {template}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Alert
              message="About Templates"
              description={
                <div>
                  <div>Templates ensure consistency across all repositories when creating multi-repo features.</div>
                  <div style={{ marginTop: 8 }}>
                    <strong>Available templates:</strong> {availableTemplates.map(t => (
                      <Tag key={t} color="blue" style={{ marginLeft: 4 }}>{t}</Tag>
                    ))}
                  </div>
                </div>
              }
              type="info"
              showIcon
              style={{ marginTop: 16 }}
            />
          </Form>
        </Card>



        {/* About */}
        <Card title="About">
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Row gutter={[24, 16]}>
              <Col xs={24} sm={12}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Version
                  </Text>
                  <Text strong style={{ fontSize: 16 }}>1.0.0</Text>
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Nexwork CLI Version
                  </Text>
                  <Text strong style={{ fontSize: 16 }}>1.2.0</Text>
                </div>
              </Col>
            </Row>
            
            <Divider style={{ margin: '8px 0' }} />
            
            <div>
              <Paragraph style={{ fontSize: 14, marginBottom: 4 }}>
                <Text strong>Nexwork</Text> - Multi-repository feature management made easy.
              </Paragraph>
              <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }}>
                Built with Electron, React, and TypeScript.
              </Paragraph>
            </div>
          </Space>
        </Card>

        {/* Actions */}
        <Card>
          <Space size="middle" wrap>
            <Button
              type="primary"
              size="large"
              icon={<Save size={18} />}
              onClick={handleSave}
              loading={loading}
              style={{ minWidth: 160 }}
            >
              Save Settings
            </Button>
            <Button
              size="large"
              icon={<RefreshCw size={18} />}
              onClick={handleReset}
              style={{ minWidth: 160 }}
            >
              Reset to Defaults
            </Button>
          </Space>
        </Card>
      </Space>
    </div>
  )
}
