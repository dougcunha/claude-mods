import type { Color, Elements, RenderChildren } from 'claude-code'

import type { FileItem, GitItem, Scan } from '../types'

import { baseName, isUnder, keyOf, norm, parentOf, relativeTo, sizeText } from './paths'
import type { RemoveMode } from './remove'
import { OTHER_TAG } from './scan'

type Parts = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

/** What the pane shows before the first scan ends. */
export const SCANNING_TEXT = 'Scanning the files and repositories of this session…'

/** What the pane shows when the scan found nothing. */
export const CLEAN_TEXT = 'No file the session created is left, and no repository has Git items.'

/** The words for each removal mode under the actions. */
const MODE_TEXT: Record<RemoveMode, string> = {
  trash: 'Files go to the system trash; what the trash refuses goes to ~/.claude/cleanup-quarantine.',
  quarantine: 'Files move to ~/.claude/cleanup-quarantine.',
  delete: 'Files are deleted for good.',
}

/** The color of each tag, so the reason for a pre-selection reads at a glance. */
const TAG_COLORS: Record<string, Color> = {
  'temp folder': 'warning',
  'temp name': 'warning',
  scratchpad: 'suggestion',
  'outside repos': 'permission',
  [OTHER_TAG]: 'inactive',
}

const CHECKED = '◉'
const UNCHECKED = '○'

/** Columns a card takes from its body: two borders and one cell of padding on each side. */
const CARD_COLUMNS = 4

/** What the pane draws, as plain values and callbacks. */
export type PaneProps = {
  scan: Scan | null
  selected: string[]
  isBusy: boolean
  message: string
  cwd: string
  home?: string
  mode: RemoveMode
  columns: number
  isTerminal: boolean
  onToggle: (id: string) => void
  onSelect: (ids: string[]) => void
  onApply: () => void
  onRescan: () => void
  onClose: () => void
}

/** A path as short as it reads well: relative under the session folder, `~` for the home folder. */
export function shownPath(path: string, cwd: string, home?: string): string {
  if (isUnder(cwd, path) && keyOf(cwd) !== keyOf(path)) return relativeTo(cwd, path)
  if (home !== undefined && isUnder(home, path)) return `~${norm(path).slice(norm(home).replace(/\/$/, '').length)}`

  return norm(path)
}

/** Cuts a text from the left to `room` characters, with an ellipsis in front. */
export function cutLeft(text: string, room: number): string {
  if (text.length <= room) return text
  if (room <= 1) return '…'

  return `…${text.slice(text.length - room + 1)}`
}

/** The label of the apply button for what is selected now. */
export function applyLabel(files: number, git: number): string {
  const parts: string[] = []
  if (files > 0) parts.push(`Remove ${files}`)
  if (git > 0) parts.push(`Ask Claude to fix ${git}`)

  return parts.length === 0 ? 'Select items' : parts.join(' · ')
}

/** The folder a row names under its name: `.` for the session folder itself; a group row names its own folder. */
function folderText(item: FileItem, props: PaneProps): string {
  const folder = item.members === undefined ? parentOf(item.path) : item.path

  return keyOf(folder) === keyOf(props.cwd) ? './' : `${shownPath(folder, props.cwd, props.home)}/`
}

/** How many entries a row removes: its members, or itself. */
export const entryCount = (item: FileItem): number => item.members?.length ?? 1

/** The name a row shows: the file or folder, or the count of entries a group row stands for. */
export function rowName(item: FileItem): string {
  if (item.members === undefined) return `${baseName(item.path)}${item.isFolder ? '/' : ''}`
  const count = item.members.length

  return `${count} ${count === 1 ? 'entry' : 'entries'} in ${baseName(item.path)}/`
}

