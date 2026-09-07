export async function readBoundedJson(message: Request | Response, maxBytes: number): Promise<unknown> {
  if (!message.body) throw new Error('Missing response body.')
  const reader = message.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) throw new Error('Response exceeds its size limit.')
      chunks.push(value)
    }
  } catch (error) { await reader.cancel().catch(() => undefined); throw error }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
}
