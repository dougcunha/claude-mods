import type { JiraIssue } from '../types'

import { age } from './repo'

/** Issues the state keeps; the section draws JIRA_ROOM of them, the last mentioned first. */
const KEEP = 5
export const JIRA_ROOM = 3

/** How long a read issue stands before a new mention reads it again. */
export const JIRA_FRESH_MS = 5 * 60_000

/** The fields the section draws; the server sends no description with them. */
export const JIRA_FIELDS = ['summary', 'status', 'assignee', 'priority', 'updated']

const KEY = /^[A-Z][A-Z0-9_]+-\d+$/
const BROWSE = /\/browse\/([A-Z][A-Z0-9_]+-\d+)/g

/** The server name in an Atlassian MCP tool's name: `mcp__plugin_atlassian_atlassian__getJiraIssue` gives `plugin_atlassian_atlassian`. */
export const serverOf = (tool: string): string | undefined => /^mcp__(.+)__getJiraIssue$/.exec(tool)?.[1]

/**
 * The names `$.mcp.call` may know a server by, from the spelling in its tools' names: first the `/mcp` names it can stand
 * for (`plugin_atlassian_atlassian` is `plugin:atlassian:atlassian`, `claude_ai_Atlassian` is `claude.ai Atlassian`),
 * then the spelling itself. An underscore may sit inside a plugin or server name, so each split is a candidate.
 */
export function serverNames(spelled: string): string[] {
  const names: string[] = []
  const parts = spelled.split('_')
  if (parts[0] === 'plugin')
    for (let at = 2; at < parts.length; at++) names.push(`plugin:${parts.slice(1, at).join('_')}:${parts.slice(at).join('_')}`)
  if (spelled.startsWith('claude_ai_')) names.push(`claude.ai ${spelled.slice('claude_ai_'.length).replace(/_/g, ' ')}`)

  return [...names, spelled]
}

/**
 * An error as the row shows it: without the engine's `HooksError: <plugin>:` lead, on one line. Auto mode's classifier
 * judges only calls a model request asked for, so it refuses the mod's own read: the row then says how to allow it.
 */
export function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const tool = /classifier gave no verdict for (\S+?):/.exec(message)?.[1]
  if (tool !== undefined) return `Auto mode cannot approve the mod's read: allow ${tool} in permissions.`

  return message.replace(/^(?:HooksError:\s*)?(?:session-info:\s*)?/, '').trim().split('\n')[0]?.slice(0, 300) || 'The issue could not be read.'
}

/** Whether a failed read was the permission check's refusal, which an allow rule for the tool lifts. */
export const isRefusal = (message: string): boolean => /\brefused:|auto mode classifier/.test(message)

/** Whether the settings' allow rules let the tool through: the tool itself, its whole server, or the server's wildcard. */
export function isAllowed(settings: unknown, tool: string): boolean {
  const allow = (settings as { permissions?: { allow?: unknown } } | undefined)?.permissions?.allow
  if (!Array.isArray(allow)) return false
  const server = tool.split('__').slice(0, 2).join('__')

  return allow.some(rule => rule === tool || rule === server || rule === `${server}__*`)
}

/** The request the Allow button puts in the prompt: Claude edits the settings, under its own permission check. */
export const allowRequest = (tool: string): string =>
  `Add "${tool}" to permissions.allow in ~/.claude/settings.json, so the session-info mod can read Jira issues.`

/** The key pattern from the settings, matched as a whole word; an empty or invalid one finds nothing. */
export function toKeyPattern(source: unknown): RegExp | undefined {
  if (typeof source !== 'string' || source.trim() === '') return undefined
  try {
    return new RegExp(`(?<![\\w-])(?:${source})(?![\\w-])`, 'g')
  } catch {
    return undefined
  }
}

export const isIssueKey = (text: string): boolean => KEY.test(text)

/** The issue keys a text names, once each: the keys of `/browse/` links, then the matches of the pattern. */
export function issueKeys(text: string, pattern: RegExp | undefined): string[] {
  const found = [...text.matchAll(BROWSE)].map(match => match[1] ?? '')
  if (pattern) found.push(...[...text.matchAll(pattern)].map(match => match[0].toUpperCase()))

  return [...new Set(found.filter(isIssueKey))]
}

