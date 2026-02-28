import { Button, Space, Tooltip, Dropdown } from 'antd'
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
} from 'lucide-react'
import type { FeatureDetailsContext } from './types'

interface Props {
  ctx: FeatureDetailsContext
}

export function FeatureActions({ ctx }: Props) {
  const { feature, refreshing } = ctx
  if (!feature) return null

  const secondaryItems = [
    {
      key: 'sync-worktrees',
      label: 'Sync Worktrees',
      icon: <FolderSync size={14} />,
      onClick: ctx.handleSyncWorktrees,
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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 24,
        flexWrap: 'wrap',
      }}
    >
      {/* Primary action */}
      <Button type="primary" icon={<GitPullRequest size={14} />} onClick={ctx.handleGitSync}>
        Git Sync
      </Button>

      {/* Git actions */}
      <Button icon={<GitCommit size={14} />} onClick={ctx.handleCommitFeature}>
        Commit
      </Button>
      <Button icon={<GitMerge size={14} />} onClick={ctx.handleMergeFeature}>
        Merge
      </Button>

      {/* Refresh – icon-only */}
      <Tooltip title="Refresh status">
        <Button icon={<RefreshCw size={14} />} onClick={ctx.handleRefresh} loading={refreshing} />
      </Tooltip>

      {/* Overflow menu for less-frequent actions */}
      <Dropdown menu={{ items: secondaryItems }} trigger={['click']} placement="bottomRight">
        <Button icon={<MoreHorizontal size={14} />} />
      </Dropdown>
    </div>
  )
}
