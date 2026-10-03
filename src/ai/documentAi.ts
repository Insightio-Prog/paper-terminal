import { sendCompletion } from './claude'

const SYSTEM_PROMPT = [
  'You are a writing assistant inside Paper Terminal, a business suite for UK sole traders.',
  'Return ONLY the full document text as plain prose.',
  'No markdown syntax, no headers, no preamble or commentary — your output replaces the document body directly.',
].join(' ')

export async function generateDocumentContent(
  prompt: string,
  title: string,
  currentContent: string,
  category: string,
): Promise<string> {
  const userMessage = [
    `Document title: ${title}`,
    `Document category: ${category}`,
    '',
    'Current document content:',
    currentContent.trim() || '(empty)',
    '',
    `Instruction: ${prompt}`,
  ].join('\n')

  return sendCompletion({
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens: 2000,
  })
}
