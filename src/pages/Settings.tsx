import { useState, useEffect, useCallback } from 'react'
import { Space, Typography, Divider, message, Row, Col, Card } from 'antd'
import { useTheme } from '../contexts/ThemeContext'
import { WorkspaceSettings } from '../components/settings/WorkspaceSettings'
import { AppearanceSettings } from '../components/settings/AppearanceSettings'
import { PreferencesSettings } from '../components/settings/PreferencesSettings'
import { NotificationSettings } from '../components/settings/NotificationSettings'
import { TemplateSettings } from '../components/settings/TemplateSettings'
import type { Config } from '../types'

const { Title, Text, Paragraph } = Typography

export function Settings() {
  const [config, setConfig] = useState<Config | null>(null)
  const [availableTemplates, setAvailableTemplates] = useState<string[]>([])
  const [aiEnabled, setAiEnabled] = useState(false)
  const { theme: selectedTheme, setTheme: setSelectedTheme, isDark } = useTheme()
  const [notificationSoundsEnabled, setNotificationSoundsEnabled] = useState(true)
  const [selectedSound, setSelectedSound] = useState('codeComplete')
  const [startOnStartup, setStartOnStartup] = useState(false)

  // Form field values managed as state (no Form wrapper needed)
  const [searchPaths, setSearchPaths] = useState('*')
  const [exclude, setExclude] = useState('node_modules, dist, build')
  const [defaultTemplate, setDefaultTemplate] = useState('default')
  const [aiProvider, setAiProvider] = useState('claude')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiModel, setAiModel] = useState('claude-3-5-sonnet-20241022')

  const loadSettings = async () => {
    try {
      const [configData, templates] = await Promise.all([
        window.nexworkAPI.config.load(),
        window.nexworkAPI.templates.getAll(),
      ])

      setConfig(configData)
      setAvailableTemplates(templates)

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

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Title level={2} style={{ marginBottom: 4 }}>
            Settings
          </Title>
          <Paragraph type="secondary">
            Configure your Nexwork workspace and preferences. All changes save automatically.
          </Paragraph>
        </div>

        <WorkspaceSettings
          config={config}
          isDark={isDark}
          onSelectWorkspace={handleSelectWorkspace}
          searchPaths={searchPaths}
          onSearchPathsChange={handleSearchPathsChange}
          exclude={exclude}
          onExcludeChange={handleExcludeChange}
        />
        <AppearanceSettings selectedTheme={selectedTheme} onThemeChange={setSelectedTheme} isDark={isDark} />
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
        <NotificationSettings
          enabled={notificationSoundsEnabled}
          onEnabledChange={handleNotificationEnabledChange}
          selectedSound={selectedSound}
          onSoundChange={handleSoundChange}
          isDark={isDark}
        />
        <TemplateSettings
          availableTemplates={availableTemplates}
          defaultTemplate={defaultTemplate}
          onDefaultTemplateChange={handleDefaultTemplateChange}
        />

        {/* About */}
        <Card title="About">
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Row gutter={[24, 16]}>
              <Col xs={24} sm={12}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Version
                </Text>
                <Text strong style={{ fontSize: 16 }}>
                  1.0.0
                </Text>
              </Col>
              <Col xs={24} sm={12}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Nexwork CLI Version
                </Text>
                <Text strong style={{ fontSize: 16 }}>
                  1.2.0
                </Text>
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
      </Space>
    </div>
  )
}
