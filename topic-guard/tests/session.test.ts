import { expect, test } from 'claude-code/testing'

import type { Host } from '../hooks/host'
import { debugLogPath, moveToNewSession, SWITCH_LIMIT_MS, SWITCH_POLL_MS } from '../hooks/session'

const SESSION = 's-1'
const MESSAGE = 'Add a dark theme to the docs site.'

/** A host whose session id changes `switchAfter` sleeps after the clear (Infinity keeps the old id), with `box` as the draft. */
function fakeHost(world: { switchAfter: number; box: string }): { host: Host; calls: string[] } {
  const calls: string[] = []
  let isCleared = false
  let sleeps = 0
  const host = {
    sessionId: async () => (isCleared && sleeps >= world.switchAfter ? 's-2' : SESSION),
    sleep: async (ms: number) => void (sleeps++, calls.push(`sleep ${ms}`)),
    clear: async () => void ((isCleared = true), calls.push('clear')),
    readBox: async () => (calls.push('read box'), world.box),
    fill: async (text: string) => void calls.push(`fill ${text}`),
  } as unknown as Host

  return { host, calls }
}

test('the move clears the session, waits for the new session id, then puts the message in an empty box', async () => {
  const { host, calls } = fakeHost({ switchAfter: 2, box: '  ' })

  await moveToNewSession(host, MESSAGE)

  expect(calls).toEqual(['clear', `sleep ${SWITCH_POLL_MS}`, `sleep ${SWITCH_POLL_MS}`, 'read box', `fill ${MESSAGE}`])
})

test('a box that kept the message through the clear is left as it is', async () => {
  const { host, calls } = fakeHost({ switchAfter: 0, box: MESSAGE })

  await moveToNewSession(host, MESSAGE)

  expect(calls).toEqual(['clear', 'read box'])
})

test('a session id that never changes after the clear still gets the box checked, after the wait limit', async () => {
  const { host, calls } = fakeHost({ switchAfter: Infinity, box: '' })

  await moveToNewSession(host, MESSAGE)

  expect(calls.filter(call => call.startsWith('sleep'))).toHaveLength(SWITCH_LIMIT_MS / SWITCH_POLL_MS)
  expect(calls.at(-1)).toBe(`fill ${MESSAGE}`)
})

test('the debug log sits under the temporary directory, per session, with either separator', async () => {
  expect(debugLogPath('C:\\Users\\Ana Maria\\AppData\\Local\\Temp\\', SESSION)).toBe('C:/Users/Ana Maria/AppData/Local/Temp/claude-topic-guard/s-1/debug.log')
  expect(debugLogPath('/tmp', SESSION)).toBe('/tmp/claude-topic-guard/s-1/debug.log')
})
