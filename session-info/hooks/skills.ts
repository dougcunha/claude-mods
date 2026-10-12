import type { SkillUse } from '../types'

/** Rows the section draws, newest first. */
export const SKILL_ROOM = 6

/** Uses the state keeps; older ones drop off. */
const KEEP = 20

export const SKILL_STATUS = {
  active: { glyph: '⟳', color: 'suggestion' },
  done: { glyph: '✓', color: 'success' },
} as const

/** `plugin-authoring` and `anthropic-skills:ste-mode` name one skill whether or not the plugin prefix is spelled. */
export const isSameSkill = (a: string, b: string): boolean => a === b || a.endsWith(`:${b}`) || b.endsWith(`:${a}`)

export function startSkill(list: readonly SkillUse[], name: string, agentId: string | undefined, at: number): SkillUse[] {
  const use: SkillUse = { name, ...(agentId === undefined ? {} : { agentId }), at, isActive: true }

  return [use, ...list].slice(0, KEEP)
}

/** A skill's text stays in its loop until the loop's turn ends: the end of the turn ends the loop's active skills. */
export const endSkills = (list: readonly SkillUse[], agentId: string | undefined): SkillUse[] =>
  list.map(use => (use.isActive && use.agentId === agentId ? { ...use, isActive: false } : use))

/** `2 active`, or '' when none is. */
export function skillSummary(list: readonly SkillUse[]): string {
  const active = list.filter(use => use.isActive).length

  return active === 0 ? '' : `${active} active`
}
