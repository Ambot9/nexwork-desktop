import React, { useState, useEffect } from 'react'
import { Card, Tabs, List, Typography, Space, Spin, Empty, Tag, Badge, Segmented, Tooltip } from 'antd'
import type { TabsProps } from 'antd'
import { FileText, FilePlus, FileX, FileCode, Loader, SplitSquareHorizontal, AlignLeft, GitCompare } from 'lucide-react'

const { Text } = Typography

interface ChangesViewerProps {
  featureName: string
  projects: Array<{
    name: string
    worktreePath?: string
  }>
}

interface FileChange {
  path: string
  status: string
  diff: string
  source?: string // 'committed' or 'working'
}

interface ProjectDiff {
  projectName: string
  baseBranch: string
  files: FileChange[]
}

function ChangesViewer({ featureName, projects }: ChangesViewerProps) {
  
  const [activeProject, setActiveProject] = useState<string>(projects[0]?.name || '')
  const [projectDiffs, setProjectDiffs] = useState<{ [key: string]: ProjectDiff }>({})
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({})
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'split' | 'inline' | 'hunk'>(() => {
    return (localStorage.getItem('diffViewMode') as 'split' | 'inline' | 'hunk') || 'split'
  })

  // Pre-load all project diffs on mount to show badges
  useEffect(() => {
    const loadAllDiffs = async () => {
      // Load all diffs in parallel for better performance
      const loadPromises = projects
        .filter(p => p.worktreePath)
        .map(p => loadProjectDiff(p.name, false)) // false = show loading spinner
      
      await Promise.all(loadPromises)
    }
    loadAllDiffs()
  }, [])

  // Auto-reload diffs every 2 seconds to detect new changes
  useEffect(() => {
    const reloadAllDiffs = async () => {
      // Silently reload all project diffs (silent = true to avoid loading spinners)
      const loadPromises = projects
        .filter(p => p.worktreePath)
        .map(p => loadProjectDiff(p.name, true)) // true = silent mode
      
      await Promise.all(loadPromises)
    }

    // Set up interval to reload every 2 seconds for fast updates
    const intervalId = setInterval(() => {
      reloadAllDiffs()
    }, 2000)

    // Cleanup interval on unmount
    return () => clearInterval(intervalId)
  }, [featureName]) // Only depend on featureName, not projects array

  // Reset selected file when switching projects
  useEffect(() => {
    setSelectedFile(null)
  }, [activeProject])

  const loadProjectDiff = async (projectName: string, silent = false) => {
    if (!silent) {
      setLoading(prev => ({ ...prev, [projectName]: true }))
    }
    
    try {
      const diff = await window.nexworkAPI.stats.getProjectDiff(featureName, projectName, false)
      
      if (diff) {
        setProjectDiffs(prev => {
          // Only update if content actually changed (prevent unnecessary re-renders)
          const prevDiff = prev[projectName]
          if (prevDiff && JSON.stringify(prevDiff.files) === JSON.stringify(diff.files)) {
            return prev // No change, don't update state
          }
          return { ...prev, [projectName]: diff }
        })
        
        // Auto-select first file (only on initial load, not silent reload)
        if (!silent && diff.files.length > 0 && !selectedFile) {
          setSelectedFile(diff.files[0].path)
        }
      }
    } catch (error) {
      console.error('Failed to load project diff:', error)
    } finally {
      if (!silent) {
        setLoading(prev => ({ ...prev, [projectName]: false }))
      }
    }
  }

  const getFileIcon = (status: string) => {
    switch (status) {
      case 'A': return <FilePlus size={16} color="#52c41a" />
      case 'D': return <FileX size={16} color="#ff4d4f" />
      case 'M': return <FileText size={16} color="#1890ff" />
      default: return <FileCode size={16} />
    }
  }

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'A': return <Tag color="success">Added</Tag>
      case 'D': return <Tag color="error">Deleted</Tag>
      case 'M': return <Tag color="processing">Modified</Tag>
      default: return <Tag>{status}</Tag>
    }
  }

  const parseDiff = (diff: string) => {
    const lines = diff.split('\n')
    const hunks: Array<{ before: string[], after: string[], lineNumbers: { before: number, after: number } }> = []
    
    let currentHunk: any = null
    let beforeLineNum = 0
    let afterLineNum = 0

    for (const line of lines) {
      // Skip diff headers
      if (line.startsWith('diff --git') || line.startsWith('index ') || 
          line.startsWith('---') || line.startsWith('+++')) {
        continue
      }

      // Parse hunk header: @@ -1,5 +1,6 @@
      if (line.startsWith('@@')) {
        if (currentHunk) {
          hunks.push(currentHunk)
        }
        
        const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/)
        if (match) {
          beforeLineNum = parseInt(match[1])
          afterLineNum = parseInt(match[2])
          currentHunk = {
            before: [],
            after: [],
            lineNumbers: { before: beforeLineNum, after: afterLineNum }
          }
        }
        continue
      }

      if (!currentHunk) continue

      if (line.startsWith('-')) {
        // Line removed
        currentHunk.before.push({ type: 'removed', content: line.slice(1), lineNum: beforeLineNum })
        currentHunk.after.push({ type: 'empty', content: '', lineNum: null })
        beforeLineNum++
      } else if (line.startsWith('+')) {
        // Line added
        currentHunk.before.push({ type: 'empty', content: '', lineNum: null })
        currentHunk.after.push({ type: 'added', content: line.slice(1), lineNum: afterLineNum })
        afterLineNum++
      } else {
        // Context line (unchanged)
        currentHunk.before.push({ type: 'context', content: line.slice(1), lineNum: beforeLineNum })
        currentHunk.after.push({ type: 'context', content: line.slice(1), lineNum: afterLineNum })
        beforeLineNum++
        afterLineNum++
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk)
    }

    return hunks
  }

  const renderInlineDiff = (fileChange: FileChange) => {
    if (!fileChange.diff) {
      return <Empty description="No diff available" />
    }

    const hunks = parseDiff(fileChange.diff)

    return (
      <div style={{ fontFamily: 'monospace', fontSize: 13, overflow: 'auto', border: '1px solid #e8e8e8', borderRadius: 4 }}>
        <div style={{ 
          padding: '10px 16px', 
          background: '#fafafa', 
          fontWeight: 600, 
          fontSize: 13,
          borderBottom: '2px solid #d9d9d9',
          position: 'sticky',
          top: 0,
          zIndex: 1,
          color: '#595959'
        }}>
          Unified Diff
        </div>
        {hunks.map((hunk, idx) => (
          <div key={idx}>
            {/* Combine before and after lines in order */}
            {(() => {
              const combined: any[] = []
              let beforeIdx = 0
              let afterIdx = 0
              
              while (beforeIdx < hunk.before.length || afterIdx < hunk.after.length) {
                const beforeLine = hunk.before[beforeIdx]
                const afterLine = hunk.after[afterIdx]
                
                if (beforeLine?.type === 'removed') {
                  combined.push({ ...beforeLine, side: 'removed' })
                  beforeIdx++
                } else if (afterLine?.type === 'added') {
                  combined.push({ ...afterLine, side: 'added' })
                  afterIdx++
                } else if (beforeLine?.type === 'context') {
                  combined.push({ ...beforeLine, side: 'context' })
                  beforeIdx++
                  afterIdx++
                } else {
                  beforeIdx++
                  afterIdx++
                }
              }
              
              return combined.map((line, lineIdx) => (
                <div
                  key={lineIdx}
                  style={{
                    display: 'flex',
                    background: line.side === 'removed' ? '#ffeef0' : 
                               line.side === 'added' ? '#f6ffed' : 'transparent',
                    padding: '3px 12px',
                    borderLeft: line.side === 'removed' ? '3px solid #ff4d4f' : 
                               line.side === 'added' ? '3px solid #52c41a' : '3px solid transparent',
                    minHeight: '22px'
                  }}
                >
                  <div style={{ 
                    width: 30, 
                    color: '#8c8c8c', 
                    textAlign: 'center', 
                    marginRight: 8,
                    userSelect: 'none',
                    fontFamily: 'Monaco, Menlo, Consolas, monospace',
                    fontSize: 12
                  }}>
                    {line.side === 'removed' ? '-' : line.side === 'added' ? '+' : ' '}
                  </div>
                  <div style={{ 
                    width: 50, 
                    color: '#8c8c8c', 
                    textAlign: 'right', 
                    marginRight: 16,
                    userSelect: 'none',
                    fontFamily: 'Monaco, Menlo, Consolas, monospace',
                    fontSize: 12
                  }}>
                    {line.lineNum || ''}
                  </div>
                  <div style={{ flex: 1, whiteSpace: 'pre', fontFamily: 'Monaco, Menlo, Consolas, monospace', lineHeight: '1.5' }}>
                    {line.content}
                  </div>
                </div>
              ))
            })()}
          </div>
        ))}
      </div>
    )
  }

  const renderHunkDiff = (fileChange: FileChange) => {
    if (!fileChange.diff) {
      return <Empty description="No diff available" />
    }

    const hunks = parseDiff(fileChange.diff)

    return (
      <div style={{ fontFamily: 'monospace', fontSize: 13, overflow: 'auto', border: '1px solid #e8e8e8', borderRadius: 4 }}>
        <div style={{ 
          padding: '10px 16px', 
          background: '#fafafa', 
          fontWeight: 600, 
          fontSize: 13,
          borderBottom: '2px solid #d9d9d9',
          position: 'sticky',
          top: 0,
          zIndex: 1,
          color: '#595959'
        }}>
          Changes Only (Hunks)
        </div>
        {hunks.map((hunk, idx) => (
          <div key={idx} style={{ marginBottom: 16, borderBottom: '1px solid #e8e8e8', paddingBottom: 16 }}>
            {/* Show removed lines */}
            {hunk.before.filter((l: any) => l.type === 'removed').map((line: any, lineIdx: number) => (
              <div
                key={`before-${lineIdx}`}
                style={{
                  display: 'flex',
                  background: '#ffeef0',
                  padding: '3px 12px',
                  borderLeft: '3px solid #ff4d4f',
                  minHeight: '22px'
                }}
              >
                <div style={{ 
                  width: 30, 
                  color: '#ff4d4f', 
                  textAlign: 'center', 
                  marginRight: 8,
                  userSelect: 'none',
                  fontWeight: 600
                }}>
                  -
                </div>
                <div style={{ 
                  width: 50, 
                  color: '#8c8c8c', 
                  textAlign: 'right', 
                  marginRight: 16,
                  userSelect: 'none',
                  fontFamily: 'Monaco, Menlo, Consolas, monospace',
                  fontSize: 12
                }}>
                  {line.lineNum}
                </div>
                <div style={{ flex: 1, whiteSpace: 'pre', fontFamily: 'Monaco, Menlo, Consolas, monospace', lineHeight: '1.5' }}>
                  {line.content}
                </div>
              </div>
            ))}
            
            {/* Show added lines */}
            {hunk.after.filter((l: any) => l.type === 'added').map((line: any, lineIdx: number) => (
              <div
                key={`after-${lineIdx}`}
                style={{
                  display: 'flex',
                  background: '#f6ffed',
                  padding: '3px 12px',
                  borderLeft: '3px solid #52c41a',
                  minHeight: '22px'
                }}
              >
                <div style={{ 
                  width: 30, 
                  color: '#52c41a', 
                  textAlign: 'center', 
                  marginRight: 8,
                  userSelect: 'none',
                  fontWeight: 600
                }}>
                  +
                </div>
                <div style={{ 
                  width: 50, 
                  color: '#8c8c8c', 
                  textAlign: 'right', 
                  marginRight: 16,
                  userSelect: 'none',
                  fontFamily: 'Monaco, Menlo, Consolas, monospace',
                  fontSize: 12
                }}>
                  {line.lineNum}
                </div>
                <div style={{ flex: 1, whiteSpace: 'pre', fontFamily: 'Monaco, Menlo, Consolas, monospace', lineHeight: '1.5' }}>
                  {line.content}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  const renderSideBySideDiff = (fileChange: FileChange) => {
    if (!fileChange.diff) {
      return <Empty description="No diff available" />
    }

    const hunks = parseDiff(fileChange.diff)

    return (
      <div style={{ display: 'flex', fontFamily: 'monospace', fontSize: 13, overflow: 'auto', border: '1px solid #e8e8e8', borderRadius: 4 }}>
        {/* Before (Left side) */}
        <div style={{ flex: 1, borderRight: '2px solid #d9d9d9' }}>
          <div style={{ 
            padding: '10px 16px', 
            background: '#fafafa', 
            fontWeight: 600, 
            fontSize: 13,
            borderBottom: '2px solid #d9d9d9',
            position: 'sticky',
            top: 0,
            zIndex: 1,
            color: '#595959'
          }}>
            Before
          </div>
          {hunks.map((hunk, idx) => (
            <div key={idx}>
              {hunk.before.map((line: any, lineIdx: number) => (
                <div
                  key={lineIdx}
                  style={{
                    display: 'flex',
                    background: line.type === 'removed' ? '#ffeef0' : 
                               line.type === 'empty' ? '#f5f5f5' : 'transparent',
                    padding: '3px 12px',
                    borderLeft: line.type === 'removed' ? '3px solid #ff4d4f' : '3px solid transparent',
                    minHeight: '22px'
                  }}
                >
                  <div style={{ 
                    width: 50, 
                    color: '#8c8c8c', 
                    textAlign: 'right', 
                    marginRight: 16,
                    userSelect: 'none',
                    fontFamily: 'Monaco, Menlo, Consolas, monospace',
                    fontSize: 12
                  }}>
                    {line.lineNum || ''}
                  </div>
                  <div style={{ flex: 1, whiteSpace: 'pre', fontFamily: 'Monaco, Menlo, Consolas, monospace', lineHeight: '1.5' }}>
                    {line.content}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* After (Right side) */}
        <div style={{ flex: 1 }}>
          <div style={{ 
            padding: '10px 16px', 
            background: '#fafafa', 
            fontWeight: 600, 
            fontSize: 13,
            borderBottom: '2px solid #d9d9d9',
            position: 'sticky',
            top: 0,
            zIndex: 1,
            color: '#595959'
          }}>
            After
          </div>
          {hunks.map((hunk, idx) => (
            <div key={idx}>
              {hunk.after.map((line: any, lineIdx: number) => (
                <div
                  key={lineIdx}
                  style={{
                    display: 'flex',
                    background: line.type === 'added' ? '#f6ffed' : 
                               line.type === 'empty' ? '#f5f5f5' : 'transparent',
                    padding: '3px 12px',
                    borderLeft: line.type === 'added' ? '3px solid #52c41a' : '3px solid transparent',
                    minHeight: '22px'
                  }}
                >
                  <div style={{ 
                    width: 50, 
                    color: '#8c8c8c', 
                    textAlign: 'right', 
                    marginRight: 16,
                    userSelect: 'none',
                    fontFamily: 'Monaco, Menlo, Consolas, monospace',
                    fontSize: 12
                  }}>
                    {line.lineNum || ''}
                  </div>
                  <div style={{ flex: 1, whiteSpace: 'pre', fontFamily: 'Monaco, Menlo, Consolas, monospace', lineHeight: '1.5' }}>
                    {line.content}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Filter projects with worktrees
  const projectsWithWorktrees = projects.filter(p => p.worktreePath)

  if (projectsWithWorktrees.length === 0) {
    return null
  }

  const renderTabContent = (project: any) => {
    const isLoading = loading[project.name]
    const projectDiff = projectDiffs[project.name]

    if (isLoading) {
      return (
        <Spin spinning tip="Loading changes...">
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Empty description="Loading..." />
          </div>
        </Spin>
      )
    }

    if (!projectDiff) {
      return <Empty description="No changes found" />
    }

    return (
      <div>
        {/* Toolbar */}
        <div style={{ 
          padding: '12px 16px', 
          background: '#fafafa', 
          border: '1px solid #e8e8e8',
          borderBottom: 'none',
          borderRadius: '6px 6px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Space size={16}>
            <Space size={8}>
              <Text type="secondary" style={{ fontSize: 13 }}>View:</Text>
              <Segmented
                value={viewMode}
                onChange={(value) => {
                  setViewMode(value as 'split' | 'inline' | 'hunk')
                  localStorage.setItem('diffViewMode', value as string)
                }}
                options={[
                  {
                    label: (
                      <Tooltip title="Split view - side by side">
                        <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <SplitSquareHorizontal size={14} />
                          <span>Split</span>
                        </div>
                      </Tooltip>
                    ),
                    value: 'split'
                  },
                  {
                    label: (
                      <Tooltip title="Inline view - unified diff">
                        <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <AlignLeft size={14} />
                          <span>Inline</span>
                        </div>
                      </Tooltip>
                    ),
                    value: 'inline'
                  },
                  {
                    label: (
                      <Tooltip title="Hunk view - changes only">
                        <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <GitCompare size={14} />
                          <span>Hunk</span>
                        </div>
                      </Tooltip>
                    ),
                    value: 'hunk'
                  }
                ]}
              />
            </Space>
          </Space>
        </div>

        <div style={{ display: 'flex', height: 600, border: '1px solid #e8e8e8', borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
                  {/* File list on the left */}
                  <div style={{ 
                    width: 320, 
                    borderRight: '2px solid #e8e8e8', 
                    overflow: 'auto',
                    padding: 16,
                    background: '#fafafa'
                  }}>
                    <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>
                      Changed Files ({projectDiff.files.length})
                    </Text>
                    <List
                      size="small"
                      dataSource={projectDiff.files}
                      renderItem={(file) => {
                        const fileName = file.path.split('/').pop() || file.path
                        const filePath = file.path.split('/').slice(0, -1).join('/')
                        
                        return (
                          <List.Item
                            style={{
                              cursor: 'pointer',
                              padding: '10px 12px',
                              background: selectedFile === file.path ? '#e6f7ff' : 'transparent',
                              borderRadius: 6,
                              marginBottom: 6,
                              border: selectedFile === file.path ? '1px solid #91d5ff' : '1px solid transparent',
                              transition: 'all 0.2s'
                            }}
                            onClick={() => setSelectedFile(file.path)}
                            onMouseEnter={(e) => {
                              if (selectedFile !== file.path) {
                                e.currentTarget.style.background = '#f5f5f5'
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedFile !== file.path) {
                                e.currentTarget.style.background = 'transparent'
                              }
                            }}
                          >
                            <Space style={{ width: '100%' }} direction="vertical" size={4}>
                              <Space>
                                {getFileIcon(file.status)}
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                  <Text 
                                    strong
                                    ellipsis 
                                    style={{ fontSize: 13, display: 'block' }}
                                    title={file.path}
                                  >
                                    {fileName}
                                  </Text>
                                  {filePath && (
                                    <Text 
                                      type="secondary" 
                                      ellipsis 
                                      style={{ fontSize: 11, display: 'block' }}
                                      title={filePath}
                                    >
                                      {filePath}
                                    </Text>
                                  )}
                                </div>
                              </Space>
                              <Space size={6}>
                                {getStatusTag(file.status)}
                                {file.source === 'working' && (
                                  <Tag color="orange" style={{ fontSize: 10, padding: '1px 6px', margin: 0 }}>
                                    Unstaged
                                  </Tag>
                                )}
                              </Space>
                            </Space>
                          </List.Item>
                        )
                      }}
                    />
                  </div>

                  {/* Diff view */}
                  <div style={{ flex: 1, overflow: 'auto', padding: 16, background: '#fff' }}>
                    {selectedFile ? (
                      (() => {
                        const fileChange = projectDiff.files.find(f => f.path === selectedFile)
                        if (!fileChange) {
                          return <Empty description="Select a file to view changes" />
                        }
                        const fileName = selectedFile.split('/').pop() || selectedFile
                        const filePath = selectedFile.split('/').slice(0, -1).join('/')
                        
                        return (
                          <>
                            <div style={{ 
                              marginBottom: 16, 
                              padding: '12px 16px',
                              background: '#fafafa',
                              borderRadius: 4,
                              border: '1px solid #e8e8e8'
                            }}>
                              <Space direction="vertical" size={2}>
                                <Text strong style={{ fontSize: 14 }}>{fileName}</Text>
                                {filePath && (
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    {filePath}
                                  </Text>
                                )}
                              </Space>
                            </div>
                            {viewMode === 'split' ? renderSideBySideDiff(fileChange) :
                             viewMode === 'inline' ? renderInlineDiff(fileChange) :
                             renderHunkDiff(fileChange)}
                          </>
                        )
                      })()
                    ) : (
                      <Empty 
                        description={
                          <Space direction="vertical" size={4}>
                            <Text type="secondary">Select a file from the list</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Click on any file to view its changes
                            </Text>
                          </Space>
                        }
                        style={{ marginTop: 100 }}
                      />
                    )}
                  </div>
                </div>
      </div>
    )
  }

  const tabItems: TabsProps['items'] = projectsWithWorktrees.map(project => {
    const projectDiff = projectDiffs[project.name]
    const isLoading = loading[project.name]
    
    return {
      key: project.name,
      label: (
        <Space size={8}>
          <span style={{ fontWeight: 500 }}>{project.name}</span>
          {isLoading ? (
            <Spin size="small" />
          ) : projectDiff && projectDiff.files.length > 0 ? (
            <Badge 
              count={projectDiff.files.length} 
              showZero={false}
              style={{ backgroundColor: '#1890ff' }}
            />
          ) : null}
        </Space>
      ),
      children: renderTabContent(project)
    }
  })

  return (
    <Card
      title="Changes"
      style={{ marginBottom: 16 }}
    >
      <Tabs 
        activeKey={activeProject} 
        onChange={setActiveProject}
        type="card"
        items={tabItems}
      />
    </Card>
  )
}

// Memoize component to prevent re-renders when parent updates
// Only re-render if featureName or projects array actually changes
export default React.memo(ChangesViewer, (prevProps, nextProps) => {
  // Return true if props are equal (don't re-render), false if different (re-render)
  if (prevProps.featureName !== nextProps.featureName) {
    return false // Feature changed, need to re-render
  }
  
  // Check if projects array has same length
  if (prevProps.projects.length !== nextProps.projects.length) {
    return false // Number of projects changed, need to re-render
  }
  
  // Deep compare projects array - check if contents are the same
  const projectsEqual = prevProps.projects.every((prevProj, index) => {
    const nextProj = nextProps.projects[index]
    return prevProj.name === nextProj.name && 
           prevProj.worktreePath === nextProj.worktreePath
  })
  
  return projectsEqual // true = don't re-render, false = re-render
})
