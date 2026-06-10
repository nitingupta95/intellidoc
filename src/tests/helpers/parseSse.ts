import { describe, it, expect } from 'vitest'

export type SseEvent = {
  type: string
  data: Record<string, any>
  id?: string
}

export function parseSseResponse(body: string): SseEvent[] {
  // Split raw SSE body on double newline (event boundary)
  const blocks = body.split(/\n\n/).filter(Boolean)
  return blocks.flatMap(block => {
    const lines = block.split('\n')
    let type = 'message', data: Record<string, any> = {}, id: string | undefined
    for (const line of lines) {
      if (line.startsWith('event:')) type = line.slice(6).trim()
      if (line.startsWith('data:')) {
        try { data = JSON.parse(line.slice(5).trim()) } catch { return [] }
      }
      if (line.startsWith('id:')) id = line.slice(3).trim()
    }
    return [{ type, data, id }]
  })
}

// Supertest .parse() hook — use with .buffer(true).parse(parseRawSse)
export function parseRawSse(
  res: import('http').IncomingMessage,
  cb: (err: Error | null, body: string) => void
) {
  let data = ''
  res.on('data', chunk => { data += chunk.toString() })
  res.on('end', () => cb(null, data))
}

// Convenience accessors
export const getSseText = (events: SseEvent[]) =>
  events.filter(e => e.type === 'delta').map(e => e.data.text as string).join('')

export const getSseDone = (events: SseEvent[]) =>
  events.find(e => e.type === 'done')?.data ?? null

export const getSseWarning = (events: SseEvent[]) =>
  events.find(e => e.type === 'warning')?.data ?? null

// Unit tests for the parser itself
describe('parseSseResponse', () => {
  it('parses a valid SSE stream', () => {
    const raw = 'event: delta\ndata: {"text":"Hello"}\n\nevent: done\ndata: {"tokenCount":5}\n\n'
    const events = parseSseResponse(raw)
    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({ type: 'delta', data: { text: 'Hello' }, id: undefined })
    expect(events[1]).toEqual({ type: 'done',  data: { tokenCount: 5 }, id: undefined })
  })
  it('returns [] for empty string', () => {
    expect(parseSseResponse('')).toEqual([])
  })
  it('skips malformed data lines without throwing', () => {
    const raw = 'event: delta\ndata: NOT_JSON\n\nevent: done\ndata: {"tokenCount":1}\n\n'
    const events = parseSseResponse(raw)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('done')
  })
})
