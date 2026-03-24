import { Card, Space, Typography, Tag, Alert, List, Dropdown, Button } from 'antd'
import { FolderOpen, CheckCircle2, Clock, Terminal, Code, ChevronDown } from 'lucide-react'
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

export function FeatureWorkspace({ ctx }: Props) {
  const {
    feature,
    stats,
    featureFolderPath,
    projectWorktreeStatus,
    gitStatuses,
    localFeatureBranches,
    projectTerminalAppPreferences,
  } = ctx

  if (!featureFolderPath || !feature) return null

  const rootApp = projectTerminalAppPreferences['_root_']
  const rootLabel = rootApp ? TERMINAL_NAMES[rootApp] || 'Root' : 'Root Folder'

  return (
    <Card
      styles={{ body: { padding: '8px 20px 12px' } }}
      title={
        <Space size={8}>
          <FolderOpen size={16} />
          <span>Feature Workspace</span>
          <Tag color="green" style={{ marginLeft: 4 }}>
            Active
          </Tag>
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
      <div style={{ marginBottom: 14 }}>
        <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
          Workspace Path
        </Text>
        <Text
          code
          style={{
            fontSize: 12,
            opacity: 0.78,
            display: 'block',
            width: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={featureFolderPath}
        >
          {featureFolderPath}
        </Text>
      </div>

      <List
        size="small"
        dataSource={feature.projects}
        renderItem={(project) => {
          const status = projectWorktreeStatus[project.name]
          const projectDetail = stats?.projectDetails?.find((p: any) => p.name === project.name) as any
          const gitStats = projectDetail?.gitStats
          const gitStatus = gitStatuses?.[project.name]
          const currentBranch = gitStatus?.branch
          const remoteNotCreated = gitStatus?.isLocalOnly === true

          return (
            <List.Item style={{ padding: '14px 0' }}>
              <div style={{ width: '100%' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: status?.exists && (status.baseBranch || currentBranch) ? 6 : 0,
                  }}
                >
                  <Space size={10} wrap>
                    {status?.exists ? <CheckCircle2 size={14} color="#52c41a" /> : <Clock size={14} color="#faad14" />}
                    <Text strong style={{ fontSize: 13 }}>
                      {project.name}
                    </Text>
                    {status?.exists ? (
                      <Tag color="green" style={{ fontSize: 11, marginInlineEnd: 0 }}>
                        Worktree Created Remote
                      </Tag>
                    ) : (
                      <Tag color="orange" style={{ fontSize: 11, marginInlineEnd: 0 }}>
                        Worktree Not Created Remote
                      </Tag>
                    )}
                    {remoteNotCreated && (
                      <Tag color="orange" style={{ fontSize: 11, marginInlineEnd: 0 }}>
                        Remote not created
                      </Tag>
                    )}
                  </Space>

                  <Space size={4} wrap>
                    <Dropdown menu={{ items: buildTerminalMenuItems(project.name, ctx) }} trigger={['click']}>
                      <Button icon={<Terminal size={13} />} size="small" type="text">
                        {getTerminalLabel(project.name, ctx)}{' '}
                        <ChevronDown size={10} style={{ marginLeft: 2, opacity: 0.5 }} />
                      </Button>
                    </Dropdown>
                    <Dropdown menu={{ items: buildIDEMenuItems(project.name, ctx) }} trigger={['click']}>
                      <Button icon={<Code size={13} />} size="small" type="text">
                        {getIDELabel(project.name, ctx)}{' '}
                        <ChevronDown size={10} style={{ marginLeft: 2, opacity: 0.5 }} />
                      </Button>
                    </Dropdown>
                  </Space>
                </div>

                {status?.exists && (status.baseBranch || currentBranch) && (
                  <Space size={[6, 6]} wrap style={{ paddingLeft: 24, marginBottom: 8 }}>
                    {status.baseBranch && (
                      <Tag color="default" style={{ fontSize: 11, marginInlineEnd: 0 }}>
                        Base: {status.baseBranch}
                      </Tag>
                    )}
                    {currentBranch && currentBranch !== status.baseBranch && (
                      <Tag color="blue" style={{ fontSize: 11, marginInlineEnd: 0 }}>
                        Current: {currentBranch}
                      </Tag>
                    )}
                  </Space>
                )}

                {projectDetail?.mainRepoHasChanges && (
                  <Alert
                    message="Uncommitted changes in main repo"
                    description={
                      <Text style={{ fontSize: 12 }}>Files: {projectDetail.mainRepoChangedFiles?.join(', ')}</Text>
                    }
                    type="warning"
                    showIcon
                    style={{ marginLeft: 24, marginTop: 4, marginBottom: 8 }}
                  />
                )}

                {status?.exists &&
                  gitStats &&
                  (gitStats.filesChanged > 0 ||
                    gitStats.commits > 0 ||
                    gitStats.linesAdded > 0 ||
                    gitStats.linesDeleted > 0) && (
                    <Space size={[6, 6]} wrap style={{ paddingLeft: 24 }}>
                      {gitStats.filesChanged > 0 && (
                        <Tag color="default" style={{ fontSize: 11, marginInlineEnd: 0 }}>
                          {gitStats.filesChanged} file{gitStats.filesChanged !== 1 ? 's' : ''}
                        </Tag>
                      )}
                      {gitStats.commits > 0 && (
                        <Tag color="default" style={{ fontSize: 11, marginInlineEnd: 0 }}>
                          {gitStats.commits} commit{gitStats.commits !== 1 ? 's' : ''}
                        </Tag>
                      )}
                      {(gitStats.linesAdded > 0 || gitStats.linesDeleted > 0) && (
                        <Tag color="default" style={{ fontSize: 11, marginInlineEnd: 0 }}>
                          <span style={{ color: '#52c41a' }}>+{gitStats.linesAdded}</span>
                          <span style={{ color: 'rgba(15, 23, 42, 0.35)', margin: '0 6px' }}>/</span>
                          <span style={{ color: '#ff4d4f' }}>-{gitStats.linesDeleted}</span>
                        </Tag>
                      )}
                    </Space>
                  )}
              </div>
            </List.Item>
          )
        }}
      />
    </Card>
  )
}