/** Puts the key on top, keeping what was read of it; older issues drop off. */
export function mention(list: readonly JiraIssue[], key: string, at: number): JiraIssue[] {
  const known = list.find(issue => issue.key === key)

  return [{ ...(known ?? { key }), at }, ...list.filter(issue => issue.key !== key)].slice(0, KEEP)
}

/** A key not read, read with an error, or read minutes ago is read again. */
export const needsRead = (issue: JiraIssue | undefined, now: number): boolean =>
  issue === undefined || issue.readAt === undefined || issue.error !== undefined || now - issue.readAt > JIRA_FRESH_MS

type Content = { content?: readonly { type: string; text?: string }[]; isError?: boolean }

const name = (value: unknown, field: string): string | undefined => {
  const item = value as Record<string, unknown> | null | undefined
  const text = item?.[field]

  return typeof text === 'string' && text !== '' ? text : undefined
}

/** The issue as `getJiraIssue` answered it, or the error it gave. */
export function readIssue(issue: JiraIssue, result: Content, now: number): JiraIssue {
  const text = (result.content ?? []).map(block => block.text ?? '').join('\n')
  const { error: _, blockedTool: __, ...base } = issue
  try {
    if (result.isError) throw new Error(text)
    const parsed = JSON.parse(text) as { data?: { fields?: Record<string, unknown> }; error?: unknown }
    const fields = parsed.data?.fields
    if (fields === undefined) throw new Error(typeof parsed.error === 'string' ? parsed.error : text)
    const updated = Date.parse(String(fields.updated ?? ''))

    return {
      ...base,
      readAt: now,
      ...(typeof fields.summary === 'string' ? { summary: fields.summary } : {}),
      ...(name(fields.status, 'name') === undefined ? {} : { status: name(fields.status, 'name') }),
      ...(name(fields.priority, 'name') === undefined ? {} : { priority: name(fields.priority, 'name') }),
      ...(name(fields.assignee, 'displayName') === undefined ? {} : { assignee: name(fields.assignee, 'displayName') }),
      ...(Number.isNaN(updated) ? {} : { updated }),
    }
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).trim().split('\n')[0] || 'The issue could not be read.'

    return { ...base, readAt: now, error: message.slice(0, 200) }
  }
}

/** The site from `getAccessibleAtlassianResources`: the first one with Jira. */
export function readSite(result: Content): { cloudId: string; url?: string } | undefined {
  try {
    const text = (result.content ?? []).map(block => block.text ?? '').join('\n')
    const parsed = JSON.parse(text) as { data?: { resources?: { cloudId?: string; url?: string; products?: { id?: string }[] }[] } }
    const resources = parsed.data?.resources ?? []
    const site = resources.find(one => one.products?.some(product => product.id === 'jira')) ?? resources[0]
    if (typeof site?.cloudId !== 'string') return undefined

    return { cloudId: site.cloudId, ...(typeof site.url === 'string' ? { url: site.url } : {}) }
  } catch {
    return undefined
  }
}

/** The site setting: a URL serves as the cloud id and the link base; anything else is a cloud id alone. */
export function siteSetting(value: unknown): { cloudId: string; url?: string } | undefined {
  const text = typeof value === 'string' ? value.trim().replace(/\/+$/, '') : ''
  if (text === '') return undefined

  return /^https?:\/\//.test(text) ? { cloudId: text, url: text } : { cloudId: text }
}

export const browseUrl = (site: string | undefined, key: string): string | undefined => (site === undefined ? undefined : `${site}/browse/${key}`)

/** Done states read green, work in progress blue, the rest grey; Jira's names vary, so the match is by words. */
export function statusColor(status: string | undefined): string {
  const text = (status ?? '').toLowerCase()
  if (/\b(done|closed|resolved|released|conclu|fechad|resolvid|finaliz)/.test(text)) return 'success'
  if (/\b(progress|review|test|andamento|revis|teste|doing|develop)/.test(text)) return 'suggestion'

  return 'inactive'
}

/** `P3 · Douglas Cunha · updated 2h ago`, or what the row waits for. */
export function issueDetail(issue: JiraIssue, now: number): string {
  if (issue.readAt === undefined) return 'Reading…'
  const parts = [issue.priority, issue.assignee ?? 'Unassigned', issue.updated === undefined ? undefined : `updated ${age(now - issue.updated)} ago`]

  return parts.filter(part => part !== undefined).join(' · ')
}
