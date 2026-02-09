import { useState, useEffect } from 'react'
import { Modal, Steps, Form, Input, Checkbox, Button, Space, Typography, Card, message, Tag, Alert, Tooltip, Select, Spin, DatePicker } from 'antd'
import { FileText, FolderGit2, Settings, GitBranch, AlertTriangle, CheckCircle, ArrowDown, RefreshCw } from 'lucide-react'
import type { CreateFeatureDTO } from '../types'

const { Text, Paragraph } = Typography
const { Step } = Steps
const { TextArea } = Input

interface CreateFeatureModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

interface TemplatePreview {
  name: string
  description: string
  icon: string
}

const TEMPLATE_PREVIEWS: Record<string, TemplatePreview> = {
  default: {
    name: 'Default',
    description: 'Simple, clean feature documentation with tasks and testing checklist',
    icon: '📝'
  },
  jira: {
    name: 'JIRA Style',
    description: 'JIRA-style template with user stories, acceptance criteria, and definition of done',
    icon: '🎯'
  }
}

export function CreateFeatureModal({ open, onClose, onSuccess }: CreateFeatureModalProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [availableProjects, setAvailableProjects] = useState<string[]>([])
  const [availableTemplates, setAvailableTemplates] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('default')
  const [useCustomId, setUseCustomId] = useState(false)
  const [currentBranches, setCurrentBranches] = useState<Record<string, string>>({})
  const [availableBranches, setAvailableBranches] = useState<Record<string, string[]>>({})
  const [selectedBranches, setSelectedBranches] = useState<Record<string, string>>({})
  const [projectStatus, setProjectStatus] = useState<Record<string, { ahead: number, behind: number, upToDate: boolean, noRemote?: boolean }>>({})
  const [projectStatusLoading, setProjectStatusLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  const loadData = async () => {
    try {
      // Load configuration
      const config = await window.nexworkAPI.config.load()
      const projects = config.projects?.map((p: any) => p.name) || []
      setAvailableProjects(projects)

      // Load templates
      const templates = await window.nexworkAPI.templates.getAll()
      setAvailableTemplates(templates)
      
      // PHASE 1: Load current branches ONLY (fast, no network calls)
      // MUST complete before phase 3 because status check needs branch info
      const branches = await loadProjectBranches(config)
      
      // PHASE 2: Load available branches (background, can run in parallel with phase 3)
      loadAvailableBranches(config)
      
      // PHASE 3: Load sync status (background, parallel)
      // Pass branches directly to avoid timing issues with React state
      loadSyncStatusInBackground(config, branches)
    } catch (error) {
      console.error('Failed to load data:', error)
      message.error('Failed to load configuration')
    }
  }

  const loadProjectBranches = async (config: any) => {
    const branches: Record<string, string> = {}
    
    // Get current branch for each project (fast, local operation)
    const branchPromises = (config.projects || []).map(async (project: any) => {
      try {
        const projectPath = `${config.workspaceRoot}/${project.path}`
        const branchResult = await window.nexworkAPI.runCommand('git rev-parse --abbrev-ref HEAD', projectPath)
        const currentBranch = branchResult.success ? branchResult.output.trim() : 'unknown'
        branches[project.name] = currentBranch
      } catch (error) {
        branches[project.name] = 'unknown'
      }
    })
    
    await Promise.all(branchPromises)
    setCurrentBranches(branches)
    setSelectedBranches(branches) // Initialize selected branches with current
    
    // Return the branches so they can be used immediately
    return branches
  }

  const loadAvailableBranches = async (config: any) => {
    const allBranches: Record<string, string[]> = {}
    
    const branchPromises = (config.projects || []).map(async (project: any) => {
      try {
        const projectPath = `${config.workspaceRoot}/${project.path}`
        
        // Get all branches (local + remote)
        const result = await window.nexworkAPI.runCommand(
          'git branch -a | sed "s/remotes\\/origin\\///" | sed "s/^[* ]*//" | grep -v "HEAD" | sort -u',
          projectPath
        )
        
        if (result.success) {
          const branches = result.output.trim().split('\n').filter(b => b.trim())
          
          // Filter to important branches: production, staging, demo, master, main, develop + recent feature branches
          const mainBranches = branches.filter(b => 
            ['production', 'staging', 'demo', 'master', 'main', 'develop'].includes(b.trim().toLowerCase())
          )
          
          const featureBranches = branches.filter(b => 
            b.toLowerCase().includes('feature') || b.toLowerCase().includes('feat')
          ).slice(0, 5) // Only recent 5
          
          allBranches[project.name] = [...new Set([...mainBranches, ...featureBranches])]
        } else {
          allBranches[project.name] = []
        }
      } catch (error) {
        allBranches[project.name] = []
      }
    })
    
    await Promise.all(branchPromises)
    setAvailableBranches(allBranches)
  }

  const loadSyncStatusInBackground = async (config: any, branches?: Record<string, string>) => {
    // Check status for all projects in parallel
    const statusPromises = (config.projects || []).map(async (project: any) => {
      await checkProjectStatus(project.name, config, branches)
    })
    
    await Promise.all(statusPromises)
  }

  const checkProjectStatus = async (projectName: string, config?: any, branches?: Record<string, string>) => {
    // Set timeout to clear loading state after 30 seconds max
    const timeoutId = setTimeout(() => {
      console.warn(`Status check timeout for ${projectName}`)
      setProjectStatusLoading(prev => ({ ...prev, [projectName]: false }))
    }, 30000)
    
    try {
      // Set loading state
      setProjectStatusLoading(prev => ({ ...prev, [projectName]: true }))
      
      if (!config) {
        config = await window.nexworkAPI.config.load()
      }
      
      const project = config.projects.find((p: any) => p.name === projectName)
      if (!project) {
        console.warn(`Project ${projectName} not found in config`)
        setProjectStatusLoading(prev => ({ ...prev, [projectName]: false }))
        return
      }
      
      const projectPath = `${config.workspaceRoot}/${project.path}`
      
      // Use passed branches if available (for initial load), otherwise use state
      const branchToCheck = branches?.[projectName] || selectedBranches[projectName] || currentBranches[projectName]
      
      
      if (!branchToCheck || branchToCheck === 'unknown') {
        console.warn(`Branch unknown for ${projectName}`)
        setProjectStatusLoading(prev => ({ ...prev, [projectName]: false }))
        return
      }
      
      // Fetch latest from remote (with timeout)
      const fetchResult = await window.nexworkAPI.runCommand('git fetch --quiet --no-progress', projectPath)
      if (!fetchResult.success) {
        console.error(`Failed to fetch for ${projectName}:`, fetchResult.error)
      }
      
      // First check if the remote branch exists
      const remoteBranchCheck = await window.nexworkAPI.runCommand(
        `git rev-parse --verify origin/${branchToCheck}`,
        projectPath
      )
      
      if (!remoteBranchCheck.success) {
        // Remote branch doesn't exist - this is a local-only branch
        setProjectStatus(prev => ({
          ...prev,
          [projectName]: {
            ahead: 0,
            behind: 0,
            upToDate: true,
            noRemote: true
          }
        }))
        setProjectStatusLoading(prev => ({ ...prev, [projectName]: false }))
        return
      }
      
      // Get the local branch hash (if it exists locally)
      const localBranchCheck = await window.nexworkAPI.runCommand(
        `git rev-parse --verify ${branchToCheck} 2>/dev/null || git rev-parse --verify origin/${branchToCheck}`,
        projectPath
      )
      
      
      if (!localBranchCheck.success || !localBranchCheck.output.trim()) {
        console.error(`Failed to get local branch for ${projectName}:`, localBranchCheck.error)
        setProjectStatusLoading(prev => ({ ...prev, [projectName]: false }))
        return
      }
      
      const localRef = localBranchCheck.output.trim()
      const remoteRef = remoteBranchCheck.output.trim()
      
      
      // If local and remote are the same, it's up to date
      if (localRef === remoteRef) {
        setProjectStatus(prev => ({
          ...prev,
          [projectName]: {
            ahead: 0,
            behind: 0,
            upToDate: true
          }
        }))
        setProjectStatusLoading(prev => ({ ...prev, [projectName]: false }))
        return
      }
      
      // Check ahead/behind count between local and remote refs of the selected branch
      const statusResult = await window.nexworkAPI.runCommand(
        `git rev-list --left-right --count ${localRef}...${remoteRef}`,
        projectPath
      )
      
      
      
      if (statusResult.success) {
        const parts = statusResult.output.trim().split(/\s+/)
        const ahead = parseInt(parts[0]) || 0
        const behind = parseInt(parts[1]) || 0
        
        
        setProjectStatus(prev => ({
          ...prev,
          [projectName]: {
            ahead,
            behind,
            upToDate: behind === 0
          }
        }))
      } else {
        console.error(`Failed to get status for ${projectName}:`, statusResult.error)
      }
    } catch (error) {
      console.error(`Failed to check status for ${projectName}:`, error)
    } finally {
      clearTimeout(timeoutId)
      setProjectStatusLoading(prev => ({ ...prev, [projectName]: false }))
    }
  }

  const handleBranchSwitch = async (projectName: string, newBranch: string) => {
    try {
      // Update selected branch
      setSelectedBranches(prev => ({ ...prev, [projectName]: newBranch }))
      
      // Re-check status for the new branch
      // Pass the new branch directly to avoid race condition with state update
      const config = await window.nexworkAPI.config.load()
      const branchesWithNewSelection = {
        ...selectedBranches,
        [projectName]: newBranch
      }
      await checkProjectStatus(projectName, config, branchesWithNewSelection)
    } catch (error) {
      console.error(`Failed to switch branch for ${projectName}:`, error)
      message.error(`Failed to check status for ${newBranch}`)
    }
  }

  const handlePullProject = async (projectName: string) => {
    try {
      message.loading({ content: `Pulling ${projectName}...`, key: `pull-${projectName}`, duration: 0 })
      
      const config = await window.nexworkAPI.config.load()
      const project = config.projects.find((p: any) => p.name === projectName)
      
      if (!project) {
        message.error({ content: `Project ${projectName} not found`, key: `pull-${projectName}` })
        return
      }
      
      const projectPath = `${config.workspaceRoot}/${project.path}`
      
      // Get the selected branch for this project
      const targetBranch = selectedBranches[projectName] || currentBranches[projectName]
      
      // Check current branch
      const branchResult = await window.nexworkAPI.runCommand('git rev-parse --abbrev-ref HEAD', projectPath)
      const currentBranch = branchResult.success ? branchResult.output.trim() : ''
      
      // If not on the target branch, switch to it first
      if (currentBranch !== targetBranch) {
        message.info({ content: `${projectName}: Switching to ${targetBranch}...`, key: `pull-${projectName}`, duration: 0 })
        const switchResult = await window.nexworkAPI.runCommand(`git checkout ${targetBranch}`, projectPath)
        
        if (!switchResult.success) {
          message.error({ content: `Failed to switch to ${targetBranch}: ${switchResult.error}`, key: `pull-${projectName}`, duration: 5 })
          return
        }
      }
      
      // Now pull
      const result = await window.nexworkAPI.runCommand('git pull --no-edit', projectPath)
      
      if (result.success) {
        message.success({ content: `${projectName} pulled successfully!`, key: `pull-${projectName}`, duration: 3 })
        // Re-check status after pull
        await checkProjectStatus(projectName, config)
      } else {
        message.error({ content: `Failed to pull ${projectName}: ${result.error}`, key: `pull-${projectName}`, duration: 5 })
      }
    } catch (error: any) {
      message.error({ content: `Failed to pull: ${error.message}`, key: `pull-${projectName}`, duration: 5 })
    }
  }

  const handleNext = async () => {
    try {
      // Validate only the fields in the current step
      if (currentStep === 0) {
        await form.validateFields(['featureName', 'customId', 'description'])
      } else if (currentStep === 1) {
        await form.validateFields(['projects'])
        
        // Check if any selected projects are behind remote
        const selectedProjects = form.getFieldValue('projects') || []
        const projectsBehind = selectedProjects.filter((project: string) => {
          const status = projectStatus[project]
          return status && !status.upToDate && !status.noRemote && status.behind > 0
        })
        
        if (projectsBehind.length > 0) {
          message.warning({
            content: `Please pull the following projects first: ${projectsBehind.join(', ')}`,
            duration: 5
          })
          return // Prevent going to next step
        }
      }
      
      // Log current form values
      const currentValues = form.getFieldsValue()
      
      setCurrentStep(currentStep + 1)
    } catch (error) {
      console.error('Validation failed:', error)
    }
  }

  const handlePrev = () => {
    setCurrentStep(currentStep - 1)
  }

  const handleSubmit = async () => {
    
    try {
      setLoading(true)
      
      // Get all form fields
      const allFields = form.getFieldsValue()
      
      // Validate fields
      let values
      try {
        values = await form.validateFields()
      } catch (validationError) {
        console.error('Validation failed:', validationError)
        throw validationError
      }
      
      
      const dto: CreateFeatureDTO = {
        name: values.featureName,
        id: useCustomId ? values.customId : undefined,
        projects: values.projects as string[],
        template: selectedTemplate,
        selectedBranches: selectedBranches,
        expiresAt: values.expiresAt ? values.expiresAt.toISOString() : undefined
      }
      

      await window.nexworkAPI.features.create(dto)
      message.success('Feature created successfully!')
      
      // Reset and close
      form.resetFields()
      setCurrentStep(0)
      setUseCustomId(false)
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Failed to create feature:', error)
      message.error(error.message || 'Failed to create feature')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    form.resetFields()
    setCurrentStep(0)
    setUseCustomId(false)
    onClose()
  }

  const handlePullAll = async () => {
    try {
      message.loading({ content: 'Pulling all projects...', key: 'pull-all', duration: 0 })
      
      const config = await window.nexworkAPI.config.load()
      let successCount = 0
      let failCount = 0
      
      for (const project of config.projects || []) {
        try {
          const projectPath = `${config.workspaceRoot}/${project.path}`
          const result = await window.nexworkAPI.runCommand('git pull --no-edit', projectPath)
          
          if (result.success) {
            successCount++
          } else {
            failCount++
            console.error(`Failed to pull ${project.name}:`, result.error)
          }
        } catch (error) {
          failCount++
        }
      }
      
      if (failCount === 0) {
        message.success({ content: `All ${successCount} projects pulled successfully!`, key: 'pull-all', duration: 3 })
      } else {
        message.warning({ content: `Pulled ${successCount} projects, ${failCount} failed`, key: 'pull-all', duration: 5 })
      }
      
      // Reload data to refresh status
      await loadData()
    } catch (error: any) {
      message.error({ content: `Failed to pull: ${error.message}`, key: 'pull-all', duration: 5 })
    }
  }

  const steps = [
    {
      title: 'Basic Info',
      icon: <FileText size={20} />,
      content: (
        <div style={{ marginTop: 24 }}>
          <Form.Item
            label="Feature Name"
            name="featureName"
            rules={[{ required: true, message: 'Please enter feature name' }]}
          >
            <Input
              size="large"
              placeholder="e.g., Add Payment Gateway Integration"
              autoFocus
            />
          </Form.Item>

          <Form.Item>
            <Checkbox
              checked={useCustomId}
              onChange={(e) => setUseCustomId(e.target.checked)}
            >
              Use custom Feature ID (otherwise auto-generated)
            </Checkbox>
          </Form.Item>

          {useCustomId && (
            <Form.Item
              label="Custom Feature ID"
              name="customId"
              rules={[
                { required: useCustomId, message: 'Please enter feature ID' },
                {
                  pattern: /^[A-Z0-9_-]+$/,
                  message: 'ID can only contain uppercase letters, numbers, hyphens, and underscores'
                }
              ]}
            >
              <Input
                size="large"
                placeholder="e.g., WPAY-123, JIRA-456"
                style={{ textTransform: 'uppercase' }}
              />
            </Form.Item>
          )}

          <Form.Item
            label="Description (optional)"
            name="description"
          >
            <TextArea
              rows={4}
              placeholder="Brief description of what this feature does..."
            />
          </Form.Item>

          <Form.Item
            label="Auto-Delete Date (optional)"
            name="expiresAt"
            tooltip="Set an expiration date for this feature. The feature will be automatically deleted after this date to keep your workspace clean."
          >
            <DatePicker
              size="large"
              style={{ width: '100%' }}
              placeholder="Select expiration date"
              format="YYYY-MM-DD"
              showToday
              disabledDate={(current) => {
                // Don't allow dates in the past
                return current && current.valueOf() < Date.now()
              }}
            />
          </Form.Item>
        </div>
      )
    },
    {
      title: 'Select Projects',
      icon: <FolderGit2 size={20} />,
      content: (
        <div style={{ marginTop: 24 }}>
          <Paragraph type="secondary">
            Select which repositories this feature will affect. Worktrees will be created from the current branch.
          </Paragraph>
          
          {Object.values(projectStatus).some(s => !s.upToDate) && (
            <Alert
              message="Some projects are behind remote"
              description={
                <Space direction="vertical" size="small">
                  <Text>
                    {Object.entries(projectStatus).filter(([_, s]) => !s.upToDate).length} project(s) 
                    need to pull changes. It's recommended to pull before creating a feature.
                  </Text>
                  <Button 
                    type="primary" 
                    size="small" 
                    icon={<ArrowDown size={14} />}
                    onClick={handlePullAll}
                  >
                    Pull All Projects
                  </Button>
                </Space>
              }
              type="warning"
              showIcon
              icon={<AlertTriangle size={16} />}
              style={{ marginBottom: 16 }}
            />
          )}
          
          <Form.Item
            name="projects"
            rules={[{ required: true, message: 'Please select at least one project' }]}
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {availableProjects.map((project) => {
                  const status = projectStatus[project]
                  const needsPull = status && !status.upToDate
                  
                  return (
                    <Card 
                      key={project} 
                      size="small"
                      style={{ 
                        borderColor: needsPull ? '#faad14' : undefined,
                        borderWidth: needsPull ? 2 : 1,
                        cursor: 'default'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <Checkbox value={project}>
                          <Space>
                            <FolderGit2 size={16} />
                            <Text strong>{project}</Text>
                          </Space>
                        </Checkbox>
                        
                        <Space onClick={(e) => e.stopPropagation()}>
                          {/* Branch Switcher */}
                          {availableBranches[project] && availableBranches[project].length > 0 ? (
                            <Select
                              value={selectedBranches[project] || currentBranches[project]}
                              onChange={(branch) => handleBranchSwitch(project, branch)}
                              showSearch
                              style={{ width: 180 }}
                              size="small"
                              suffixIcon={<GitBranch size={12} />}
                              placeholder="Select branch"
                              popupMatchSelectWidth={200}
                            >
                              {availableBranches[project].map(branch => (
                                <Select.Option key={branch} value={branch}>
                                  {branch}
                                </Select.Option>
                              ))}
                            </Select>
                          ) : currentBranches[project] ? (
                            <Tag color="blue">
                              <Space size={4}>
                                <GitBranch size={12} />
                                <span>{currentBranches[project]}</span>
                              </Space>
                            </Tag>
                          ) : null}
                          
                          {/* Status Badge */}
                          {projectStatusLoading[project] ? (
                            <Tag icon={<Spin size="small" />} color="processing">
                              Checking...
                            </Tag>
                          ) : status && status.noRemote ? (
                            <Tooltip title="Local branch only - no remote tracking branch">
                              <Tag color="default">
                                Local only
                              </Tag>
                            </Tooltip>
                          ) : status && needsPull ? (
                            <>
                              <Tooltip title={`${status.behind} commit(s) behind remote`}>
                                <Tag color="warning" icon={<AlertTriangle size={12} />}>
                                  {status.behind} behind
                                </Tag>
                              </Tooltip>
                              <Tooltip title="Pull to update">
                                <Button 
                                  type="primary" 
                                  size="small" 
                                  icon={<ArrowDown size={12} />}
                                  onClick={() => handlePullProject(project)}
                                >
                                  Pull
                                </Button>
                              </Tooltip>
                            </>
                          ) : status && status.upToDate ? (
                            <Tooltip title="Up to date with remote">
                              <Tag color="success" icon={<CheckCircle size={12} />}>
                                Up to date
                              </Tag>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Click to check status">
                              <Button 
                                type="text" 
                                size="small" 
                                icon={<RefreshCw size={12} />}
                                onClick={async () => {
                                  const config = await window.nexworkAPI.config.load()
                                  await checkProjectStatus(project, config)
                                }}
                              >
                                Check Status
                              </Button>
                            </Tooltip>
                          )}
                        </Space>
                      </div>
                    </Card>
                  )
                })}
              </Space>
            </Checkbox.Group>
          </Form.Item>
          
          {availableProjects.length === 0 && (
            <Card>
              <Text type="secondary">
                No projects found. Please configure your workspace first.
              </Text>
            </Card>
          )}
        </div>
      )
    },
    {
      title: 'Choose Template',
      icon: <Settings size={20} />,
      content: (
        <div style={{ marginTop: 24 }}>
          <Paragraph type="secondary">
            Select a README template for your feature documentation
          </Paragraph>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {availableTemplates.map((template) => {
              const preview = TEMPLATE_PREVIEWS[template] || {
                name: template,
                description: 'Custom template',
                icon: '📄'
              }
              
              return (
                <Card
                  key={template}
                  hoverable
                  style={{
                    borderColor: selectedTemplate === template ? '#1890ff' : undefined,
                    borderWidth: selectedTemplate === template ? 2 : 1
                  }}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <Space>
                    <span style={{ fontSize: 24 }}>{preview.icon}</span>
                    <div>
                      <Text strong>{preview.name}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {preview.description}
                      </Text>
                    </div>
                  </Space>
                </Card>
              )
            })}
          </Space>
        </div>
      )
    }
  ]

  return (
    <Modal
      title={
        <Space>
          <FolderGit2 size={20} />
          <span>Create New Feature</span>
        </Space>
      }
      open={open}
      onCancel={handleCancel}
      width={700}
      footer={null}
    >
      <Steps current={currentStep} style={{ marginBottom: 24 }}>
        {steps.map((step, index) => (
          <Step key={index} title={step.title} icon={step.icon} />
        ))}
      </Steps>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          template: 'default'
        }}
      >
        {steps.map((step, index) => (
          <div key={index} style={{ display: currentStep === index ? 'block' : 'none' }}>
            {step.content}
          </div>
        ))}
      </Form>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <Button
          onClick={handlePrev}
          disabled={currentStep === 0}
        >
          Previous
        </Button>
        <Space>
          <Button onClick={handleCancel}>
            Cancel
          </Button>
          {currentStep < steps.length - 1 ? (
            <Button type="primary" onClick={handleNext}>
              Next
            </Button>
          ) : (
            <Button type="primary" onClick={handleSubmit} loading={loading}>
              Create Feature
            </Button>
          )}
        </Space>
      </div>
    </Modal>
  )
}
