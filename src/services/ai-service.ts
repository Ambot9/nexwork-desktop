import type { Feature } from '../types'

export interface AIContext {
  feature: Feature
  workspaceRoot: string
  gitDiff?: string
  recentCommits?: string[]
  errorMessage?: string
  files?: string[]
}

export interface AIResponse {
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

export interface AIServiceConfig {
  provider: 'claude' | 'openai' | 'ollama'
  apiKey: string
  model: string
}

export class AIService {
  private config: AIServiceConfig

  constructor(config: AIServiceConfig) {
    this.config = config
  }

  async chat(prompt: string, context: AIContext): Promise<AIResponse> {
    switch (this.config.provider) {
      case 'claude':
        return this.claudeChat(prompt, context)
      case 'openai':
        return this.openAIChat(prompt, context)
      case 'ollama':
        return this.ollamaChat(prompt, context)
      default:
        throw new Error(`Unsupported AI provider: ${this.config.provider}`)
    }
  }

  private async claudeChat(prompt: string, context: AIContext): Promise<AIResponse> {
    const systemPrompt = this.buildSystemPrompt(context)
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Claude API error: ${error.error?.message || response.statusText}`)
      }

      const data = await response.json()
      
      return {
        content: data.content[0].text,
        usage: {
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens
        }
      }
    } catch (error: any) {
      throw new Error(`Failed to call Claude API: ${error.message}`)
    }
  }

  private async openAIChat(prompt: string, context: AIContext): Promise<AIResponse> {
    const systemPrompt = this.buildSystemPrompt(context)
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 4096
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
      }

      const data = await response.json()
      
      return {
        content: data.choices[0].message.content,
        usage: {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens
        }
      }
    } catch (error: any) {
      throw new Error(`Failed to call OpenAI API: ${error.message}`)
    }
  }

  private async ollamaChat(prompt: string, context: AIContext): Promise<AIResponse> {
    const systemPrompt = this.buildSystemPrompt(context)
    
    try {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model || 'llama2',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          stream: false
        })
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`)
      }

      const data = await response.json()
      
      return {
        content: data.message.content
      }
    } catch (error: any) {
      throw new Error(`Failed to call Ollama API: ${error.message}. Make sure Ollama is running.`)
    }
  }

  private buildSystemPrompt(context: AIContext): string {
    const { feature, workspaceRoot, gitDiff, recentCommits, errorMessage, files } = context

    let prompt = `You are an AI assistant helping with software development in the Nexwork multi-repository feature management system.

Current Context:
- Feature: ${feature.name}
- Workspace: ${workspaceRoot}
- Projects: ${feature.projects.map(p => `${p.name} (${p.branch})`).join(', ')}
`

    if (gitDiff) {
      prompt += `\nRecent Changes:\n${gitDiff}\n`
    }

    if (recentCommits && recentCommits.length > 0) {
      prompt += `\nRecent Commits:\n${recentCommits.join('\n')}\n`
    }

    if (errorMessage) {
      prompt += `\nError Message:\n${errorMessage}\n`
    }

    if (files && files.length > 0) {
      prompt += `\nModified Files:\n${files.join('\n')}\n`
    }

    prompt += `\nYou are helpful, concise, and focused on practical solutions. Provide actionable advice for software development tasks.`

    return prompt
  }

  // High-level AI command handlers
  async reviewCode(context: AIContext): Promise<string> {
    const prompt = `Review the git diff and provide feedback on:
1. Code quality and best practices
2. Potential bugs or issues
3. Suggestions for improvement
4. Security concerns

Keep your review concise and actionable.`

    const response = await this.chat(prompt, context)
    return response.content
  }

  async generateCommitMessage(context: AIContext): Promise<string> {
    const prompt = `Based on the git diff, generate a conventional commit message following this format:
- First line: <type>: <short description> (max 50 chars)
- Blank line
- Body: detailed explanation of changes (if needed)

Types: feat, fix, docs, style, refactor, test, chore

Be concise and focus on the "why" rather than the "what".`

    const response = await this.chat(prompt, context)
    return response.content
  }

  async explainError(errorText: string, context: AIContext): Promise<string> {
    const prompt = `Explain this error and suggest how to fix it:

${errorText}

Provide:
1. What the error means
2. Why it likely occurred
3. How to fix it (specific steps)
4. How to prevent it in the future`

    const contextWithError = { ...context, errorMessage: errorText }
    const response = await this.chat(prompt, contextWithError)
    return response.content
  }

  async generatePRDescription(context: AIContext): Promise<string> {
    const prompt = `Generate a pull request description based on the commits and changes. Include:

## Summary
Brief overview of the changes

## Changes
- Key changes made (bullet points)

## Testing
How to test these changes

## Notes
Any additional context or considerations

Be professional and concise.`

    const response = await this.chat(prompt, context)
    return response.content
  }

  async suggestNextSteps(context: AIContext): Promise<string> {
    const prompt = `Based on the feature status and recent work, suggest 3-5 actionable next steps for development. Consider:
- Current feature progress
- Recent commits and changes
- Best practices for software development

Be specific and prioritize the most important tasks.`

    const response = await this.chat(prompt, context)
    return response.content
  }

  async debugHelp(issue: string, context: AIContext): Promise<string> {
    const prompt = `Help debug this issue:

${issue}

Provide:
1. Likely causes
2. Debugging steps
3. Potential solutions
4. Related documentation or resources`

    const response = await this.chat(prompt, context)
    return response.content
  }
}

// Factory function to create AI service from config
export async function createAIService(): Promise<AIService | null> {
  try {
    const config = await window.nexworkAPI.config.load()
    
    if (!config.userConfig?.ai?.enabled) {
      return null
    }

    if (!config.userConfig.ai.apiKey) {
      throw new Error('AI API key not configured')
    }

    return new AIService({
      provider: config.userConfig.ai.provider,
      apiKey: config.userConfig.ai.apiKey,
      model: config.userConfig.ai.model
    })
  } catch (error) {
    console.error('Failed to create AI service:', error)
    return null
  }
}
