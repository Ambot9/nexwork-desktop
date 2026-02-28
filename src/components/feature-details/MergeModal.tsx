import { Modal, Space, Typography, Select, Alert } from 'antd'
import { GitMerge } from 'lucide-react'
import type { FeatureDetailsContext } from './types'

const { Text } = Typography

interface Props {
  ctx: FeatureDetailsContext
}

export function MergeModal({ ctx }: Props) {
  const {
    feature,
    mergeModalOpen,
    selectedProjectsForMerge,
    setMergeModalOpen,
    setSelectedProjectsForMerge,
    handleExecuteMerge,
  } = ctx

  return (
    <Modal
      title={
        <Space>
          <GitMerge size={20} />
          <span>Merge Feature Branches</span>
        </Space>
      }
      open={mergeModalOpen}
      onCancel={() => setMergeModalOpen(false)}
      onOk={handleExecuteMerge}
      okText="Merge"
      okButtonProps={{ icon: <GitMerge size={16} />, danger: true }}
      okType="danger"
      width="90%"
      style={{ maxWidth: 600 }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <Text strong>Select Projects to Merge:</Text>
          <Select
            mode="multiple"
            style={{ width: '100%', marginTop: 8 }}
            placeholder="Select projects"
            value={selectedProjectsForMerge}
            onChange={setSelectedProjectsForMerge}
            options={
              feature?.projects
                .filter((p) => p.worktreePath)
                .map((p) => ({
                  label: `${p.name} (${p.branch} → ${(p as any).baseBranch || 'staging'})`,
                  value: p.name,
                })) || []
            }
          />
        </div>

        <Alert
          message="Warning: This will merge feature branches"
          description={
            <div>
              <p>For each selected project, this will:</p>
              <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                <li>Checkout the base branch (staging/demo/main)</li>
                <li>Pull latest changes from remote</li>
                <li>Merge the feature branch into base branch</li>
              </ul>
              <p style={{ marginTop: 8, fontWeight: 600 }}>Make sure you've committed and pushed your changes first!</p>
            </div>
          }
          type="warning"
          showIcon
        />
      </Space>
    </Modal>
  )
}
