import { useState, useRef, useEffect } from 'react'
import { Card, Input, Space, Button, Typography, List, Tag, Collapse, message, Spin } from 'antd'
import { Terminal, Send, Bot, Trash2, Maximize2, Minimize2, Loader } from 'lucide-react'
import type { Feature } from '../types'
import { createAIService, type AIService, type AIContext } from '../services/ai-service'

const { Text } = Typography
const { Panel } = Collapse

interface AITerminalProps {
  feature: Feature
  workspaceRoot: string
}

interface TerminalMessage {
  id: string
  type: 'command' | 'output' | 'error' | 'ai' | 'system'
  content: string
  timestamp: Date
  project?: string
}

export function AITerminal({ feature, workspaceRoot }: AITerminalProps) {
  const [messages, setMessages] = useState<TerminalMessage[]>([
    {
      id: '1',
      type: 'system',
      content: `🤖 AI Terminal ready for ${feature.name}\n💡 Type @ai help to see AI commands, or run regular git/shell commands`,
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isExpanded, setIsExpanded] = useState(true)
  const [isExecuting, setIsExecuting] = useState(false)
  const [aiService, setAiService] = useState<AIService | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Initialize AI service
    const initAI = async () => {
      const service = await createAIService()
      setAiService(service)
      
      if (service) {
        addMessage({
          type: 'system',
          content: '✨ AI Assistant ready! Use @ai commands for help.'
        })
      }
    }
    
    initAI()
  }, [])

  const addMessage = (msg: Omit<TerminalMessage, 'id' | 'timestamp'>) => {
    setMessages(prev => [
      ...prev,
      {
        ...msg,
        id: Date.now().toString(),
        timestamp: new Date()
      }
    ])
  }

  const executeCommand = async (command: string, project?: string) => {
    try {
      setIsExecuting(true)
      
      // Get project path
      const config = await window.nexworkAPI.config.load()
      const projectPath = project 
        ? `${workspaceRoot}/${config.projects.find((p: any) => p.name === project)?.path}`
        : workspaceRoot

      addMessage({ 
        type: 'command', 
        content: `$ ${command}${project ? ` (in ${project})` : ''}` 
      })

      const result = await window.nexworkAPI.runCommand(command, projectPath)

      if (result.success) {
        addMessage({ 
          type: 'output', 
          content: result.output || 'Command completed successfully',
          project 
        })
      } else {
        addMessage({ 
          type: 'error', 
          content: result.error || 'Command failed',
          project 
        })
      }
    } catch (error: any) {
      addMessage({ 
        type: 'error', 
        content: `Error: ${error.message}` 
      })
    } finally {
      setIsExecuting(false)
    }
  }

  const handleAICommand = async (query: string) => {
    if (!aiService) {
      addMessage({ 
        type: 'error', 
        content: '❌ AI is not enabled. Configure AI in Settings to use @ai commands.' 
      })
      return
    }

    addMessage({ 
      type: 'command', 
      content: `@ai ${query}` 
    })

    // Add loading indicator
    const loadingId = Date.now().toString()
    setMessages(prev => [
      ...prev,
      {
        id: loadingId,
        type: 'system',
        content: '🤔 AI is thinking...',
        timestamp: new Date()
      }
    ])

    try {
      setIsExecuting(true)
      
      // Build AI context
      const context: AIContext = {
        feature,
        workspaceRoot
      }

      // Gather git diff if needed for review/commit commands
      if (query.startsWith('review') || query.startsWith('commit')) {
        try {
          const diffResult = await window.nexworkAPI.runCommand('git diff', workspaceRoot)
          if (diffResult.success && diffResult.output) {
            context.gitDiff = diffResult.output
          }
        } catch (err) {
          console.error('Failed to get git diff:', err)
        }
      }

      // Gather recent commits if needed
      if (query.startsWith('pr') || query.startsWith('suggest')) {
        try {
          const logResult = await window.nexworkAPI.runCommand('git log -10 --oneline', workspaceRoot)
          if (logResult.success && logResult.output) {
            context.recentCommits = logResult.output.split('\n').filter(Boolean)
          }
        } catch (err) {
          console.error('Failed to get commits:', err)
        }
      }

      let response: string

      // Route to specific AI command handlers
      if (query.startsWith('review')) {
        if (!context.gitDiff || context.gitDiff.trim() === '') {
          addMessage({
            type: 'system',
            content: '⚠️ No uncommitted changes to review. Make some changes first!'
          })
          return
        }
        response = await aiService.reviewCode(context)
      } else if (query.startsWith('commit')) {
        if (!context.gitDiff || context.gitDiff.trim() === '') {
          addMessage({
            type: 'system',
            content: '⚠️ No uncommitted changes. Make some changes first!'
          })
          return
        }
        response = await aiService.generateCommitMessage(context)
      } else if (query.startsWith('explain')) {
        const errorText = query.substring('explain'.length).trim()
        if (!errorText) {
          addMessage({
            type: 'system',
            content: '⚠️ Please provide an error message to explain. Usage: @ai explain [error message]'
          })
          return
        }
        response = await aiService.explainError(errorText, context)
      } else if (query.startsWith('pr')) {
        response = await aiService.generatePRDescription(context)
      } else if (query.startsWith('suggest')) {
        response = await aiService.suggestNextSteps(context)
      } else if (query.startsWith('debug')) {
        const issue = query.substring('debug'.length).trim()
        if (!issue) {
          addMessage({
            type: 'system',
            content: '⚠️ Please describe the issue. Usage: @ai debug [issue description]'
          })
          return
        }
        response = await aiService.debugHelp(issue, context)
      } else if (query.startsWith('help')) {
        response = `Available AI commands:

• @ai review - Review your uncommitted changes
• @ai commit - Generate a commit message
• @ai explain [error] - Explain an error message
• @ai pr - Generate a PR description
• @ai suggest - Get suggestions for next steps
• @ai debug [issue] - Get help debugging an issue
• @ai [question] - Ask any development question

All commands understand your feature context automatically!`
      } else {
        // General chat
        response = await aiService.chat(query, context)
      }

      // Remove loading indicator
      setMessages(prev => prev.filter(msg => msg.id !== loadingId))
      
      addMessage({ 
        type: 'ai', 
        content: response
      })
    } catch (error: any) {
      // Remove loading indicator
      setMessages(prev => prev.filter(msg => msg.id !== loadingId))
      
      addMessage({ 
        type: 'error', 
        content: `❌ AI Error: ${error.message}` 
      })
      message.error(`AI request failed: ${error.message}`)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleSubmit = async () => {
    if (!input.trim() || isExecuting) return

    const cmd = input.trim()
    setInput('')

    // AI command
    if (cmd.startsWith('@ai ')) {
      await handleAICommand(cmd.substring(4))
      return
    }

    // Multi-project command
    if (cmd.startsWith('@all ')) {
      const actualCmd = cmd.substring(5)
      addMessage({ type: 'system', content: `Running on all projects: ${actualCmd}` })
      
      for (const project of feature.projects) {
        await executeCommand(actualCmd, project.name)
      }
      return
    }

    // Project-specific command
    const projectMatch = cmd.match(/^@(\w+)\s+(.+)/)
    if (projectMatch) {
      const [, projectName, actualCmd] = projectMatch
      await executeCommand(actualCmd, projectName)
      return
    }

    // Regular command in workspace root
    await executeCommand(cmd)
  }

  const handleClear = () => {
    setMessages([])
  }

  const getMessageStyle = (type: TerminalMessage['type']) => {
    switch (type) {
      case 'command':
        return { color: '#1890ff', fontWeight: 500 }
      case 'output':
        return { color: '#52c41a' }
      case 'error':
        return { color: '#ff4d4f' }
      case 'ai':
        return { color: '#722ed1', fontWeight: 500 }
      case 'system':
        return { color: '#faad14' }
      default:
        return {}
    }
  }

  return (
    <Card
      title={
        <Space>
          <Terminal size={18} />
          <span>AI Terminal</span>
          {aiService ? (
            <Tag color="green">✨ AI Enabled</Tag>
          ) : (
            <Tag color="default">AI Disabled</Tag>
          )}
        </Space>
      }
      extra={
        <Space>
          <Button size="small" icon={<Trash2 size={14} />} onClick={handleClear}>
            Clear
          </Button>
          <Button 
            size="small" 
            icon={isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Minimize' : 'Maximize'}
          </Button>
        </Space>
      }
      style={{ marginTop: 16 }}
    >
      {isExpanded && (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* Help Text */}
          <Text type="secondary" style={{ fontSize: 12 }}>
            💡 Commands: <Text code>git status</Text> | <Text code>@ai help</Text> | <Text code>@ai review</Text> | <Text code>@all git pull</Text> | <Text code>@coloris npm test</Text>
          </Text>
          {aiService && (
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: -8 }}>
              ✨ AI is enabled! Type <Text code>@ai</Text> followed by your command
            </Text>
          )}

          {/* Messages */}
          <div
            style={{
              height: 300,
              overflow: 'auto',
              backgroundColor: '#1e1e1e',
              padding: 12,
              borderRadius: 4,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              fontSize: 12
            }}
          >
            {messages.map((msg) => (
              <div key={msg.id} style={{ marginBottom: 8, ...getMessageStyle(msg.type) }}>
                {msg.content.includes('AI is thinking') ? (
                  <Space>
                    <Spin size="small" />
                    <Text style={{ color: 'inherit', fontFamily: 'inherit' }}>
                      {msg.content}
                    </Text>
                  </Space>
                ) : (
                  <Text style={{ color: 'inherit', fontFamily: 'inherit', whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </Text>
                )}
                {msg.project && (
                  <Tag color="blue" style={{ marginLeft: 8, fontSize: 10 }}>
                    {msg.project}
                  </Tag>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <Space.Compact style={{ width: '100%' }}>
            <Input
              prefix={<Bot size={16} />}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={handleSubmit}
              placeholder="Type command or @ai for AI help..."
              disabled={isExecuting}
              size="large"
            />
            <Button
              type="primary"
              icon={<Send size={16} />}
              onClick={handleSubmit}
              loading={isExecuting}
              size="large"
            >
              Run
            </Button>
          </Space.Compact>
        </Space>
      )}
    </Card>
  )
}
