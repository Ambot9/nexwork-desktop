import { Card, Input, Select, Switch, Space, Typography, Tag, Tooltip, Alert, Divider } from 'antd'
import { Lock, Bot, HelpCircle, Info } from 'lucide-react'

const { Text } = Typography
const { Option } = Select
const { Password } = Input

interface Props {
  aiEnabled: boolean
  onAiEnabledChange: (enabled: boolean) => void
  aiProvider: string
  onAiProviderChange: (provider: string) => void
  aiApiKey: string
  onAiApiKeyChange: (key: string) => void
  aiModel: string
  onAiModelChange: (model: string) => void
  startOnStartup: boolean
  onStartupChange: (checked: boolean) => void
}

export function PreferencesSettings({
  aiEnabled,
  onAiEnabledChange,
  aiProvider,
  onAiProviderChange,
  aiApiKey,
  onAiApiKeyChange,
  aiModel,
  onAiModelChange,
  startOnStartup,
  onStartupChange,
}: Props) {
  return (
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
                    <div>
                      <strong>AI-Powered Development Assistant</strong>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      Get help with code reviews, commit messages, error explanations, and PR descriptions.
                    </div>
                  </div>
                }
              >
                <HelpCircle size={14} style={{ color: 'var(--color-accent)', cursor: 'help' }} />
              </Tooltip>
            </Space>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Enable AI assistance in feature terminals
            </Text>
          </div>
          <Switch checked={aiEnabled} onChange={onAiEnabledChange} />
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

            <Space direction="vertical" style={{ width: '100%', marginTop: 8 }} size="middle">
              <div>
                <Text strong>AI Provider</Text>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                  Choose your AI service provider
                </Text>
                <Select size="large" style={{ width: '100%' }} value={aiProvider} onChange={onAiProviderChange}>
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
              </div>

              <div>
                <Text strong>API Key</Text>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                  Your AI provider API key (stored locally, never shared)
                </Text>
                <Password
                  size="large"
                  placeholder="sk-ant-..."
                  prefix={<Bot size={14} />}
                  value={aiApiKey}
                  onChange={(e) => onAiApiKeyChange(e.target.value)}
                />
              </div>

              <div>
                <Text strong>Model</Text>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                  Select the AI model to use
                </Text>
                <Select size="large" style={{ width: '100%' }} value={aiModel} onChange={onAiModelChange}>
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
              </div>
            </Space>
          </>
        )}

        <Divider />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Space>
              <Text strong>Start on System Startup</Text>
              <Tooltip title="Automatically launch Nexwork when you log in">
                <HelpCircle size={14} style={{ color: 'var(--color-accent)', cursor: 'help' }} />
              </Tooltip>
            </Space>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Launch Nexwork when system starts
            </Text>
          </div>
          <Switch checked={startOnStartup} onChange={onStartupChange} />
        </div>
      </Space>
    </Card>
  )
}
