import { useState } from 'react'
import { Modal, Space, Typography, Select, Input, Button, Card, Alert, Spin } from 'antd'
import { Save, X } from 'lucide-react'
import type { FeatureDetailsContext } from './types'
import { COMMON_COMMANDS, isLongRunningCommand } from './types'
import type { SavedCommand } from './types'

const { Text } = Typography

const SAVED_COMMANDS_KEY = 'nexwork-savedCommands'

function loadSavedCommands(): SavedCommand[] {
  try {
    const raw = localStorage.getItem(SAVED_COMMANDS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistSavedCommands(cmds: SavedCommand[]) {
  localStorage.setItem(SAVED_COMMANDS_KEY, JSON.stringify(cmds))
}

interface Props {
  ctx: FeatureDetailsContext
}

export function RunCommandModal({ ctx }: Props) {
  const {
    feature,
    commandModalOpen,
    command,
    commandRunning,
    commandOutput,
    commandError,
    selectedProject,
    worktreeInfo,
    setCommandModalOpen,
    setCommand,
    setSelectedProject,
    handleExecuteCommand,
  } = ctx

  const [savedCommands, setSavedCommands] = useState<SavedCommand[]>(loadSavedCommands)
  const [prevOpen, setPrevOpen] = useState(false)
  if (commandModalOpen && !prevOpen) {
    setSavedCommands(loadSavedCommands())
  }
  if (commandModalOpen !== prevOpen) {
    setPrevOpen(commandModalOpen)
  }

  const handleSaveCommand = () => {
    const trimmed = command.trim()
    if (!trimmed) return
    if (savedCommands.some((c) => c.command === trimmed)) return
    const newCmd: SavedCommand = {
      id: Date.now().toString(),
      label: trimmed.length > 30 ? trimmed.substring(0, 30) + '...' : trimmed,
      command: trimmed,
    }
    const updated = [...savedCommands, newCmd]
    setSavedCommands(updated)
    persistSavedCommands(updated)
  }

  const handleDeleteSavedCommand = (id: string) => {
    const updated = savedCommands.filter((c) => c.id !== id)
    setSavedCommands(updated)
    persistSavedCommands(updated)
  }

  const renderWorkingDir = () => {
    if (selectedProject === 'workspace') return null

    const featureProject = feature?.projects.find((p) => p.name === selectedProject)
    const hasWorktree = worktreeInfo[selectedProject] || featureProject?.worktreePath
    const worktreePath = worktreeInfo[selectedProject] || featureProject?.worktreePath

    if (hasWorktree) {
      return (
        <Text type="success" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
          Will run in worktree: {worktreePath}
        </Text>
      )
    }
    return (
      <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
        Will run in main repo (no worktree for this feature yet)
      </Text>
    )
  }

  return (
    <Modal
      title="Run Command"
      open={commandModalOpen}
      onCancel={() => setCommandModalOpen(false)}
      onOk={handleExecuteCommand}
      confirmLoading={commandRunning}
      okText="Run"
      width="90%"
      style={{ maxWidth: 700 }}
      styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <Text strong>Select Project:</Text>
          <Select
            style={{ width: '100%', marginTop: 8 }}
            value={selectedProject}
            onChange={setSelectedProject}
            options={[
              { label: 'Workspace Root', value: 'workspace' },
              ...(feature?.projects.map((p) => {
                const hasWorktree = worktreeInfo[p.name] || p.worktreePath
                return {
                  label: hasWorktree ? `${p.name} (Worktree)` : p.name,
                  value: p.name,
                }
              }) || []),
            ]}
          />
          {renderWorkingDir()}
        </div>

        <div>
          <Text strong>Command:</Text>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Input
              style={{ flex: 1 }}
              placeholder="e.g., git status, npm run build"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onPressEnter={handleExecuteCommand}
              disabled={commandRunning}
              autoFocus
            />
            <Button
              icon={<Save size={14} />}
              onClick={handleSaveCommand}
              disabled={!command.trim() || commandRunning}
              title="Save command"
            >
              Save
            </Button>
          </div>
        </div>

        <div>
          <Text strong>Quick Commands:</Text>
          <div style={{ marginTop: 8 }}>
            <Space wrap size="small">
              {COMMON_COMMANDS.map((cmd) => (
                <Button
                  key={cmd.value}
                  size="small"
                  onClick={() => setCommand(cmd.value)}
                  disabled={commandRunning}
                  type={!cmd.safe ? 'primary' : 'default'}
                  danger={!cmd.safe}
                >
                  {cmd.label}
                </Button>
              ))}
            </Space>
          </div>
          <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
            Red buttons = long-running commands
          </Text>
        </div>

        {savedCommands.length > 0 && (
          <div>
            <Text strong>My Commands:</Text>
            <div style={{ marginTop: 8 }}>
              <Space wrap size="small">
                {savedCommands.map((cmd) => (
                  <Button.Group key={cmd.id} size="small">
                    <Button onClick={() => setCommand(cmd.command)} disabled={commandRunning} title={cmd.command}>
                      {cmd.label}
                    </Button>
                    <Button
                      icon={<X size={12} />}
                      onClick={() => handleDeleteSavedCommand(cmd.id)}
                      disabled={commandRunning}
                      style={{ padding: '0 4px' }}
                    />
                  </Button.Group>
                ))}
              </Space>
            </div>
          </div>
        )}

        {command && isLongRunningCommand(command) && !commandRunning && (
          <Alert
            message="Long-Running Command"
            description="This command may take some time to complete. The timeout is 5 minutes."
            type="warning"
            showIcon
          />
        )}

        {commandRunning && (
          <Alert
            message={
              <Space>
                <Spin size="small" />
                <span>Running command...</span>
              </Space>
            }
            description="Please wait. This may take up to 5 minutes."
            type="info"
            showIcon={false}
          />
        )}

        {commandError && (
          <Alert
            message="Command Failed"
            description={
              <pre
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'monospace',
                  fontSize: 12,
                }}
              >
                {commandError}
              </pre>
            }
            type="error"
            showIcon
          />
        )}

        {commandOutput && (
          <div>
            <Text strong>Output:</Text>
            <Card
              size="small"
              style={{
                marginTop: 8,
                backgroundColor: '#1e1e1e',
                maxHeight: '300px',
                overflow: 'auto',
              }}
            >
              <pre
                style={{
                  margin: 0,
                  color: '#d4d4d4',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                {commandOutput}
              </pre>
            </Card>
          </div>
        )}
      </Space>
    </Modal>
  )
}
