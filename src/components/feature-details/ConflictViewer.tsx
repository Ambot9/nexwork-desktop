import { Card, Alert, Button, Space, List, Typography } from 'antd'
import { FileWarning, FolderOpen, XCircle, CheckCircle } from 'lucide-react'
import type { FeatureDetailsContext } from './types'
import { IDE_NAMES } from './types'

const { Text } = Typography

interface Props {
  ctx: FeatureDetailsContext
}

export function ConflictViewer({ ctx }: Props) {
  const { conflictInfo, preferredIDE, handleOpenInIDE, handleAbortMerge, handleMarkResolved } = ctx

  if (!conflictInfo) return null

  const { projectName, files, workingDir } = conflictInfo

  const handleOpenFileInIDE = async (filePath: string) => {
    const fullPath = `${workingDir}/${filePath}`
    await window.nexworkAPI.openInIDE(workingDir, preferredIDE || 'vscode')
  }

  const handleOpenAllInIDE = async () => {
    await window.nexworkAPI.openInIDE(workingDir, preferredIDE || 'vscode')
  }

  return (
    <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: 16 } }}>
      <Alert
        type="warning"
        showIcon
        icon={<FileWarning size={16} />}
        message={`Merge conflicts in ${projectName} — ${files.length} file${files.length === 1 ? '' : 's'} need${files.length === 1 ? 's' : ''} resolution`}
        style={{ marginBottom: 12 }}
      />

      <List
        size="small"
        dataSource={files}
        renderItem={(file) => (
          <List.Item
            style={{ padding: '4px 0' }}
            actions={[
              <Button key="open" size="small" type="link" onClick={() => handleOpenFileInIDE(file)}>
                Open in {IDE_NAMES[preferredIDE] || 'IDE'}
              </Button>,
            ]}
          >
            <Text code style={{ fontSize: 12 }}>
              {file}
            </Text>
          </List.Item>
        )}
        style={{ marginBottom: 12 }}
      />

      <Space>
        <Button icon={<FolderOpen size={14} />} onClick={handleOpenAllInIDE}>
          Open All in {IDE_NAMES[preferredIDE] || 'IDE'}
        </Button>
        <Button icon={<XCircle size={14} />} danger onClick={handleAbortMerge}>
          Abort Merge
        </Button>
        <Button icon={<CheckCircle size={14} />} type="primary" onClick={handleMarkResolved}>
          Mark Resolved
        </Button>
      </Space>
    </Card>
  )
}
