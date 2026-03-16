import React, { useState, useEffect } from 'react'
import { Card, Tabs, Timeline, Tag, Space, Typography, Empty, Spin, Badge } from 'antd'
import type { TabsProps } from 'antd'
import { GitCommitHorizontal, GitMerge } from 'lucide-react'

const { Text } = Typography

interface CommitTimelineProps {
  featureName: string
  projects: Array<{
    name: string
    worktreePath?: string
  }>
}

interface Commit {
  fullHash: string
  shortHash: string
  subject: string
  authorName: string
  authorDate: string
  isMerge: boolean
}

interface ProjectCommits {
  projectName: string
  baseBranch: string
  commits: Commit[]
}

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

function CommitTimeline({ featureName, projects }: CommitTimelineProps) {
  const projectsWithWorktrees = projects.filter((p) => p.worktreePath)

  const [activeProject, setActiveProject] = useState<string>(projectsWithWorktrees[0]?.name || '')
  const [projectCommits, setProjectCommits] = useState<{ [key: string]: ProjectCommits }>({})
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({})

  // Load commits for all projects on mount
  useEffect(() => {
    const loadAll = async () => {
      const promises = projectsWithWorktrees.map((p) => loadCommits(p.name, false))
      await Promise.all(promises)
    }
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Poll every 5s (silent)
  useEffect(() => {
    const poll = async () => {
      const promises = projectsWithWorktrees.map((p) => loadCommits(p.name, true))
      await Promise.all(promises)
    }

    const intervalId = setInterval(poll, 5000)
    return () => clearInterval(intervalId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureName])

  const loadCommits = async (projectName: string, silent: boolean) => {
    if (!silent) {
      setLoading((prev) => ({ ...prev, [projectName]: true }))
    }

    try {
      const result = await window.nexworkAPI.stats.getProjectCommits(featureName, projectName)
      if (result) {
        setProjectCommits((prev) => {
          const prevData = prev[projectName]
          if (prevData && JSON.stringify(prevData.commits) === JSON.stringify(result.commits)) {
            return prev
          }
          return { ...prev, [projectName]: result }
        })
      }
    } catch (error) {
      console.error('Failed to load commits:', error)
    } finally {
      if (!silent) {
        setLoading((prev) => ({ ...prev, [projectName]: false }))
      }
    }
  }

  if (projectsWithWorktrees.length === 0) {
    return null
  }

  const renderTabContent = (project: { name: string }) => {
    const isLoading = loading[project.name]
    const data = projectCommits[project.name]

    if (isLoading) {
      return (
        <Spin spinning tip="Loading commits...">
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Empty description="Loading..." />
          </div>
        </Spin>
      )
    }

    if (!data || data.commits.length === 0) {
      return (
        <Empty
          description={
            <Space direction="vertical" size={4}>
              <Text strong>No commits yet</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Commits will appear here after work is recorded in this project worktree.
              </Text>
            </Space>
          }
          style={{ padding: '40px 0 28px' }}
        />
      )
    }

    const timelineItems = data.commits.map((commit) => ({
      key: commit.fullHash,
      dot: commit.isMerge ? <GitMerge size={16} color="#722ed1" /> : <GitCommitHorizontal size={16} color="#1890ff" />,
      children: (
        <div>
          <Space size={8} align="start">
            <Tag style={{ fontFamily: 'Monaco, Menlo, Consolas, monospace', fontSize: 12 }}>{commit.shortHash}</Tag>
            {commit.isMerge && <Tag color="purple">merge</Tag>}
          </Space>
          <div style={{ marginTop: 4 }}>
            <Text strong style={{ fontSize: 13 }}>
              {commit.subject}
            </Text>
          </div>
          <div style={{ marginTop: 2 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {commit.authorName} &middot; {formatRelativeTime(commit.authorDate)}
            </Text>
          </div>
        </div>
      ),
    }))

    return (
      <div style={{ maxHeight: 500, overflow: 'auto', padding: '8px 0' }}>
        <Timeline items={timelineItems} />
      </div>
    )
  }

  const tabItems: TabsProps['items'] = projectsWithWorktrees.map((project) => {
    const data = projectCommits[project.name]
    const isLoading = loading[project.name]

    return {
      key: project.name,
      label: (
        <Space size={8}>
          <span style={{ fontWeight: 500 }}>{project.name}</span>
          {isLoading ? (
            <Spin size="small" />
          ) : data && data.commits.length > 0 ? (
            <Badge count={data.commits.length} showZero={false} style={{ backgroundColor: '#1890ff' }} />
          ) : null}
        </Space>
      ),
      children: renderTabContent(project),
    }
  })

  return (
    <Card title="Commit Timeline" style={{ marginBottom: 16, borderRadius: 18 }} bodyStyle={{ paddingTop: 12 }}>
      <Tabs activeKey={activeProject} onChange={setActiveProject} type="card" items={tabItems} />
    </Card>
  )
}

export default React.memo(CommitTimeline, (prevProps, nextProps) => {
  if (prevProps.featureName !== nextProps.featureName) return false
  if (prevProps.projects.length !== nextProps.projects.length) return false
  return prevProps.projects.every((p, i) => {
    const n = nextProps.projects[i]
    return p.name === n.name && p.worktreePath === n.worktreePath
  })
})
