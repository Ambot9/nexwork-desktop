import { Card, Space, Typography, Tag, Alert, List } from 'antd'
import { FolderOpen, CheckCircle2, Clock } from 'lucide-react'
import type { FeatureDetailsContext } from './types'

const { Text } = Typography

interface Props {
  ctx: FeatureDetailsContext
}

export function FeatureWorkspace({ ctx }: Props) {
  const { feature, stats, featureFolderPath, projectWorktreeStatus } = ctx

  if (!featureFolderPath || !feature) return null

  return (
    <Card
      title={
        <Space>
          <FolderOpen size={16} />
          <span>Feature Workspace</span>
          <Tag color="green" style={{ marginLeft: 4 }}>
            Active
          </Tag>
        </Space>
      }
      extra={
        <Text code style={{ fontSize: 12, opacity: 0.7 }}>
          {featureFolderPath}
        </Text>
      }
      style={{ marginBottom: 16 }}
    >
      <List
        size="small"
        dataSource={feature.projects}
        renderItem={(project) => {
          const status = projectWorktreeStatus[project.name]
          const projectDetail = stats?.projectDetails?.find((p: any) => p.name === project.name) as any
          const gitStats = projectDetail?.gitStats

          return (
            <List.Item style={{ padding: '10px 0' }}>
              <Space direction="vertical" style={{ width: '100%' }} size={4}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space size={8}>
                    {status?.exists ? <CheckCircle2 size={14} color="#52c41a" /> : <Clock size={14} color="#faad14" />}
                    <Text strong style={{ fontSize: 13 }}>
                      {project.name}
                    </Text>
                    {status?.exists ? (
                      <Tag color="green" style={{ fontSize: 11 }}>
                        Worktree
                      </Tag>
                    ) : (
                      <Tag color="orange" style={{ fontSize: 11 }}>
                        Not Created
                      </Tag>
                    )}
                    {status?.exists && status.baseBranch && (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {status.baseBranch}
                      </Text>
                    )}
                  </Space>
                </Space>

                {projectDetail?.mainRepoHasChanges && (
                  <Alert
                    message="Uncommitted changes in main repo"
                    description={
                      <Text style={{ fontSize: 12 }}>Files: {projectDetail.mainRepoChangedFiles?.join(', ')}</Text>
                    }
                    type="warning"
                    showIcon
                    closable
                    style={{ marginLeft: 22, marginTop: 4 }}
                  />
                )}

                {status?.exists && gitStats && (
                  <Space size={8} style={{ paddingLeft: 22, fontSize: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {gitStats.filesChanged} file{gitStats.filesChanged !== 1 ? 's' : ''}
                    </Text>
                    <Text type="secondary">·</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {gitStats.commits} commit{gitStats.commits !== 1 ? 's' : ''}
                    </Text>
                    {(gitStats.linesAdded > 0 || gitStats.linesDeleted > 0) && (
                      <>
                        <Text type="secondary">·</Text>
                        <Text style={{ color: '#52c41a', fontSize: 12 }}>+{gitStats.linesAdded}</Text>
                        <Text style={{ color: '#ff4d4f', fontSize: 12 }}>-{gitStats.linesDeleted}</Text>
                      </>
                    )}
                  </Space>
                )}
              </Space>
            </List.Item>
          )
        }}
      />
    </Card>
  )
}
