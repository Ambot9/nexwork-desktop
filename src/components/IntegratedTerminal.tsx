import { useState, useEffect, useRef } from 'react'
import { Card, Tabs, Button, Space, Dropdown, Typography } from 'antd'
import { Plus, ChevronDown, Terminal as TerminalIcon, X } from 'lucide-react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import type { Feature } from '../types'

const { Text } = Typography

interface IntegratedTerminalProps {
  feature: Feature
  workspaceRoot: string
}

interface TerminalTab {
  id: string
  label: string
  terminal: Terminal
  fitAddon: FitAddon
  pid?: number
}

export function IntegratedTerminal({ feature, workspaceRoot }: IntegratedTerminalProps) {
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string>('')
  const terminalRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const nextTerminalId = useRef(1)
  const hasCreatedInitialTerminal = useRef(false)

  useEffect(() => {
    // Create first terminal on mount (only once)
    if (!hasCreatedInitialTerminal.current) {
      hasCreatedInitialTerminal.current = true
      createNewTerminal()
    }

    // Cleanup on component unmount
    return () => {
      // Only cleanup if we're actually unmounting (not just React Strict Mode remount)
      setTimeout(() => {
        tabs.forEach(tab => {
          if (tab.pid) {
            window.nexworkAPI.terminal?.kill(tab.pid)
          }
          tab.terminal.dispose()
        })
      }, 100)
    }
  }, [])

  const createNewTerminal = async (customCwd?: string) => {
    const terminalId = `terminal-${nextTerminalId.current++}`
    
    // Determine working directory
    let cwd = customCwd || workspaceRoot
    
    // If no custom directory, try to detect feature folder
    if (!customCwd && feature.projects.length > 0) {
      try {
        // FIRST PRIORITY: Check if features folder exists for this feature
        // Pattern: features/{date}-{featureName}/
        // Feature name might have underscores, but folder might have hyphens
        const featureName = feature.name.replace(/_/g, '-')
        const featureFolderPattern = `${workspaceRoot}/features/*${featureName}*`
        
        const globResult = await window.nexworkAPI.runCommand(
          `ls -d ${featureFolderPattern} 2>/dev/null`,
          workspaceRoot
        )
        
        
        let featureFolderFound = false
        if (globResult.success && globResult.output && globResult.output.trim()) {
          const detectedPath = globResult.output.trim().split('\n')[0]
          // Make sure the path exists and is a directory
          if (detectedPath && detectedPath.startsWith(workspaceRoot)) {
            cwd = detectedPath
            featureFolderFound = true
          }
        }
        
        // Only check other methods if features folder wasn't found
        if (!featureFolderFound) {
          
          const config = await window.nexworkAPI.config.load()
          const firstProject = feature.projects[0]
          
          if (firstProject.worktreePath) {
          // Fallback to stored worktree path
          cwd = firstProject.worktreePath
        } else {
            // Not found in features folder, try to detect worktree dynamically
            const projectConfig = config.projects.find((p: any) => p.name === firstProject.name)
          if (projectConfig) {
            const projectPath = `${workspaceRoot}/${projectConfig.path}`
            
            // Check if worktree exists for this branch
            const worktreeListResult = await window.nexworkAPI.runCommand('git worktree list', projectPath)
            
            if (worktreeListResult.success) {
              
              // Look for worktree directory (not the main repo)
              const worktreeLines = worktreeListResult.output.split('\n').filter(Boolean)
              
              // First, prefer worktrees in the features/ folder
              let worktreeLine = worktreeLines.find(line => 
                line.includes(firstProject.branch) && 
                line.includes('/features/') &&
                !line.startsWith(projectPath)
              )
              
              // If not found in features/, look for any worktree
              if (!worktreeLine) {
                worktreeLine = worktreeLines.find(line => 
                  line.includes(firstProject.branch) && !line.startsWith(projectPath)
                )
              }
              
              if (worktreeLine) {
                // Extract worktree path (first part before whitespace)
                const detectedWorktreePath = worktreeLine.trim().split(/\s+/)[0]
                cwd = detectedWorktreePath
              } else {
                // No separate worktree, use main project directory
                cwd = projectPath
              }
            } else {
              // Fallback to project path if git command fails
              cwd = projectPath
              console.error('Failed to get worktree list:', worktreeListResult.error)
            }
          }
        }
        }
      } catch (error) {
        console.error('Failed to detect worktree:', error)
      }
    }
    
    // Create xterm instance
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#ffffff',
        foreground: '#000000',
        cursor: '#000000',
        cursorAccent: '#ffffff',
        selectionBackground: '#b3d4fc',
        selectionForeground: '#000000',
        black: '#000000',
        red: '#cd3131',
        green: '#00bc00',
        yellow: '#949800',
        blue: '#0451a5',
        magenta: '#bc05bc',
        cyan: '#0598bc',
        white: '#555555',
        brightBlack: '#666666',
        brightRed: '#cd3131',
        brightGreen: '#14ce14',
        brightYellow: '#b5ba00',
        brightBlue: '#0451a5',
        brightMagenta: '#bc05bc',
        brightCyan: '#0598bc',
        brightWhite: '#a5a5a5',
      },
      allowProposedApi: true,
      convertEol: true,
      rows: 24,
      cols: 80
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)

    const newTab: TerminalTab = {
      id: terminalId,
      label: `Terminal ${tabs.length + 1}`, // Use actual tab count instead of incrementing counter
      terminal,
      fitAddon
    }

    setTabs(prev => [...prev, newTab])
    setActiveTabId(terminalId)

    // Wait for next tick to ensure DOM is ready
    setTimeout(() => {
      const container = terminalRefs.current[terminalId]
      if (container) {
        terminal.open(container)
        fitAddon.fit()
        
        // Initialize PTY with determined working directory
        initializePTY(terminalId, terminal, cwd)
      }
    }, 100)
  }

  const initializePTY = async (terminalId: string, terminal: Terminal, cwd: string) => {
    try {
      
      if (!window.nexworkAPI.terminal) {
        throw new Error('Terminal API not available')
      }
      
      // Create PTY process
      const result = await window.nexworkAPI.terminal.create({
        cols: terminal.cols,
        rows: terminal.rows,
        cwd: cwd
      })

      
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to create terminal')
      }

      if (result?.pid) {
        // Update tab with PID
        setTabs(prev => prev.map(tab => 
          tab.id === terminalId ? { ...tab, pid: result.pid } : tab
        ))

        // Handle terminal output
        window.nexworkAPI.terminal?.onData(result.pid, (data: string) => {
          terminal.write(data)
        })

        // Handle terminal exit
        window.nexworkAPI.terminal?.onExit(result.pid, (code: number) => {
          terminal.write(`\r\n\r\n[Process exited with code ${code}]\r\n`)
        })

        // Handle user input
        terminal.onData((data: string) => {
          window.nexworkAPI.terminal?.write(result.pid, data)
        })

        // Handle terminal resize
        terminal.onResize(({ cols, rows }) => {
          window.nexworkAPI.terminal?.resize(result.pid, cols, rows)
        })
      }
    } catch (error: any) {
      console.error('Failed to initialize PTY:', error)
      terminal.write(`\x1b[31mFailed to start terminal: ${error.message || error}\x1b[0m\r\n`)
      terminal.write(`\r\nPlease check the console for more details.\r\n`)
    }
  }

  const closeTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    
    const tab = tabs.find(t => t.id === tabId)
    if (tab) {
      // Kill PTY process
      if (tab.pid) {
        window.nexworkAPI.terminal?.kill(tab.pid)
      }
      // Dispose terminal
      tab.terminal.dispose()
    }

    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId)
      
      // Renumber remaining terminals to fill gaps
      const renumberedTabs = newTabs.map((tab, index) => ({
        ...tab,
        label: `Terminal ${index + 1}`
      }))
      
      // If closing active tab, switch to another
      if (activeTabId === tabId && renumberedTabs.length > 0) {
        setActiveTabId(renumberedTabs[0].id)
      }
      
      // If no tabs left, create a new one
      if (renumberedTabs.length === 0) {
        setTimeout(createNewTerminal, 100)
      }
      
      return renumberedTabs
    })
  }

  const handleTabChange = (tabId: string) => {
    setActiveTabId(tabId)
    
    // Fit terminal when switching tabs
    setTimeout(() => {
      const tab = tabs.find(t => t.id === tabId)
      if (tab) {
        tab.fitAddon.fit()
        tab.terminal.focus()
      }
    }, 50)
  }

  // Fit terminals on window resize
  useEffect(() => {
    const handleResize = () => {
      tabs.forEach(tab => {
        if (tab.id === activeTabId) {
          tab.fitAddon.fit()
        }
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [tabs, activeTabId])

  const items = tabs.map(tab => ({
    key: tab.id,
    label: (
      <Space>
        <TerminalIcon size={14} />
        <span>{tab.label}</span>
      </Space>
    ),
    closable: tabs.length > 1,
    children: (
      <div
        ref={(el) => (terminalRefs.current[tab.id] = el)}
        style={{
          height: '400px',
          width: '100%',
          padding: '8px',
          backgroundColor: '#ffffff',
          overflow: 'hidden'
        }}
      />
    )
  }))

  return (
    <Card
      style={{ marginTop: 16 }}
      styles={{ body: { padding: 0 } }}
    >
      <Tabs
        activeKey={activeTabId}
        onChange={handleTabChange}
        type="editable-card"
        onEdit={(targetKey, action) => {
          if (action === 'add') {
            createNewTerminal()
          } else {
            closeTab(targetKey as string)
          }
        }}
        items={items}
        tabBarExtraContent={{
          right: (
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'new-terminal',
                    label: 'New Terminal (Default)',
                    icon: <Plus size={14} />,
                    onClick: () => createNewTerminal()
                  },
                  {
                    key: 'new-workspace',
                    label: 'New Terminal (Workspace Root)',
                    onClick: () => createNewTerminal(workspaceRoot)
                  },
                  ...feature.projects.map(project => ({
                    key: `project-${project.name}`,
                    label: `New Terminal (${project.name})`,
                    onClick: async () => {
                      const config = await window.nexworkAPI.config.load()
                      const projectConfig = config.projects.find((p: any) => p.name === project.name)
                      if (projectConfig) {
                        const projectPath = project.worktreePath || `${workspaceRoot}/${projectConfig.path}`
                        createNewTerminal(projectPath)
                      }
                    }
                  }))
                ]
              }}
              trigger={['click']}
            >
              <Button
                type="text"
                size="small"
                icon={<ChevronDown size={14} />}
                style={{ marginRight: 8 }}
              />
            </Dropdown>
          )
        }}
      />
    </Card>
  )
}
