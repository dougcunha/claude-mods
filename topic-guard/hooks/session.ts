import type { Host } from './host'

/** The folder under the temporary directory that holds this mod's files, one subfolder per session. */
export const MOD_DIR = 'claude-topic-guard'

/** How often, and for how long at most, the mod reads the session id after a /clear, before it checks the prompt box anyway. */
export const SWITCH_POLL_MS = 100
export const SWITCH_LIMIT_MS = 3_000

const norm = (path: string): string => path.replace(/\\/g, '/').replace(/\/$/, '')

/** The debug log of one session: `<temp>/claude-topic-guard/<session id>/debug.log`. */
export const debugLogPath = (tempDir: string, sessionId: string): string => `${norm(tempDir)}/${MOD_DIR}/${sessionId}/debug.log`

/**
 * Clears the session and leaves the held message in the prompt box of the new one, for the person to send. The box
 * keeps its draft through a /clear; the mod puts the message back only when the box is empty after the switch.
 */
export async function moveToNewSession(host: Host, text: string): Promise<void> {
  const before = await host.sessionId()
  await host.clear()
  await waitForNewSession(host, before)
  if ((await host.readBox()).trim() === '') await host.fill(text)
}

/**
 * Waits until the session id is no longer `before`, up to SWITCH_LIMIT_MS. After a /clear the engine still reports the
 * ended session for about a second, and the box can still change then.
 */
async function waitForNewSession(host: Host, before: string): Promise<void> {
  for (let waited = 0; waited < SWITCH_LIMIT_MS; waited += SWITCH_POLL_MS) {
    if ((await host.sessionId()) !== before) return
    await host.sleep(SWITCH_POLL_MS)
  }
}
