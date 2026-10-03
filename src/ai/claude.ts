import { demoApiErrorMessage, demoApiUrl } from '../lib/demo/api'

export type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string }

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | ClaudeContentBlock[]
}

export interface ClaudeResponse {
  content: ClaudeContentBlock[]
  stop_reason: string
}

export function extractTextBlocks(content: ClaudeContentBlock[]): string {
  return content
    .filter(
      (block): block is { type: 'text'; text: string } =>
        block.type === 'text' && typeof block.text === 'string',
    )
    .map((block) => block.text)
    .join('')
}

export function extractToolUses(
  content: ClaudeContentBlock[],
): Array<{ type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }> {
  return content.filter(
    (
      block,
    ): block is {
      type: 'tool_use'
      id: string
      name: string
      input: Record<string, unknown>
    } => block.type === 'tool_use',
  )
}

export async function sendMessage(params: {
  system?: string
  messages: ClaudeMessage[]
  tools?: unknown[]
  maxTokens?: number
}): Promise<ClaudeResponse> {
  const proxyUrl = demoApiUrl()

  const body: Record<string, unknown> = {
    messages: params.messages,
    max_tokens: params.maxTokens ?? 1000,
  }
  if (params.system !== undefined) {
    body.system = params.system
  }
  if (params.tools !== undefined) {
    body.tools = params.tools
  }

  let response: Response
  try {
    response = await fetch(`${proxyUrl}/claude`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error("Couldn't reach Claude — check your connection.")
  }

  if (!response.ok) {
    throw new Error(demoApiErrorMessage(response.status))
  }

  const data = (await response.json()) as ClaudeResponse
  return {
    content: data.content ?? [],
    stop_reason: data.stop_reason ?? 'end_turn',
  }
}

export async function sendCompletion(params: {
  system?: string
  messages: ClaudeMessage[]
  maxTokens?: number
}): Promise<string> {
  const response = await sendMessage(params)
  const text = extractTextBlocks(response.content)

  if (!text) {
    throw new Error("Claude couldn't respond just now. Try again in a moment.")
  }

  return text
}
