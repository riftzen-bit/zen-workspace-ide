import { describe, expect, it } from 'vitest'
import { clearBuffer, parseLine, processChunk, stripAnsi } from '../../src/main/activityParser'

describe('activityParser', () => {
  it('strips Windows ConPTY private mode sequences', () => {
    expect(stripAnsi('\u001b[?25lanalyzing request\u001b[?25h')).toBe('analyzing request')
  })

  it('strips OSC sequences terminated with ST', () => {
    expect(stripAnsi('ready\u001b]0;Window Title\u001b\\done')).toBe('readydone')
  })

  it('parses status lines after ANSI cleanup', () => {
    expect(parseLine('\u001b[?25lanalyzing request')).toEqual({
      type: 'status',
      message: 'analyzing request',
      agentStatus: 'working'
    })
  })

  it('parses updated messages with Windows paths', () => {
    expect(parseLine('Updated C:\\Users\\paul\\Projects\\app\\src\\main\\index.ts')).toEqual({
      type: 'file_write',
      message: 'Updated C:\\Users\\paul\\Projects\\app\\src\\main\\index.ts',
      filePath: 'C:\\Users\\paul\\Projects\\app\\src\\main\\index.ts'
    })
  })

  it('parses delete messages with Windows paths', () => {
    expect(parseLine('Removed C:\\Users\\paul\\Projects\\app\\src\\main\\index.ts')).toEqual({
      type: 'file_delete',
      message: 'Removed C:\\Users\\paul\\Projects\\app\\src\\main\\index.ts',
      filePath: 'C:\\Users\\paul\\Projects\\app\\src\\main\\index.ts'
    })
  })

  it('treats carriage returns as line boundaries for streaming output', () => {
    const events = processChunk('term-test', 'analyzing request\r')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      terminalId: 'term-test',
      type: 'status',
      message: 'analyzing request',
      agentStatus: 'working'
    })
    clearBuffer('term-test')
  })
})
