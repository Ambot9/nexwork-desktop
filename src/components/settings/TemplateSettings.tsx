import { Card, Select, Space, Typography, Tooltip, Alert, Tag } from 'antd'
import { HelpCircle, Info } from 'lucide-react'

const { Text } = Typography
const { Option } = Select

interface Props {
  availableTemplates: string[]
  defaultTemplate: string
  onDefaultTemplateChange: (template: string) => void
}

export function TemplateSettings({ availableTemplates, defaultTemplate, onDefaultTemplateChange }: Props) {
  return (
    <Card
      title={
        <Space>
          Template Settings
          <Tooltip title="Templates define branch naming conventions and commit message formats">
            <Info size={16} style={{ color: '#888', cursor: 'help' }} />
          </Tooltip>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <Space>
            <Text strong>Default Template</Text>
            <Tooltip
              title={
                <div>
                  <div>
                    <strong>What templates do:</strong>
                  </div>
                  <div style={{ marginTop: 4 }}>Control how branches are named and commit messages are formatted.</div>
                  <div style={{ marginTop: 8 }}>default: feature/my-feature</div>
                  <div>jira: feature/PROJ-123-my-feature</div>
                </div>
              }
            >
              <HelpCircle size={14} style={{ color: 'var(--color-accent)', cursor: 'help' }} />
            </Tooltip>
          </Space>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Template automatically selected when creating new features
          </Text>
          <Select size="large" style={{ width: '100%' }} value={defaultTemplate} onChange={onDefaultTemplateChange}>
            {availableTemplates.map((template) => (
              <Option key={template} value={template}>
                {template}
              </Option>
            ))}
          </Select>
        </div>

        <Alert
          message="About Templates"
          description={
            <div>
              <div>Templates ensure consistency across all repositories when creating multi-repo features.</div>
              <div style={{ marginTop: 8 }}>
                <strong>Available:</strong>{' '}
                {availableTemplates.map((t) => (
                  <Tag key={t} color="blue" style={{ marginLeft: 4 }}>
                    {t}
                  </Tag>
                ))}
              </div>
            </div>
          }
          type="info"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Space>
    </Card>
  )
}
