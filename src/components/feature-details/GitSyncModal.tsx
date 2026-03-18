import { Modal, Space, Typography, Button, List, Badge, Tag, Tooltip } from 'antd'
import {
  GitPullRequest,
  GitBranch,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderPlus,
  Trash2,
} from 'lucide-react'
import type { FeatureDetailsContext } from './types'

const { Text } = Typography

interface Props {
  ctx: FeatureDetailsContext
}

export function GitSyncModal({ ctx }: Props) {
  const {
    feature,
    gitModalOpen,
    gitStatuses,
    gitOperations,
    worktreeInfo,
    creatingWorktrees,
    localFeatureBranches,
    setGitModalOpen,
    handleGitPull,
    handleGitPush,
    fetchGitStatus,
    handleCreateWorktree,
    handleCleanupWorktrees,
    handlePullAll,
    handlePushAll,
  } = ctx

  return (
    <Modal
      title={
        <Space>
          <GitPullRequest size={20} />
          <span>Git Sync - All Projects</span>
        </Space>
      }
      open={gitModalOpen}
      onCancel={() => setGitModalOpen(false)}
      width="90%"
      style={{ maxWidth: 800 }}
      footer={
        <Space>
          <Button onClick={() => setGitModalOpen(false)}>Close</Button>
          <Tooltip title="Remove stale worktree references (git worktree prune)">
            <Button icon={<Trash2 size={16} />} onClick={handleCleanupWorktrees}>
              Cleanup Worktrees
            </Button>
          </Tooltip>
          <Tooltip title="Create worktrees (if needed) and pull all projects">
            <Button type="primary" icon={<ArrowDown size={16} />} onClick={handlePullAll}>
              Setup & Pull All
            </Button>
          </Tooltip>
          <Button type="primary" icon={<ArrowUp size={16} />} onClick={handlePushAll} danger>
            Push All
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <List
          dataSource={feature?.projects || []}
          renderItem={(project) => {
            const status = gitStatuses[project.name]
            const ops = gitOperations[project.name] || { pulling: false, pushing: false, fetching: false }

            return (
              <List.Item
                actions={[
                  !project.worktreePath && !worktreeInfo[project.name] ? (
                    <Tooltip key="create" title="Create worktree for this project">
                      <Button
                        icon={<FolderPlus size={14} />}
                        onClick={() => handleCreateWorktree(project.name)}
                        loading={creatingWorktrees[project.name]}
                        type="primary"
                      >
                        Create Worktree
                      </Button>
                    </Tooltip>
                  ) : (
                    <Tooltip key="pull" title="Pull changes from remote">
                      <Button
                        icon={<ArrowDown size={14} />}
                        loading={ops.pulling}
                        disabled={ops.pushing}
                        onClick={() => handleGitPull(project.name)}
                        type={status?.behind > 0 ? 'primary' : 'default'}
                      >
                        Pull {status?.behind > 0 && `(${status.behind})`}
                      </Button>
                    </Tooltip>
                  ),
                  project.worktreePath && (
                    <Tooltip key="push" title="Push changes to remote">
                      <Button
                        icon={<ArrowUp size={14} />}
                        loading={ops.pushing}
                        disabled={ops.pulling}
                        onClick={() => handleGitPush(project.name)}
                        type={status?.ahead > 0 ? 'primary' : 'default'}
                        danger={status?.ahead > 0}
                      >
                        Push {status?.ahead > 0 && `(${status.ahead})`}
                      </Button>
                    </Tooltip>
                  ),
                  project.worktreePath && (
                    <Tooltip key="refresh" title="Refresh status">
                      <Button
                        icon={<RefreshCw size={14} />}
                        loading={ops.fetching}
                        onClick={() => fetchGitStatus(project.name)}
                        size="small"
                      />
                    </Tooltip>
                  ),
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  avatar={
                    <Badge
                      status={
                        status?.ahead > 0 && status?.behind > 0
                          ? 'warning'
                          : status?.ahead > 0
                            ? 'error'
                            : status?.behind > 0
                              ? 'processing'
                              : 'success'
                      }
                    />
                  }
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                      <GitBranch size={16} />
                      <Text strong style={{ whiteSpace: 'nowrap' }}>
                        {project.name}
                      </Text>

                      <Tag color="default">Base: {project.baseBranch || 'staging'}</Tag>

                      {status?.branch && (
                        <Tooltip title="Main repo currently checked out here">
                          <Tag color="processing">Current: {status.branch}</Tag>
                        </Tooltip>
                      )}

                      {localFeatureBranches[project.name] && status?.branch !== project.branch ? (
                        <Tooltip title="Local branch exists and ready to create worktree">
                          <Tag color="green" icon={<CheckCircle2 size={12} />}>
                            {project.branch} (Local)
                          </Tag>
                        </Tooltip>
                      ) : status?.branch === project.branch ? (
                        <Tag color="blue">{project.branch}</Tag>
                      ) : (
                        <Tooltip title="Remote branch has not been created yet. Create the worktree or push the branch to publish it remotely.">
                          <Tag color="orange">{project.branch} (Remote not created)</Tag>
                        </Tooltip>
                      )}
                    </div>
                  }
                  description={
                    <Space direction="vertical" size="small">
                      <Space size="large">
                        {status ? (
                          status.ahead === -1 ? (
                            <Text type="danger">
                              <AlertCircle size={12} style={{ display: 'inline', marginRight: 4 }} />
                              Offline - Cannot reach server
                            </Text>
                          ) : status.isLocalOnly ? (
                            <Text type="warning">
                              <GitBranch size={12} style={{ display: 'inline', marginRight: 4 }} />
                              Local only - Push to create on remote
                            </Text>
                          ) : (
                            <>
                              <Text type="secondary">
                                <ArrowUp size={12} style={{ display: 'inline', marginRight: 4 }} />
                                {status.ahead} ahead
                              </Text>
                              <Text type="secondary">
                                <ArrowDown size={12} style={{ display: 'inline', marginRight: 4 }} />
                                {status.behind} behind
                              </Text>
                              {status.ahead === 0 && status.behind === 0 && (
                                <Text type="success">
                                  <CheckCircle2 size={12} style={{ display: 'inline', marginRight: 4 }} />
                                  Up to date
                                </Text>
                              )}
                            </>
                          )
                        ) : (
                          <Text type="secondary">Click refresh to check status</Text>
                        )}
                      </Space>
                    </Space>
                  }
                />
              </List.Item>
            )
          }}
        />
      </Space>
    </Modal>
  )
}
