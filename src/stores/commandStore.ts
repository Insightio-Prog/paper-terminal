import { create } from 'zustand'
import type { ClaudeMessage } from '../ai/claude'

const MAX_USER_COMMANDS = 3

/** Keep the last N user commands (and their tool turns); never split tool_use/tool_result. */
export function capConversationHistory(
  messages: ClaudeMessage[],
  maxCommands = MAX_USER_COMMANDS,
): ClaudeMessage[] {
  const userCommandIndices: number[] = []

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    if (message.role === 'user' && typeof message.content === 'string') {
      userCommandIndices.push(i)
    }
  }

  if (userCommandIndices.length <= maxCommands) {
    return messages
  }

  const startIndex =
    userCommandIndices[userCommandIndices.length - maxCommands]
  return messages.slice(startIndex)
}

interface CommandState {
  conversationHistory: ClaudeMessage[]
  clearConversation: () => void
  appendTurn: (turn: ClaudeMessage[]) => void
}

export const useCommandStore = create<CommandState>((set, get) => ({
  conversationHistory: [],

  clearConversation: () => set({ conversationHistory: [] }),

  appendTurn: (turn) => {
    if (turn.length === 0) return
    const next = capConversationHistory([
      ...get().conversationHistory,
      ...turn,
    ])
    set({ conversationHistory: next })
  },
}))
