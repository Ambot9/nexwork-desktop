import { Modal, Space, Typography, Select, Input, Alert } from 'antd'
import { GitCommit } from 'lucide-react'
import type { FeatureDetailsContext } from './types'

const { Text } = Typography

interface Props {
  ctx: FeatureDetailsContext
}

export function CommitModal({ ctx }: Props) {
  const {
    feature,
    commitModalOpen,
    commitMessage,
    selectedProjectsForCommit,
    setCommitModalOpen,
    setCommitMessage,
    setSelectedProjectsForCommit,
    handleExecuteCommit,
  } = ctx

  return (
    <Modal
      title={
        <Space>
          <GitCommit size={20} />
          <span>Commit Changes</span>
        </Space>
      }
      open={commitModalOpen}
      onCancel={() => setCommitModalOpen(false)}
      onOk={handleExecuteCommit}
      okText="Commit"
      okButtonProps={{ icon: <GitCommit size={16} /> }}
      width="90%"
      style={{ maxWidth: 600 }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <Text strong>Select Projects to Commit:</Text>
          <Select
            mode="multiple"
            style={{ width: '100%', marginTop: 8 }}
            placeholder="Select projects"
            value={selectedProjectsForCommit}
            onChange={setSelectedProjectsForCommit}
            options={
              feature?.projects
                .filter((p) => p.worktreePath)
                .map((p) => ({
                  label: p.name,
                  value: p.name,
                })) || []
            }
          />
        </div>

        <div>
          <Text strong>Commit Message:</Text>
          <Input.TextArea
            rows={4}
            placeholder="Enter commit message (e.g., 'Add new feature functionality')"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            style={{ marginTop: 8 }}
          />
        </div>

        <Alert
          message="This will:"
          description={
            <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
              <li>
                Stage all changes (<code>git add .</code>)
              </li>
              <li>Commit with your message</li>
              <li>Changes will be ready to push</li>
            </ul>
          }
          type="info"
          showIcon
        />
      </Space>
    </Modal>
  )
}
