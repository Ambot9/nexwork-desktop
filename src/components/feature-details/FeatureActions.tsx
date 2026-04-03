import { Button, Tooltip, Dropdown, Space, Card, Typography, Tag } from 'antd'
import {
  GitPullRequest,
  RefreshCw,
  FolderSync,
  Play,
  GitCommit,
  GitMerge,
  Calendar,
  MoreHorizontal,
  GitPullRequestCreate,
  FolderPlus,
} from 'lucide-react'
import type { FeatureDetailsContext } from './types'

interface Props {
  ctx: FeatureDetailsContext
}

export function FeatureActions({ ctx }: Props) {
  const { feature, refreshing } = ctx
  if (!feature) return null
  const memstackTracked = Boolean(feature.pluginRefs?.memstack?.tracked)

  const secondaryItems = [
    {
      key: 'sync-worktrees',
      label: 'Sync Worktrees',
      icon: <FolderSync size={14} />,
      onClick: ctx.handleSyncWorktrees,
    },
    {
      key: 'add-projects',
      label: 'Add Projects',
      icon: <FolderPlus size={14} />,
      onClick: ctx.handleAddProjects,
    },
    {
      key: 'run-command',
      label: 'Run Command',
      icon: <Play size={14} />,
      onClick: ctx.handleRunCommand,
    },
    {
      key: 'create-pr',
      label: 'Create PR',
      icon: <GitPullRequestCreate size={14} />,
      onClick: ctx.handleCreatePR,
    },
    {
      key: 'expiration',
      label: feature.expiresAt ? 'Extend Expiration' : 'Set Expiration',
      icon: <Calendar size={14} />,
      onClick: ctx.handleExtendExpiration,
    },
  ]

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%', marginBottom: 24 }}>
      <Card size="small" style={{ borderRadius: 16 }}>
        <Space size={[8, 8]} wrap>
          <Tag color="blue">Code Repos</Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Use Git Sync, Commit, and Merge for feature code changes.
          </Typography.Text>
          <Tag color="geekblue">Docs Repo</Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Feature Memory docs commit to the selected docs repository, not the feature repos.
          </Typography.Text>
          <Tag color={memstackTracked ? 'green' : 'default'}>Feature Memory</Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Sync final memory when the feature is ready to be stored.
          </Typography.Text>
        </Space>
      </Card>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          padding: '12px 14px',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          borderRadius: 18,
          background: 'rgba(255, 255, 255, 0.86)',
        }}
      >
        <Space wrap size={8}>
          <Button type="primary" icon={<GitPullRequest size={14} />} onClick={ctx.handleGitSync}>
            Git Sync
          </Button>
          <Button icon={<GitCommit size={14} />} onClick={ctx.handleCommitFeature}>
            Commit
          </Button>
          <Button icon={<GitMerge size={14} />} onClick={ctx.handleMergeFeature}>
            Merge
          </Button>
        </Space>

        <Space wrap size={8}>
          <Tooltip title="Refresh status">
            <Button icon={<RefreshCw size={14} />} onClick={ctx.handleRefresh} loading={refreshing}>
              Refresh
            </Button>
          </Tooltip>

          <Dropdown menu={{ items: secondaryItems }} trigger={['click']} placement="bottomRight">
            <Button icon={<MoreHorizontal size={14} />}>More</Button>
          </Dropdown>
        </Space>
      </div>
    </Space>
  )
}
