import {
  extractTextBlocks,
  extractToolUses,
  sendMessage,
  type ClaudeMessage,
} from './claude'
import { getSystemPrompt } from './context'
import { claudeTools, executeTool } from './tools'
import { useCommandStore } from '../stores/commandStore'
import { useContactStore } from '../stores/contactStore'
import { useInvoiceStore } from '../stores/invoiceStore'
import { useLedgerStore } from '../stores/ledgerStore'

const MAX_ITERATIONS = 5

function todayLocalDate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function reloadAfterTool(name: string): Promise<void> {
  const taxYear = useLedgerStore.getState().taxYear

  switch (name) {
    case 'add_ledger_entry':
      await useLedgerStore.getState().loadEntries(taxYear)
      break
    case 'create_invoice':
      await useInvoiceStore.getState().loadInvoices()
      break
    case 'add_contact':
      await useContactStore.getState().loadContacts()
      break
    default:
      break
  }
}

export async function runCommand(userInput: string): Promise<string> {
  const history = useCommandStore.getState().conversationHistory
  const system = getSystemPrompt(todayLocalDate())

  const thisTurn: ClaudeMessage[] = [
    {
      role: 'user',
      content: userInput,
    },
  ]
  const messages: ClaudeMessage[] = [...history, ...thisTurn]

  let lastText = ''

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const response = await sendMessage({
      system,
      messages,
      tools: claudeTools,
      maxTokens: 1500,
    })

    if (response.stop_reason === 'tool_use') {
      const toolUses = extractToolUses(response.content)

      const assistantMessage: ClaudeMessage = {
        role: 'assistant',
        content: response.content,
      }
      thisTurn.push(assistantMessage)
      messages.push(assistantMessage)

      const toolResults = []
      for (const toolUse of toolUses) {
        const content = await executeTool(toolUse.name, toolUse.input ?? {})
        await reloadAfterTool(toolUse.name)
        toolResults.push({
          type: 'tool_result' as const,
          tool_use_id: toolUse.id,
          content,
        })
      }

      const toolResultMessage: ClaudeMessage = {
        role: 'user',
        content: toolResults,
      }
      thisTurn.push(toolResultMessage)
      messages.push(toolResultMessage)

      const interim = extractTextBlocks(response.content)
      if (interim) lastText = interim
      continue
    }

    const assistantMessage: ClaudeMessage = {
      role: 'assistant',
      content: response.content,
    }
    thisTurn.push(assistantMessage)

    useCommandStore.getState().appendTurn(thisTurn)

    const text = extractTextBlocks(response.content)
    if (text) return text
    if (lastText) return lastText
    return 'Done.'
  }

  useCommandStore.getState().appendTurn(thisTurn)

  const suffix =
    ' The task may be incomplete — try again with a more specific request.'
  return (lastText || 'Stopped after several tool steps.') + suffix
}
