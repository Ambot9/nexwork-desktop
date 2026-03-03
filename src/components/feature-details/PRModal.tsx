import { useState, useEffect } from 'react'
import { Modal, Space, Typography, Select, Input, Alert, Button, Switch, List } from 'antd'
import { GitPullRequest, ExternalLink } from 'lucide-react'
import type { FeatureDetailsContext } from './types'

const { Text } = Typography

interface PRResult {
  projectName: string
  prUrl?: string
  error?: string
}

interface Props {
  ctx: FeatureDetailsContext
}

export function PRModal({ ctx }: Props) {
  const { feature, prModalOpen, worktreeInfo, setPrModalOpen } = ctx

  const [ghStatus, setGhStatus] = useState<{ installed: boolean; authenticated: boolean } | null>(null)
  const [checking, setChecking] = useState(false)
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [draft, setDraft] = useState(false)
  const [creating, setCreating] = useState(false)
  const [results, setResults] = useState<PRResult[]>([])

  useEffect(() => {
    if (prModalOpen) {
      setResults([])
      setTitle(feature?.name.replace(/[_-]/g, ' ') || '')
      setBody('')
      setDraft(false)
      setSelectedProjects([])
      checkGhCli()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prModalOpen])

  const checkGhCli = async () => {
    setChecking(true)
    try {
      const status = await window.nexworkAPI.pullRequests.checkGhCli()
      setGhStatus(status)
    } catch {
      setGhStatus({ installed: false, authenticated: false })
    } finally {
      setChecking(false)
    }
  }

  const eligibleProjects =
    feature?.projects.filter((p) => {
      const hasWorktree = p.worktreePath || worktreeInfo[p.name]
      return hasWorktree && p.branch
    }) || []

  const handleCreate = async () => {
    if (!selectedProjects.length || !title.trim()) return
    setCreating(true)
    setResults([])
    try {
      const projects = selectedProjects.map((name) => {
        const project = feature!.projects.find((p) => p.name === name)!
        const workingDir = worktreeInfo[name] || project.worktreePath || ''
        return {
          projectName: name,
          workingDir,
          branch: project.branch,
          baseBranch: project.baseBranch || 'staging',
        }
      })
      const response = await window.nexworkAPI.pullRequests.create(projects, {
        title: title.trim(),
        body: body.trim(),
        draft,
      })
      setResults(response.results)
    } catch (error: any) {
      setResults(selectedProjects.map((name) => ({ projectName: name, error: error.message })))
    } finally {
      setCreating(false)
    }
  }

  const handleOpenUrl = (url: string) => {
    window.open(url, '_blank')
  }

  const renderGhNotReady = () => {
    if (!ghStatus) return null
    if (!ghStatus.installed) {
      return (
        <Alert
          type="error"
          showIcon
          message="GitHub CLI not found"
          description={
            <div>
              <p>
                The <code>gh</code> CLI is required to create pull requests.
              </p>
              <p>
                Install it with: <code>brew install gh</code>
              </p>
              <p>
                Then authenticate: <code>gh auth login</code>
              </p>
            </div>
          }
        />
      )
    }
    if (!ghStatus.authenticated) {
      return (
        <Alert
          type="warning"
          showIcon
          message="GitHub CLI not authenticated"
          description={
            <div>
              <p>
                Run <code>gh auth login</code> in your terminal to authenticate.
              </p>
            </div>
          }
        />
      )
    }
    return null
  }

  const isReady = ghStatus?.installed && ghStatus?.authenticated

  return (
    <Modal
      title={
        <Space>
          <GitPullRequest size={20} />
          <span>Create Pull Requests</span>
        </Space>
      }
      open={prModalOpen}
      onCancel={() => setPrModalOpen(false)}
      onOk={handleCreate}
      okText="Create PRs"
      okButtonProps={{
        icon: <GitPullRequest size={16} />,
        disabled: !isReady || !selectedProjects.length || !title.trim(),
      }}
      confirmLoading={creating}
      width="90%"
      style={{ maxWidth: 650 }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {checking && <Alert message="Checking GitHub CLI status..." type="info" showIcon />}

        {renderGhNotReady()}

        {isReady && (
          <>
            <div>
              <Text strong>Select Projects:</Text>
              <Select
                mode="multiple"
                style={{ width: '100%', marginTop: 8 }}
                placeholder="Select projects to create PRs for"
                value={selectedProjects}
                onChange={setSelectedProjects}
                options={eligibleProjects.map((p) => ({
                  label: `${p.name} (${p.branch} → ${p.baseBranch || 'staging'})`,
                  value: p.name,
                }))}
              />
            </div>

            <div>
              <Text strong>PR Title:</Text>
              <Input
                style={{ marginTop: 8 }}
                placeholder="Pull request title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <Text strong>PR Description:</Text>
              <Input.TextArea
                rows={4}
                style={{ marginTop: 8 }}
                placeholder="Optional description"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch checked={draft} onChange={setDraft} size="small" />
              <Text>Create as draft PR</Text>
            </div>
          </>
        )}

        {results.length > 0 && (
          <div>
            <Text strong>Results:</Text>
            <List
              size="small"
              dataSource={results}
              renderItem={(r) => (
                <List.Item>
                  <Space>
                    <Text strong>{r.projectName}:</Text>
                    {r.prUrl ? (
                      <Button
                        type="link"
                        size="small"
                        icon={<ExternalLink size={12} />}
                        onClick={() => handleOpenUrl(r.prUrl!)}
                      >
                        {r.prUrl}
                      </Button>
                    ) : (
                      <Text type="danger">{r.error}</Text>
                    )}
                  </Space>
                </List.Item>
              )}
              style={{ marginTop: 8 }}
            />
          </div>
        )}
      </Space>
    </Modal>
  )
}
