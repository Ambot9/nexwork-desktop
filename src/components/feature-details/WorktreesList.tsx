import { Card, Space, Typography, Button, List, Badge, Dropdown, Tag } from 'antd'
import { FolderOpen, Terminal, Code, X, ChevronDown } from 'lucide-react'
import type { FeatureDetailsContext } from './types'
import { IDE_NAMES, TERMINAL_NAMES } from './types'

const { Text } = Typography

interface Props {
  ctx: FeatureDetailsContext
}

function buildTerminalMenuItems(projectName: string, ctx: FeatureDetailsContext, targetPath?: string) {
  const { projectTerminalAppPreferences, projectTerminalPreferences } = ctx
  const savedApp = projectTerminalAppPreferences[projectName]

  const quickOpen = savedApp
    ? [
        {
          key: 'quick-open',
          label: `Open in ${TERMINAL_NAMES[savedApp] || 'Terminal'}`,
          icon: <Terminal size={14} />,
          onClick: () => {
            if (targetPath) {
              window.nexworkAPI.openInTerminal(targetPath, savedApp)
            } else {
              ctx.handleOpenInTerminal(projectName)
            }
          },
          style: { fontWeight: 600 },
        },
        { type: 'divider' as const },
      ]
    : []

  const terminalApps = Object.entries(TERMINAL_NAMES).map(([key, name]) => ({
    key,
    label: savedApp === key ? `\u2713 ${name}` : name,
    onClick: () => {
      if (targetPath) {
        window.nexworkAPI.openInTerminal(targetPath, key)
      } else {
        ctx.handleOpenInTerminal(projectName, key)
      }
    },
  }))

  const items: any[] = [
    ...quickOpen,
    {
      type: 'group',
      label: 'Choose Terminal App',
      children: terminalApps,
    },
  ]

  if (!targetPath) {
    items.push(
      { type: 'divider' },
      {
        key: 'integrated',
        label:
          projectTerminalPreferences[projectName] === 'integrated'
            ? '\u2713 Integrated Terminal'
            : 'Integrated Terminal',
        icon: <Terminal size={14} />,
        onClick: () => ctx.handleTerminalOption(projectName, 'integrated'),
      },
    )
  }

  return items
}

function buildIDEMenuItems(projectName: string, ctx: FeatureDetailsContext) {
  const saved = ctx.projectIDEPreferences[projectName]
  return Object.entries(IDE_NAMES).map(([key, name]) => ({
    key,
    label: saved === key ? `\u2713 ${name}` : name,
    onClick: () => ctx.handleOpenInIDE(projectName, key),
  }))
}

function getTerminalLabel(projectName: string, ctx: FeatureDetailsContext): string {
  if (ctx.projectTerminalPreferences[projectName] === 'integrated') return 'Terminal'
  const app = ctx.projectTerminalAppPreferences[projectName]
  return TERMINAL_NAMES[app] || 'Terminal'
}

function getIDELabel(projectName: string, ctx: FeatureDetailsContext): string {
  const saved = ctx.projectIDEPreferences[projectName]
  if (saved === 'code-insiders') return 'Insiders'
  if (saved === 'intellij') return 'IntelliJ'
  return IDE_NAMES[saved] || 'IDE'
}

export function WorktreesList({ ctx }: Props) {
  const { worktreeInfo, featureFolderPath, projectTerminalAppPreferences } = ctx

  const activeWorktrees = Object.entries(worktreeInfo).filter(([_, path]) => path)
  if (activeWorktrees.length === 0) return null

  const rootApp = projectTerminalAppPreferences['_root_']
  const rootLabel = rootApp ? TERMINAL_NAMES[rootApp] || 'Root' : 'Root Folder'

  return (
    <Card
      bodyStyle={{ padding: '8px 20px 12px' }}
      title={
        <Space size={8}>
          <FolderOpen size={16} />
          <span>Worktrees</span>
          <Badge count={activeWorktrees.length} style={{ backgroundColor: '#4f6ef7' }} />
        </Space>
      }
      extra={
        <Dropdown
          menu={{
            items: buildTerminalMenuItems('_root_', ctx, featureFolderPath || undefined),
          }}
          trigger={['click']}
        >
          <Button size="small" type="text" icon={<Terminal size={13} />}>
            {rootLabel} <ChevronDown size={11} style={{ marginLeft: 2, opacity: 0.5 }} />
          </Button>
        </Dropdown>
      }
      style={{ marginBottom: 0, borderRadius: 18, minHeight: '100%' }}
    >
      <List
        size="small"
        dataSource={activeWorktrees}
        renderItem={([projectName, path]) => (
          <List.Item style={{ padding: '14px 0' }}>
            <div style={{ width: '100%' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 6,
                }}
              >
                <Space size={10} wrap>
                  <Badge status="success" />
                  <Text strong style={{ fontSize: 13 }}>
                    {projectName}
                  </Text>
                  <Tag color="green" style={{ fontSize: 11, marginInlineEnd: 0 }}>
                    Active
                  </Tag>
                </Space>

                <Space size={4} wrap>
                  <Dropdown
                    key="terminal"
                    menu={{ items: buildTerminalMenuItems(projectName, ctx) }}
                    trigger={['click']}
                  >
                    <Button icon={<Terminal size={13} />} size="small" type="text">
                      {getTerminalLabel(projectName, ctx)}{' '}
                      <ChevronDown size={10} style={{ marginLeft: 2, opacity: 0.5 }} />
                    </Button>
                  </Dropdown>
                  <Dropdown key="ide" menu={{ items: buildIDEMenuItems(projectName, ctx) }} trigger={['click']}>
                    <Button icon={<Code size={13} />} size="small" type="text">
                      {getIDELabel(projectName, ctx)} <ChevronDown size={10} style={{ marginLeft: 2, opacity: 0.5 }} />
                    </Button>
                  </Dropdown>
                  <Button
                    key="remove"
                    icon={<X size={13} />}
                    onClick={() => ctx.handleRemoveWorktree(projectName)}
                    size="small"
                    type="text"
                    danger
                  />
                </Space>
              </div>

              <Text
                type="secondary"
                style={{
                  fontSize: 11,
                  display: 'block',
                  paddingLeft: 24,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={path || undefined}
              >
                {path}
              </Text>
            </div>
          </List.Item>
        )}
      />
    </Card>
  )
}
