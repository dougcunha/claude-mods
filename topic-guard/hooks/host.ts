/** One message of the conversation as the engine hands it over: a role and a string or a list of blocks. */
export type Message = { role: string; content: unknown }

/** What the helper modules need from the engine; register.tsx builds it from `$`, which never crosses an import. */
export type Host = {
  sleep: (ms: number) => Promise<void>
  messages: () => Promise<Message[]>
  /** One completion with no history; null when the model gave no text. */
  complete: (request: { model: string; system: string; prompt: string }) => Promise<string | null>
  /**
   * One `jev_classify` call, whose result comes back as MCP sends it; null when no Jev MCP is connected. It rejects when
   * the call fails or does not answer in time.
   */
  classify: (args: Record<string, unknown>) => Promise<unknown>
  sessionId: () => Promise<string>
  clear: () => Promise<void>
  /** The draft in the prompt box. */
  readBox: () => Promise<string>
  /** Puts the text in the prompt box as the draft. */
  fill: (text: string) => Promise<void>
}
