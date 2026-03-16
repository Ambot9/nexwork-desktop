import { useState, useEffect, useCallback } from 'react'
import { Space, Typography, message, Row, Col, Card, Tag, Statistic } from 'antd'
import { Blocks, Palette, FolderTree, Puzzle, Sparkles, BellRing, FileText, Info } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { WorkspaceSettings } from '../components/settings/WorkspaceSettings'
import { WorkspaceProjectsSettings } from '../components/settings/WorkspaceProjectsSettings'
import { AppearanceSettings } from '../components/settings/AppearanceSettings'
import { PreferencesSettings } from '../components/settings/PreferencesSettings'
import { NotificationSettings } from '../components/settings/NotificationSettings'
import { TemplateSettings } from '../components/settings/TemplateSettings'
import { PluginSettings } from '../components/settings/PluginSettings'
import type { Config } from '../types'
import type { PluginDescriptor } from '../plugins/types'

const { Title, Text, Paragraph } = Typography

export function Settings() {
  const [config, setConfig] = useState<Config | null>(null)
  const [availableTemplates, setAvailableTemplates] = useState<string[]>([])
  const [aiEnabled, setAiEnabled] = useState(false)
  const { theme: selectedTheme, setTheme: setSelectedTheme, isDark } = useTheme()
  const [notificationSoundsEnabled, setNotificationSoundsEnabled] = useState(true)
  const [selectedSound, setSelectedSound] = useState('codeComplete')
  const [startOnStartup, setStartOnStartup] = useState(false)
  const [plugins, setPlugins] = useState<PluginDescriptor[]>([])

  // Form field values managed as state (no Form wrapper needed)
  const [searchPaths, setSearchPaths] = useState('*')
  const [exclude, setExclude] = useState('node_modules, dist, build')
  const [defaultTemplate, setDefaultTemplate] = useState('default')
  const [aiProvider, setAiProvider] = useState('claude')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiModel, setAiModel] = useState('claude-3-5-sonnet-20241022')

  const loadSettings = async () => {
    try {
      const [configData, templates, pluginData] = await Promise.all([
        window.nexworkAPI.config.load(),
        window.nexworkAPI.templates.getAll(),
        window.nexworkAPI.plugins.getAll(),
      ])

      setConfig(configData)
      setAvailableTemplates(templates)
      setPlugins(pluginData)

      try {
        const [
          notifEnabledRes,
          soundRes,
          aiEnabledRes,
          aiProviderRes,
          aiApiKeyRes,
          aiModelRes,
          templateRes,
          searchPathsRes,
          excludeRes,
        ] = await Promise.all([
          window.nexworkAPI.settings.get('notificationSoundsEnabled'),
          window.nexworkAPI.settings.get('notificationSound'),
          window.nexworkAPI.settings.get('aiEnabled'),
          window.nexworkAPI.settings.get('aiProvider'),
          window.nexworkAPI.settings.get('aiApiKey'),
          window.nexworkAPI.settings.get('aiModel'),
          window.nexworkAPI.settings.get('defaultTemplate'),
          window.nexworkAPI.settings.get('searchPaths'),
          window.nexworkAPI.settings.get('exclude'),
        ])

        if (notifEnabledRes.success && notifEnabledRes.value !== undefined)
          setNotificationSoundsEnabled(notifEnabledRes.value)
        if (soundRes.success && soundRes.value) setSelectedSound(soundRes.value)
        if (aiEnabledRes.success && aiEnabledRes.value !== undefined) setAiEnabled(aiEnabledRes.value)
        if (aiProviderRes.success && aiProviderRes.value) setAiProvider(aiProviderRes.value)
        if (aiApiKeyRes.success && aiApiKeyRes.value) setAiApiKey(aiApiKeyRes.value)
        if (aiModelRes.success && aiModelRes.value) setAiModel(aiModelRes.value)
        if (templateRes.success && templateRes.value) setDefaultTemplate(templateRes.value)
        if (searchPathsRes.success && searchPathsRes.value) setSearchPaths(searchPathsRes.value)
        else if (configData.userConfig?.searchPaths) setSearchPaths(configData.userConfig.searchPaths.join(', '))
        if (excludeRes.success && excludeRes.value) setExclude(excludeRes.value)
        else if (configData.userConfig?.exclude) setExclude(configData.userConfig.exclude.join(', '))
      } catch {
        setAiEnabled(!!configData.userConfig?.ai?.enabled)
        if (configData.userConfig?.searchPaths) setSearchPaths(configData.userConfig.searchPaths.join(', '))
        if (configData.userConfig?.exclude) setExclude(configData.userConfig.exclude.join(', '))
        if (configData.userConfig?.defaultTemplate) setDefaultTemplate(configData.userConfig.defaultTemplate)
        if (configData.userConfig?.ai?.provider) setAiProvider(configData.userConfig.ai.provider)
        if (configData.userConfig?.ai?.apiKey) setAiApiKey(configData.userConfig.ai.apiKey)
        if (configData.userConfig?.ai?.model) setAiModel(configData.userConfig.ai.model)
      }

      const savedStartup = localStorage.getItem('startOnStartup')
      if (savedStartup !== null) setStartOnStartup(savedStartup === 'true')
    } catch (error) {
      console.error('Failed to load settings:', error)
      message.error('Failed to load settings')
    }
  }

  useEffect(() => {
    loadSettings() // eslint-disable-line react-hooks/set-state-in-effect
  }, [])

  // Auto-save helper
  const saveSetting = useCallback(async (key: string, value: any) => {
    try {
      await window.nexworkAPI.settings.set(key, value)
    } catch (error) {
      console.error(`Failed to save ${key}:`, error)
    }
  }, [])

  // Save the full config (for searchPaths/exclude that live in config.userConfig)
  const _saveConfig = useCallback(async () => {
    if (!config) return
    try {
      const updatedConfig: Config = {
        workspaceRoot: config.workspaceRoot,
        projects: config.projects,
        features: config.features,
        userConfig: {
          searchPaths: searchPaths.split(',').map((s: string) => s.trim()),
          exclude: exclude.split(',').map((s: string) => s.trim()),
          defaultTemplate,
          managedProjects: config.userConfig?.managedProjects,
          ai: {
            enabled: aiEnabled,
            provider: aiProvider as 'claude' | 'openai' | 'ollama',
            apiKey: aiApiKey,
            model: aiModel,
          },
        },
      }
      await window.nexworkAPI.config.save(updatedConfig)
      setConfig(updatedConfig)
    } catch (error) {
      console.error('Failed to save config:', error)
    }
  }, [config, searchPaths, exclude, defaultTemplate, aiEnabled, aiProvider, aiApiKey, aiModel])

  // ── Change handlers with auto-save ─────────────────────────────────

  const handleSelectWorkspace = async () => {
    try {
      const selectedPath = await window.nexworkAPI.selectFolder()
      if (selectedPath) {
        await window.nexworkAPI.config.setWorkspace(selectedPath)
        message.success(`Workspace updated to: ${selectedPath}`)
        // Reload config from main so we respect per-account workspace mapping
        await loadSettings()
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to select workspace')
    }
  }

  const handleNotificationEnabledChange = (enabled: boolean) => {
    setNotificationSoundsEnabled(enabled)
    saveSetting('notificationSoundsEnabled', enabled)
  }

  const handleSoundChange = (sound: string) => {
    setSelectedSound(sound)
    saveSetting('notificationSound', sound)
  }

  const handleAiEnabledChange = (enabled: boolean) => {
    setAiEnabled(enabled)
    saveSetting('aiEnabled', enabled)
  }

  const handleAiProviderChange = (provider: string) => {
    setAiProvider(provider)
    saveSetting('aiProvider', provider)
  }

  const handleAiApiKeyChange = (key: string) => {
    setAiApiKey(key)
    saveSetting('aiApiKey', key)
  }

  const handleAiModelChange = (model: string) => {
    setAiModel(model)
    saveSetting('aiModel', model)
  }

  const handleDefaultTemplateChange = (template: string) => {
    setDefaultTemplate(template)
    saveSetting('defaultTemplate', template)
  }

  const handleSearchPathsChange = (value: string) => {
    setSearchPaths(value)
    saveSetting('searchPaths', value)
  }

  const handleExcludeChange = (value: string) => {
    setExclude(value)
    saveSetting('exclude', value)
  }

  const handleManagedProjectsChange = async (managedProjects: string[]) => {
    if (!config) return

    const updatedConfig: Config = {
      workspaceRoot: config.workspaceRoot,
      projects: config.projects,
      features: config.features,
      userConfig: {
        searchPaths: searchPaths.split(',').map((s: string) => s.trim()),
        exclude: exclude.split(',').map((s: string) => s.trim()),
        defaultTemplate,
        managedProjects,
        ai: {
          enabled: aiEnabled,
          provider: aiProvider as 'claude' | 'openai' | 'ollama',
          apiKey: aiApiKey,
          model: aiModel,
        },
      },
    }

    try {
      await window.nexworkAPI.config.save(updatedConfig)
      setConfig(updatedConfig)
    } catch (error) {
      console.error('Failed to save managed projects:', error)
    }
  }

  const handleStartupChange = async (checked: boolean) => {
    try {
      await window.nexworkAPI.system.setAutoLaunch(checked)
      setStartOnStartup(checked)
      localStorage.setItem('startOnStartup', checked.toString())
      message.success(checked ? 'Auto-launch enabled' : 'Auto-launch disabled')
    } catch (error: any) {
      message.error(error.message || 'Failed to update auto-launch setting')
    }
  }

  const handlePluginToggle = async (pluginId: string, enabled: boolean): Promise<boolean> => {
    const result = await window.nexworkAPI.plugins.setEnabled(pluginId, enabled)

    if (!result.success) {
      message.error(result.error || 'Failed to update plugin')
      return false
    }

    setPlugins(result.plugins || [])
    message.success(enabled ? 'Plugin enabled' : 'Plugin disabled')
    return true
  }

  const handlePluginSaveConfig = async (pluginId: string, pluginConfig: Record<string, any>): Promise<boolean> => {
    const result = await window.nexworkAPI.plugins.updateConfig(pluginId, pluginConfig)

    if (!result.success) {
      message.error(result.error || 'Failed to save plugin config')
      return false
    }

    setPlugins(result.plugins || [])
    message.success('Plugin configuration saved')
    return true
  }

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Card
          style={{
            borderRadius: 20,
            overflow: 'hidden',
            background:
              'linear-gradient(135deg, rgba(22,119,255,0.12) 0%, rgba(16,185,129,0.08) 45%, rgba(250,173,20,0.08) 100%)',
          }}
          bodyStyle={{ padding: 24 }}
        >
          <Row gutter={[24, 24]} align="middle">
            <Col xs={24} lg={15}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div>
                  <Tag color="blue" style={{ marginBottom: 12 }}>
                    Auto-save enabled
                  </Tag>
                  <Title level={2} style={{ margin: 0 }}>
                    Settings
                  </Title>
                  <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, maxWidth: 720 }}>
                    Keep workspace discovery, integrations, templates, and developer preferences in one place. Changes
                    save automatically so you can tune the app without extra setup steps.
                  </Paragraph>
                </div>

                <Space size={[8, 8]} wrap>
                  <Tag icon={<FolderTree size={12} />}>
                    {config?.workspaceRoot ? 'Workspace connected' : 'Workspace needed'}
                  </Tag>
                  <Tag icon={<Puzzle size={12} />}>
                    {plugins.filter((plugin) => plugin.enabled).length} integration(s) enabled
                  </Tag>
                  <Tag icon={<Sparkles size={12} />}>{aiEnabled ? 'AI terminal on' : 'AI terminal off'}</Tag>
                  <Tag icon={<BellRing size={12} />}>
                    {notificationSoundsEnabled ? 'Sound alerts on' : 'Sound alerts off'}
                  </Tag>
                </Space>
              </Space>
            </Col>

            <Col xs={24} lg={9}>
              <Row gutter={[12, 12]}>
                <Col xs={12}>
                  <Card size="small" style={{ borderRadius: 14 }}>
                    <Statistic
                      title="Managed Projects"
                      value={config?.userConfig?.managedProjects?.length ?? config?.projects?.length ?? 0}
                    />
                  </Card>
                </Col>
                <Col xs={12}>
                  <Card size="small" style={{ borderRadius: 14 }}>
                    <Statistic title="Templates" value={availableTemplates.length} />
                  </Card>
                </Col>
                <Col xs={12}>
                  <Card size="small" style={{ borderRadius: 14 }}>
                    <Statistic title="Theme" value={selectedTheme} valueStyle={{ fontSize: 18 }} />
                  </Card>
                </Col>
                <Col xs={12}>
                  <Card size="small" style={{ borderRadius: 14 }}>
                    <Statistic title="Startup" value={startOnStartup ? 'On' : 'Off'} valueStyle={{ fontSize: 18 }} />
                  </Card>
                </Col>
              </Row>
            </Col>
          </Row>
        </Card>

        <div>
          <Space align="center" size="small" style={{ marginBottom: 12 }}>
            <FolderTree size={16} />
            <Text strong style={{ fontSize: 16 }}>
              Workspace
            </Text>
          </Space>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Define where Nexwork discovers repositories and which projects belong in your day-to-day feature flow.
          </Text>

          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <WorkspaceSettings
              config={config}
              isDark={isDark}
              onSelectWorkspace={handleSelectWorkspace}
              searchPaths={searchPaths}
              onSearchPathsChange={handleSearchPathsChange}
              exclude={exclude}
              onExcludeChange={handleExcludeChange}
            />
            <WorkspaceProjectsSettings config={config} onManagedProjectsChange={handleManagedProjectsChange} />
          </Space>
        </div>

        <div>
          <Space align="center" size="small" style={{ marginBottom: 12 }}>
            <Palette size={16} />
            <Text strong style={{ fontSize: 16 }}>
              Experience
            </Text>
          </Space>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Control how Nexwork looks, how it behaves on startup, and how much help it gives while you work.
          </Text>

          <Row gutter={[24, 24]} align="top">
            <Col xs={24} xxl={12}>
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <AppearanceSettings selectedTheme={selectedTheme} onThemeChange={setSelectedTheme} isDark={isDark} />
                <NotificationSettings
                  enabled={notificationSoundsEnabled}
                  onEnabledChange={handleNotificationEnabledChange}
                  selectedSound={selectedSound}
                  onSoundChange={handleSoundChange}
                  isDark={isDark}
                />
              </Space>
            </Col>
            <Col xs={24} xxl={12}>
              <PreferencesSettings
                aiEnabled={aiEnabled}
                onAiEnabledChange={handleAiEnabledChange}
                aiProvider={aiProvider}
                onAiProviderChange={handleAiProviderChange}
                aiApiKey={aiApiKey}
                onAiApiKeyChange={handleAiApiKeyChange}
                aiModel={aiModel}
                onAiModelChange={handleAiModelChange}
                startOnStartup={startOnStartup}
                onStartupChange={handleStartupChange}
              />
            </Col>
          </Row>
        </div>

        <div>
          <Space align="center" size="small" style={{ marginBottom: 12 }}>
            <Blocks size={16} />
            <Text strong style={{ fontSize: 16 }}>
              Workflow Extensions
            </Text>
          </Space>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Keep optional integrations and reusable feature defaults together so setup feels intentional instead of
            scattered.
          </Text>

          <Row gutter={[24, 24]} align="top">
            <Col xs={24} xxl={16}>
              <PluginSettings
                plugins={plugins}
                onToggle={handlePluginToggle}
                onSaveConfig={handlePluginSaveConfig}
                onRefresh={loadSettings}
              />
            </Col>
            <Col xs={24} xxl={8}>
              <TemplateSettings
                availableTemplates={availableTemplates}
                defaultTemplate={defaultTemplate}
                onDefaultTemplateChange={handleDefaultTemplateChange}
              />
            </Col>
          </Row>
        </div>

        <div>
          <Space align="center" size="small" style={{ marginBottom: 12 }}>
            <Info size={16} />
            <Text strong style={{ fontSize: 16 }}>
              About
            </Text>
          </Space>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Version details and a quick reminder of what this app is optimized for.
          </Text>

          <Card>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Card size="small" style={{ borderRadius: 14 }}>
                    <Statistic title="Desktop Version" value="1.0.0" valueStyle={{ fontSize: 22 }} />
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small" style={{ borderRadius: 14 }}>
                    <Statistic title="CLI Version" value="1.2.0" valueStyle={{ fontSize: 22 }} />
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small" style={{ borderRadius: 14 }}>
                    <Statistic title="Mode" value="Desktop" valueStyle={{ fontSize: 22 }} />
                  </Card>
                </Col>
              </Row>

              <Card
                size="small"
                style={{
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(250,173,20,0.08), rgba(22,119,255,0.08))',
                }}
              >
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Space align="center" size="small">
                    <FileText size={16} />
                    <Text strong>Nexwork</Text>
                  </Space>
                  <Paragraph style={{ fontSize: 14, marginBottom: 0 }}>
                    Multi-repository feature management for teams that need one operational view across branches,
                    worktrees, feature status, and optional knowledge integrations.
                  </Paragraph>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    Built with Electron, React, and TypeScript.
                  </Text>
                </Space>
              </Card>
            </Space>
          </Card>
        </div>
      </Space>
    </div>
  )
}