/** Draws with the surface's own Box, Text and Button. */
function drawing(parts: Parts, props: PaneProps) {
  const { Box, Text, Button } = parts
  const inner = Math.max(12, props.columns - CARD_COLUMNS)

  const card = (key: string, header: RenderChildren, children: RenderChildren, accent: Color = 'subtle') => (
    <Box
      key={`card:${key}`}
      flexDirection="column"
      borderStyle="round"
      borderColor={accent}
      paddingX={1}
      {...(props.isTerminal ? {} : { marginBottom: 1, paddingY: 1 })}
      hover={{ borderColor: 'claude' }}
    >
      {header}
      {children}
    </Box>
  )

  /** A card's title row: the title and the count, then `all · none`. */
  const header = (key: string, title: string, chosen: number, total: number, ids: string[]) => (
    <Box key={`head:${key}`} flexDirection="row" justifyContent="space-between">
      <Box flexDirection="row" gap={1}>
        <Text bold>{title}</Text>
        <Text color={chosen > 0 ? 'claude' : 'inactive'}>{`${chosen}/${total}`}</Text>
      </Box>
      <Box flexDirection="row" gap={1}>
        <Button key={`${key}:all`} plain onPress={() => props.onSelect([...new Set([...props.selected, ...ids])])}>
          <Text dimColor>all</Text>
        </Button>
        <Text dimColor>·</Text>
        <Button key={`${key}:none`} plain onPress={() => props.onSelect(props.selected.filter(id => !ids.includes(id)))}>
          <Text dimColor>none</Text>
        </Button>
      </Box>
    </Box>
  )

  const mark = (isOn: boolean) => <Text color={isOn ? 'success' : 'inactive'}>{isOn ? CHECKED : UNCHECKED}</Text>

  const fileRow = (item: FileItem) => {
    const isOn = props.selected.includes(item.id)
    const size = sizeText(item.size, item.isSizeAtLeast)
    const name = rowName(item)
    const folder = folderText(item, props)

    return (
      <Box key={`row:${item.id}`} flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between" gap={1}>
          <Button key={item.id} plain onPress={() => props.onToggle(item.id)}>
            {mark(isOn)}
            {' '}
            <Text bold={isOn} dimColor={!isOn}>
              {cutLeft(name, Math.max(8, inner - size.length - 4))}
            </Text>
          </Button>
          <Text dimColor>{size}</Text>
        </Box>
        <Box flexDirection="row" paddingLeft={2} gap={1}>
          <Text dimColor wrap="truncate-start">
            {cutLeft(folder, Math.max(8, Math.floor(inner / 2)))}
          </Text>
          {item.tags.map(tag => (
            <Text key={`${item.id}:${tag}`} color={TAG_COLORS[tag] ?? 'inactive'}>
              {tag}
            </Text>
          ))}
        </Box>
      </Box>
    )
  }

  const gitRow = (item: GitItem) => {
    const isOn = props.selected.includes(item.id)
    const where = keyOf(item.repo) === keyOf(props.cwd) ? '.' : shownPath(item.repo, props.cwd, props.home)

    return (
      <Box key={`row:${item.id}`} flexDirection="column">
        <Button key={item.id} plain onPress={() => props.onToggle(item.id)}>
          {mark(isOn)}
          {' '}
          <Text bold color="claude">
            {cutLeft(where, Math.max(8, Math.floor(inner / 2)))}
          </Text>
        </Button>
        <Box paddingLeft={2}>
          <Text dimColor={!isOn}>{item.text}</Text>
        </Box>
      </Box>
    )
  }

  return { card, header, fileRow, gitRow }
}

/** The pane body: a summary line, the Files and Git cards, then the actions and the last result. */
export function paneBody(parts: Parts, props: PaneProps) {
  const { Box, Text, Button } = parts
  const { scan } = props
  // Each line of the result: one that starts with ✗ is a failure, any other a success.
  const message =
    props.message === ''
      ? null
      : props.message.split('\n').map((line, index) => {
          const isError = line.startsWith('✗')
          return (
            <Text key={`message:${index}`} color={isError ? 'error' : 'success'}>
              {isError ? line : `✓ ${line}`}
            </Text>
          )
        })

  if (scan === null) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color="claude">{`◌ ${SCANNING_TEXT}`}</Text>
        {message}
      </Box>
    )
  }

  const { card, header, fileRow, gitRow } = drawing(parts, props)
  const fileIds = scan.files.map(item => item.id)
  const gitIds = scan.git.map(item => item.id)
  const chosenFiles = scan.files.filter(item => props.selected.includes(item.id))
  const chosenEntries = chosenFiles.reduce((sum, item) => sum + entryCount(item), 0)
  const chosenGit = gitIds.filter(id => props.selected.includes(id)).length
  const bytes = chosenFiles.reduce((sum, item) => sum + item.size, 0)
  const isAtLeast = chosenFiles.some(item => item.isSizeAtLeast)
  const entries = scan.files.filter(item => !item.isOther).reduce((sum, item) => sum + entryCount(item), 0)
  const isEmpty = scan.files.length === 0 && scan.git.length === 0
  const hasChoice = chosenFiles.length + chosenGit > 0

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={2} paddingX={1}>
        <Box flexDirection="row">
          <Text bold color="claude">{`${entries}`}</Text>
          <Text dimColor>{entries === 1 ? ' file' : ' files'}</Text>
        </Box>
        <Box flexDirection="row">
          <Text bold color="claude">{`${scan.git.length}`}</Text>
          <Text dimColor>{scan.git.length === 1 ? ' git item' : ' git items'}</Text>
        </Box>
        {chosenFiles.length > 0 ? (
          <Box flexDirection="row">
            <Text bold color="success">{sizeText(bytes, isAtLeast)}</Text>
            <Text dimColor> to free</Text>
          </Box>
        ) : null}
      </Box>
      {isEmpty
        ? card('clean', <Text bold color="success">✓ All clean</Text>, <Text dimColor>{CLEAN_TEXT}</Text>, 'success')
        : null}
      {scan.files.length > 0 ? card('files', header('files', 'Files', chosenFiles.length, scan.files.length, fileIds), scan.files.map(fileRow)) : null}
      {scan.git.length > 0 ? card('git', header('git', 'Git', chosenGit, scan.git.length, gitIds), scan.git.map(gitRow)) : null}
      <Box flexDirection="row" gap={1} paddingX={1}>
        {props.isBusy ? (
          <Text color="claude">◌ Working…</Text>
        ) : (
          <Button key="apply" variant={hasChoice ? 'primary' : 'secondary'} onPress={props.onApply}>
            {applyLabel(chosenEntries, chosenGit)}
          </Button>
        )}
        <Button key="rescan" onPress={props.onRescan}>
          Rescan
        </Button>
        <Button key="close" role="dismiss" onPress={props.onClose}>
          Close
        </Button>
      </Box>
      <Box flexDirection="column" paddingX={1}>
        {message}
        {scan.files.length > 0 ? <Text dimColor>{MODE_TEXT[props.mode]}</Text> : null}
        {scan.git.length > 0 ? <Text dimColor>Git items go to Claude as one prompt; Claude asks before it commits or pushes.</Text> : null}
      </Box>
    </Box>
  )
}
