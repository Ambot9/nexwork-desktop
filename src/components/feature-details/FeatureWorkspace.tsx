import { Card, Space, Typography, Tag, Alert, List } from 'antd'
import { FolderOpen, CheckCircle2, Clock } from 'lucide-react'
import type { FeatureDetailsContext } from './types'

const { Text } = Typography

interface Props {
  ctx: FeatureDetailsContext
}

export function FeatureWorkspace({ ctx }: Props) {
  const { feature, stats, featureFolderPath, projectWorktreeStatus, gitStatuses, localFeatureBranches } = ctx

  if (!featureFolderPath || !feature) return null

  return (
    <Card
      bodyStyle={{ padding: '8px 20px 12px' }}
      title={
        <Space size={8}>
          <FolderOpen size={16} />
          <span>Feature Workspace</span>
          <Tag color="green" style={{ marginLeft: 4 }}>
            Active
          </Tag>
        </Space>
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
          const currentBranch = gitStatuses?.[project.name]?.branch

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
                        Worktree Created Locally
                      </Tag>
                    ) : (
                      <Tag color="orange" style={{ fontSize: 11, marginInlineEnd: 0 }}>
                        Remote Not Created
                      </Tag>
                    )}
                    {localFeatureBranches[project.name] && currentBranch !== project.branch && status?.exists && (
                      <Tag color="orange" style={{ fontSize: 11, marginInlineEnd: 0 }}>
                        Remote Not Created
                      </Tag>
                    )}
                  </Space>
                </div>

                {status?.exists && (status.baseBranch || currentBranch) && (
                  <Space size={[6, 6]} wrap style={{ paddingLeft: 24, marginBottom: 8 }}>
                    {status.baseBranch && (
                      <Tag color="default" style={{ fontSize: 11, marginInlineEnd: 0 }}>
                        Base: {status.baseBranch}
                      </Tag>
                    )}
                    {currentBranch && (
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

                {status?.exists && gitStats && (
                  <Space size={[6, 6]} wrap style={{ paddingLeft: 24 }}>
                    <Tag color="default" style={{ fontSize: 11, marginInlineEnd: 0 }}>
                      {gitStats.filesChanged} file{gitStats.filesChanged !== 1 ? 's' : ''}
                    </Tag>
                    <Tag color="default" style={{ fontSize: 11, marginInlineEnd: 0 }}>
                      {gitStats.commits} commit{gitStats.commits !== 1 ? 's' : ''}
                    </Tag>
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
