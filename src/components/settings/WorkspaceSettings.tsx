import { Input, Button, Space, Typography, Tooltip, Card } from 'antd'
import { FolderOpen, HelpCircle, Info } from 'lucide-react'
import type { Config } from '../../types'

const { Text } = Typography

interface Props {
  config: Config | null
  isDark: boolean
  onSelectWorkspace: () => void
  searchPaths: string
  onSearchPathsChange: (value: string) => void
  exclude: string
  onExcludeChange: (value: string) => void
}

export function WorkspaceSettings({
  config,
  isDark,
  onSelectWorkspace,
  searchPaths,
  onSearchPathsChange,
  exclude,
  onExcludeChange,
}: Props) {
  return (
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
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <Space>
            <Text strong>Workspace Root</Text>
            <Tooltip title="The main folder that contains all your project repositories">
              <HelpCircle size={14} style={{ color: 'var(--color-accent)', cursor: 'help' }} />
            </Tooltip>
          </Space>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            The root directory containing your repositories
          </Text>
          <Text
            code
            style={{
              padding: '8px 12px',
              display: 'block',
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
              borderRadius: 6,
              marginBottom: 8,
            }}
          >
            {config?.workspaceRoot || 'No workspace selected'}
          </Text>
          <Button icon={<FolderOpen size={16} />} onClick={onSelectWorkspace}>
            {config?.workspaceRoot ? 'Change Workspace' : 'Select Workspace'}
          </Button>
        </div>

        <div>
          <Space>
            <Text strong>Search Paths</Text>
            <Tooltip
              title={
                <div>
                  <div>
                    <strong>Where Nexwork searches for repositories</strong>
                  </div>
                  <div style={{ marginTop: 8 }}>Examples:</div>
                  <div>* - All folders in workspace root</div>
                  <div>FE/*, BE/* - Organized by frontend/backend</div>
                </div>
              }
            >
              <HelpCircle size={14} style={{ color: 'var(--color-accent)', cursor: 'help' }} />
            </Tooltip>
          </Space>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Comma-separated glob patterns to search for repositories
          </Text>
          <Input
            size="large"
            placeholder="* (all folders in workspace root)"
            value={searchPaths}
            onChange={(e) => onSearchPathsChange(e.target.value)}
          />
        </div>

        <div>
          <Space>
            <Text strong>Exclude Patterns</Text>
            <Tooltip title="Folders to ignore when searching for repositories">
              <HelpCircle size={14} style={{ color: 'var(--color-accent)', cursor: 'help' }} />
            </Tooltip>
          </Space>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Comma-separated folders to exclude from search
          </Text>
          <Input
            size="large"
            placeholder="node_modules, dist, build"
            value={exclude}
            onChange={(e) => onExcludeChange(e.target.value)}
          />
        </div>
      </Space>
    </Card>
  )
}
