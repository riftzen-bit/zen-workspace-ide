import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ipcMain } from 'electron'
import { setupAIHandlers } from '../../../src/main/ai/aiHandler'

const handlers: Record<string, (...args: any[]) => any> = {}
const streamChat = vi.fn()
const executeTool = vi.fn()

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  }
}))

vi.mock('../../../src/main/ai/providerRegistry', () => ({
  getProvider: vi.fn(() => ({
    streamChat
  }))
}))

vi.mock('../../../src/main/ai/tools', () => ({
  executeTool: (...args: unknown[]) => executeTool(...args)
}))

vi.mock('../../../src/main/oauth/googleOAuth', () => ({
  getGeminiOAuthAccess: vi.fn().mockResolvedValue(null)
}))

vi.mock('../../../src/main/security', () => ({
  isTrustedIpcSender: vi.fn(() => true),
  resolvePathWithinRoot: vi.fn()
}))

describe('aiHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(handlers).forEach((key) => delete handlers[key])
    ;(ipcMain.handle as any).mockImplementation((name: string, fn: (...args: any[]) => any) => {
      handlers[name] = fn
    })
    setupAIHandlers()
  })

  it('stops chat loop after too many tool calls', async () => {
    streamChat.mockImplementation(async (_messages, _model, _credential, onChunk) => {
      onChunk({
        type: 'text',
        text: '<tool_call>{"name":"read_file","args":{"path":"src/index.ts"}}</tool_call>'
      })
    })
    executeTool.mockResolvedValue('file contents')

    const send = vi.fn()
    const event = {
      sender: {
        isDestroyed: vi.fn(() => false),
        send
      }
    }

    await handlers['ai:chat'](event, {
      provider: 'openai',
      model: 'gpt-5',
      apiKey: 'sk-test',
      messages: [{ role: 'user', content: 'Inspect the workspace' }],
      workspaceDir: 'D:/Projects/app'
    })

    const errorChunks = send.mock.calls
      .map((call) => call[1])
      .filter((payload) => payload?.type === 'error')
    expect(errorChunks.some((payload) => payload.error.includes('Tool call limit reached'))).toBe(
      true
    )
    expect(executeTool).toHaveBeenCalledTimes(8)
  })

  it('injects a real newline in truncated tool responses', async () => {
    let invocation = 0
    streamChat.mockImplementation(async (_messages, _model, _credential, onChunk) => {
      invocation += 1
      if (invocation === 1) {
        onChunk({
          type: 'text',
          text: '<tool_call>{"name":"read_file","args":{"path":"src/index.ts"}}</tool_call>'
        })
        return
      }
      onChunk({ type: 'text', text: 'Final answer' })
    })
    executeTool.mockResolvedValue('x'.repeat(30005))

    const send = vi.fn()
    const event = {
      sender: {
        isDestroyed: vi.fn(() => false),
        send
      }
    }

    await handlers['ai:chat'](event, {
      provider: 'openai',
      model: 'gpt-5',
      apiKey: 'sk-test',
      messages: [{ role: 'user', content: 'Inspect the workspace' }],
      workspaceDir: 'D:/Projects/app'
    })

    const secondCallMessages = streamChat.mock.calls[1][0] as Array<{
      role: string
      content: string
    }>
    const toolResponse = secondCallMessages.find(
      (message) => message.role === 'user' && message.content.includes('<tool_response>')
    )
    expect(toolResponse?.content).toContain('\n... (truncated)')
    expect(toolResponse?.content).not.toContain('\\n... (truncated)')
  })
})
