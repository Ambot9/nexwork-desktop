import type { Config } from '../../types'
import { useState } from 'react'
import { Card, Typography, Collapse, Checkbox, Empty, Space, Button, Input, Select, Tag } from 'antd'

const { Title, Text } = Typography
const { Panel } = Collapse

interface WorkspaceProjectsSettingsProps {
  config: Config | null
  onManagedProjectsChange: (managedProjects: string[]) => void
  onProjectDependenciesChange: (projectDependencies: Record<string, string[]>) => void
  projectBranches?: Record<string, string>
}

interface ProjectGroup {
  groupName: string
  projects: { name: string; path: string }[]
}

function groupProjects(config: Config | null): ProjectGroup[] {
  if (!config || !config.workspaceRoot || !config.projects || config.projects.length === 0) {
    return []
  }

  const root = config.workspaceRoot.replace(/\\/g, '/')

  const groups: Record<string, { name: string; path: string }[]> = {}

  for (const project of config.projects) {
    const fullPath = project.path.replace(/\\/g, '/')

    // Derive relative path under workspace root when possible
    let relative = fullPath
    if (fullPath.startsWith(root)) {
      relative = fullPath.slice(root.length)
      if (relative.startsWith('/')) relative = relative.slice(1)
    }

    const parts = relative.split('/').filter(Boolean)

    const groupName = parts.length > 1 ? parts[0] : 'Ungrouped'

    if (!groups[groupName]) {
      groups[groupName] = []
    }

    groups[groupName].push({ name: project.name, path: project.path })
  }

  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([groupName, projects]) => ({
      groupName,
      projects: projects.sort((a, b) => a.name.localeCompare(b.name)),
    }))
}

export function WorkspaceProjectsSettings({
  config,
  onManagedProjectsChange,
  onProjectDependenciesChange,
  projectBranches,
}: WorkspaceProjectsSettingsProps) {
  const groups = groupProjects(config)

  const allProjectNames = config?.projects?.map((p) => p.name) || []
  const managedFromConfig = config?.userConfig?.managedProjects
  const managedSet = new Set<string>(managedFromConfig === undefined ? allProjectNames : managedFromConfig)
  const projectDependencies = config?.userConfig?.projectDependencies || {}

  const [searchTerm, setSearchTerm] = useState('')
  const normalizedSearch = searchTerm.trim().toLowerCase()

  const visibleGroups = groups
    .map((group) => {
      if (!normalizedSearch) return group
      const filteredProjects = group.projects.filter((p) => {
        const name = p.name.toLowerCase()
        const path = p.path.toLowerCase()
        return name.includes(normalizedSearch) || path.includes(normalizedSearch)
      })
      return { ...group, projects: filteredProjects }
    })
    .filter((group) => group.projects.length > 0)

  return (
    <Card>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <Title level={4} style={{ marginBottom: 4 }}>
            Projects in this workspace
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Nexwork scans inside your workspace folder to find Git projects. Mark projects as Managed to control which
            ones appear in Create Feature. You can also define required project dependencies so selecting one project
            auto-includes the others it needs.
          </Text>
        </div>

        {!config?.workspaceRoot && <Empty description="Select a workspace folder to see projects" />}

        {config?.workspaceRoot && groups.length === 0 && (
          <Empty description="No projects discovered yet in this workspace" />
        )}

        {config?.workspaceRoot && groups.length > 0 && (
          <>
            <Input.Search
              placeholder="Filter by project name or path"
              allowClear
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ maxWidth: 320 }}
            />

            {visibleGroups.length === 0 && normalizedSearch && <Empty description="No projects match your search" />}

            {visibleGroups.length > 0 && (
              <>
                <Space size="small">
                  <Button
                    size="small"
                    onClick={() => {
                      onManagedProjectsChange(allProjectNames)
                    }}
                  >
                    Mark all as managed
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      onManagedProjectsChange([])
                    }}
                  >
                    Mark none as managed
                  </Button>
                </Space>

                <Collapse bordered>
                  {visibleGroups.map((group) => {
                    const groupNames = group.projects.map((p) => p.name)
                    const managedCount = groupNames.filter((name) => managedSet.has(name)).length
                    const allManaged = managedCount === groupNames.length && groupNames.length > 0
                    const indeterminate = managedCount > 0 && managedCount < groupNames.length

                    const label =
                      group.groupName === 'Ungrouped' ? 'Ungrouped (directly in workspace)' : group.groupName

                    return (
                      <Panel
                        header={
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              width: '100%',
                            }}
                          >
                            <span>{label}</span>
                            <Checkbox
                              indeterminate={indeterminate}
                              checked={allManaged}
                              onChange={(e) => {
                                const next = new Set(managedSet)
                                if (e.target.checked) {
                                  groupNames.forEach((name) => next.add(name))
                                } else {
                                  groupNames.forEach((name) => next.delete(name))
                                }
                                onManagedProjectsChange(Array.from(next))
                              }}
                            >
                              Managed
                            </Checkbox>
                          </div>
                        }
                        key={group.groupName}
                      >
                        <Space direction="vertical" style={{ width: '100%' }} size="small">
                          {group.projects.map((project) => (
                            <div
                              key={project.name}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '4px 0',
                              }}
                            >
                              <div>
                                <Text strong>{project.name}</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {project.path}
                                </Text>
                                {projectBranches && projectBranches[project.name] && (
                                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                                    Branch: {projectBranches[project.name]}
                                  </Text>
                                )}
                                <div style={{ marginTop: 8 }}>
                                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                                    Required dependencies
                                  </Text>
                                  <Select
                                    mode="multiple"
                                    allowClear
                                    size="small"
                                    placeholder="Add required projects"
                                    style={{ minWidth: 260, maxWidth: 420 }}
                                    value={projectDependencies[project.name] || []}
                                    onChange={(value) => {
                                      const nextDependencies: Record<string, string[]> = {
                                        ...projectDependencies,
                                      }

                                      const cleaned = Array.from(new Set(value.filter((name) => name !== project.name)))

                                      if (cleaned.length > 0) {
                                        nextDependencies[project.name] = cleaned
                                      } else {
                                        delete nextDependencies[project.name]
                                      }

                                      onProjectDependenciesChange(nextDependencies)
                                    }}
                                    options={allProjectNames
                                      .filter((name) => name !== project.name)
                                      .map((name) => ({ value: name, label: name }))}
                                  />
                                  {(projectDependencies[project.name] || []).length > 0 && (
                                    <Space size={[6, 6]} wrap style={{ marginTop: 6 }}>
                                      {(projectDependencies[project.name] || []).map((dependencyName) => (
                                        <Tag key={`${project.name}-${dependencyName}`} color="blue">
                                          {dependencyName}
                                        </Tag>
                                      ))}
                                    </Space>
                                  )}
                                </div>
                              </div>
                              <Checkbox
                                checked={managedSet.has(project.name)}
                                onChange={(e) => {
                                  const next = new Set(managedSet)
                                  if (e.target.checked) {
                                    next.add(project.name)
                                  } else {
                                    next.delete(project.name)
                                  }
                                  onManagedProjectsChange(Array.from(next))
                                }}
                              >
                                Managed
                              </Checkbox>
                            </div>
                          ))}
                        </Space>
                      </Panel>
                    )
                  })}
                </Collapse>
              </>
            )}
          </>
        )}
      </Space>
    </Card>
  )
}
