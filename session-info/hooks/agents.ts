/** One agent loop as `$.agent.list()` reports it. */
export type Agent = {
  id: string
  type: string
  description: string
  status: 'pending' | 'running' | 'waiting' | 'idle' | 'completed' | 'failed' | 'killed'
  parentId?: string
  name?: string
}

export type AgentRow = { agent: Agent; depth: number }

export const AGENT_STATUS = {
  running: { glyph: '⟳', color: 'suggestion' },
  pending: { glyph: '◌', color: 'inactive' },
  waiting: { glyph: '⏸', color: 'warning' },
  idle: { glyph: '○', color: 'inactive' },
  completed: { glyph: '✓', color: 'success' },
  failed: { glyph: '✖', color: 'error' },
  killed: { glyph: '⊘', color: 'error' },
} as const satisfies Record<Agent['status'], { glyph: string; color: string }>

const RANK: Record<Agent['status'], number> = {
  running: 0, waiting: 1, pending: 2, idle: 3, failed: 4, killed: 5, completed: 6,
}

const isActive = (agent: Agent): boolean => RANK[agent.status] <= RANK.pending

/** Active agents first, each followed by the agents it spawned, indented under it. */
export function agentRows(agents: readonly Agent[]): AgentRow[] {
  const ids = new Set(agents.map(agent => agent.id))
  const byRank = [...agents].sort((a, b) => RANK[a.status] - RANK[b.status])
  const rows: AgentRow[] = []
  const walk = (parentId: string | undefined, depth: number): void => {
    for (const agent of byRank) {
      const isChild = parentId === undefined ? agent.parentId === undefined || !ids.has(agent.parentId) : agent.parentId === parentId
      if (!isChild) continue
      rows.push({ agent, depth })
      walk(agent.id, depth + 1)
    }
  }
  walk(undefined, 0)

  return rows
}

export const agentLabel = (agent: Agent): string => agent.name ?? agent.type

/** `2 running · 1 idle · 3 done`, or `none`. */
export function agentSummary(agents: readonly Agent[]): string {
  if (agents.length === 0) return 'none'
  const active = agents.filter(isActive).length
  const idle = agents.filter(agent => agent.status === 'idle').length
  const done = agents.length - active - idle
  const parts = [[active, 'running'], [idle, 'idle'], [done, 'done']] as const

  return parts.filter(([count]) => count > 0).map(([count, word]) => `${count} ${word}`).join(' · ')
}
