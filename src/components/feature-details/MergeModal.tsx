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
    mergeTargetBranch,
    mergeAvailableBranches,
    setMergeModalOpen,
    setSelectedProjectsForMerge,
    setMergeTargetBranch,
    handleExecuteMerge,
  } = ctx

  const sharedBranchOptions = Array.from(
    new Set(selectedProjectsForMerge.flatMap((projectName) => mergeAvailableBranches[projectName] || [])),
  ).map((branchName) => ({
    label: branchName,
    value: branchName,
  }))

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
                  label: `${p.name} (${p.branch})`,
                  value: p.name,
                })) || []
            }
          />
        </div>

        <div>
          <Text strong>Target Branch:</Text>
          <Select
            style={{ width: '100%', marginTop: 8 }}
            value={mergeTargetBranch}
            options={sharedBranchOptions}
            onChange={setMergeTargetBranch}
            placeholder="Select target branch"
          />
        </div>

        <Alert
          message="Merge flow"
          description={
            <div>
              <p>For each selected project, this will:</p>
              <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                <li>Fetch the latest remote refs</li>
                <li>Checkout the same selected target branch for all chosen projects</li>
                <li>Auto-pull the latest target branch code when remote exists</li>
                <li>Merge each feature branch into that chosen target branch</li>
              </ul>
              <p style={{ marginTop: 8, fontWeight: 600 }}>
                Uncommitted changes in the main repo will block merge preparation for that project.
              </p>
            </div>
          }
          type="warning"
          showIcon
        />
      </Space>
    </Modal>
  )
}
