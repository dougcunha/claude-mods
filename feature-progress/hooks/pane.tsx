import type { Color, Elements } from 'claude-code'

import type { Feature, Task } from '../types'

import { styleOf } from './icons'
import type { IconSet } from './icons'
import { meter } from './meter'
import { agoText, countOf, durationText, filledCells, groupTasks, isStale, kindText, METER_CELLS, percentText, STALE_MARKER, stageText } from './progress'
import type { Ordered } from './progress'

type Parts = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

/** The key of the Done section in the list of toggled sections. */
export const DONE_SECTION = 'done'

/** What the pane shows when no feature reported progress yet. */
export const EMPTY_TEXT = 'No feature has reported progress yet.'

/** The pointer under the empty state to the contract other flows follow. */
export const EMPTY_HINT = 'A flow reports through the mcp__feature-progress__report tool; the feature-progress README has the contract.'

/** Below this width the feature cards lose their frame, as session-info's cards do. */
export const FRAME_MIN_COLUMNS = 44

/** From this width a task row holds its state, steps, time and link on the same row as its title. */
export const INLINE_MIN_COLUMNS = 64

/** Columns a frame takes: a border and one column of padding on each side. */
const FRAME_COLUMNS = 4

/** The smallest and the largest feature meter, in cells. */
const FEATURE_METER_MIN = 10
const FEATURE_METER_MAX = 40

/** The marks in front of an expanded and a collapsed section. */
const EXPANDED = '▾'
const COLLAPSED = '▸'

/** The paint of the pane body: a background color and the rows it covers, empty when the person set none. */
export type PanePaint = { backgroundColor?: string; minHeight?: number }

/** What the pane draws, as plain values and callbacks. */
export type PaneProps = {
  ordered: Ordered
  warnings: string[]
  now: number
  staleMinutes: number
  /** The width of the pane body, which picks the frames and the row layout (NFR-05). */
  columns: number
  icons: IconSet
  paint: PanePaint
  /** Feature ids, and `DONE_SECTION`, whose open or closed state the person flipped from the default. */
  toggled: string[]
  onToggle: (id: string) => void
  onRefresh: () => void
  onOpenLink: (link: string) => void
}

/** The toggled list after the person flips `id`: added when absent, removed when present. */
export const flip = (list: string[], id: string): string[] => (list.includes(id) ? list.filter(item => item !== id) : [...list, id])

/** Whether a section is expanded: the default, flipped when the person toggled it. */
const isExpanded = (toggled: string[], id: string, isOpenByDefault: boolean): boolean => toggled.includes(id) !== isOpenByDefault

/** The cells of a feature meter for the room left after the count and the percent. */
const featureMeterCells = (room: number): number => Math.min(FEATURE_METER_MAX, Math.max(FEATURE_METER_MIN, room))

/** A stage as a chip: the word on the state's color. */
function chip({ Text }: Parts, text: string, color: Color) {
  return (
    <Text bold color="inverseText" backgroundColor={color}>
      {` ${text} `}
    </Text>
  )
}

/** One task row, with the time to measure its duration against and what pressing its link does. */
type Row = { task: Task; now: number; icons: IconSet; isInline: boolean; onOpenLink: (link: string) => void }

function taskRow(parts: Parts, { task, now, icons, isInline, onOpenLink }: Row) {
  const { Box, Text, Button } = parts
  const style = styleOf(task.state, icons)
  const duration = durationText(task, now)
  const details = (
    <Box flexDirection="row" gap={1} flexShrink={0}>
      <Text color={style.color}>{kindText(task)}</Text>
      {task.steps === undefined ? null : (
        <Box flexDirection="row">
          {meter(Text, filledCells(task.steps.done, task.steps.total, METER_CELLS), METER_CELLS, style.color)}
          <Text dimColor>{` ${task.steps.done}/${task.steps.total}`}</Text>
        </Box>
      )}
      {duration === '' ? null : <Text dimColor>{duration}</Text>}
      {task.link === undefined ? null : (
        <Button plain key={`feature-progress-link:${task.id}`} onPress={() => onOpenLink(task.link ?? '')}>
          <Text color="suggestion">↗ open</Text>
        </Button>
      )}
    </Box>
  )

  return (
    <Box key={`feature-progress-task:${task.id}`} flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text color={style.color}>{style.glyph}</Text>
        <Text bold dimColor={task.state === 'done'}>
          {task.id}
        </Text>
        <Box flexGrow={1} flexShrink={1}>
          <Text wrap="truncate-end" dimColor={task.state === 'done'}>
            {task.title}
          </Text>
        </Box>
        {isInline ? details : null}
      </Box>
      {isInline ? null : <Box paddingLeft={2}>{details}</Box>}
      {task.note === undefined ? null : (
        <Box paddingLeft={2}>
          <Text dimColor italic wrap="wrap">{`└ ${task.note}`}</Text>
        </Box>
      )}
    </Box>
  )
}

/** A group's title on a rule, with its own count. */
function groupTitle({ Box, Text }: Parts, name: string, tasks: Task[]) {
  const done = tasks.filter(task => task.state === 'done').length

  return (
    <Box flexDirection="row" gap={1}>
      <Text color="subtle">──</Text>
      <Text bold>{name}</Text>
      <Text dimColor>{`${done}/${tasks.length}`}</Text>
    </Box>
  )
}

/** One feature of the list, and whether it starts expanded. */
type Block = { feature: Feature; props: PaneProps; isOpenByDefault: boolean }

function featureCard(parts: Parts, { feature, props, isOpenByDefault }: Block) {
  const { Box, Text, Button } = parts
  const style = styleOf(feature.state, props.icons)
  const { done, total } = countOf(feature)
  const isOpen = isExpanded(props.toggled, feature.id, isOpenByDefault)
  const isFeatureStale = isStale(feature, props.now, props.staleMinutes)
  const isFramed = props.columns >= FRAME_MIN_COLUMNS
  const inner = props.columns - (isFramed ? FRAME_COLUMNS : 0)
  const count = ` ${done}/${total}`
  const percent = ` ${percentText(done, total)}`
  const cells = featureMeterCells(inner - count.length - percent.length)
  const frame = isFramed
    ? {
        borderStyle: 'round',
        borderColor: isFeatureStale ? 'warning' : 'subtle',
        borderDimColor: !isOpen,
        paddingX: 1,
        hover: { borderColor: style.color, borderDimColor: false },
      }
    : {}

  return (
    <Box key={`feature-progress-feature:${feature.id}`} flexDirection="column" {...frame}>
      <Box flexDirection="row" gap={1}>
        <Box flexGrow={1} flexShrink={1}>
          <Button plain key={`feature-progress-toggle:${feature.id}`} onPress={() => props.onToggle(feature.id)}>
            <Text dimColor>{`${isOpen ? EXPANDED : COLLAPSED} `}</Text>
            <Text color={style.color}>{`${style.glyph} `}</Text>
            <Text bold>{feature.title}</Text>
          </Button>
        </Box>
        <Box flexShrink={0}>{chip(parts, stageText(feature), style.color)}</Box>
      </Box>
      <Box flexDirection="row">
        {meter(Text, filledCells(done, total, cells), cells)}
        <Text bold>{count}</Text>
        <Text dimColor>{percent}</Text>
      </Box>
      <Box flexDirection="row" gap={1}>
        <Text dimColor>{`updated ${agoText(feature.updatedAt, props.now)}`}</Text>
        {isFeatureStale ? <Text color="warning">{STALE_MARKER}</Text> : null}
      </Box>
      {isOpen && feature.note !== undefined ? <Text dimColor italic wrap="wrap">{feature.note}</Text> : null}
      {isOpen ? (
        <Box flexDirection="column" marginTop={1}>
          {groupTasks(feature.tasks).map(group => (
            <Box key={`feature-progress-group:${feature.id}:${group.name ?? `loose:${group.tasks[0]?.id ?? ''}`}`} flexDirection="column">
              {group.name === undefined ? null : groupTitle(parts, group.name, group.tasks)}
              {group.tasks.map(task =>
                taskRow(parts, { task, now: props.now, icons: props.icons, isInline: props.columns >= INLINE_MIN_COLUMNS, onOpenLink: props.onOpenLink }),
              )}
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  )
}

/** The pane: a header with Refresh and the counts, warnings, open features as cards (latest expanded), and a collapsed Done section (FR-11, FR-12, FR-18). */
export function paneBody(parts: Parts, props: PaneProps) {
  const { Box, Text, Button } = parts
  const { open, done } = props.ordered
  const isDoneOpen = isExpanded(props.toggled, DONE_SECTION, false)
  const isEmpty = open.length === 0 && done.length === 0

  return (
    <Box flexDirection="column" gap={1} {...props.paint}>
      <Box flexDirection="row" justifyContent="space-between" gap={1}>
        <Button key="feature-progress-refresh" label="↻ Refresh" onPress={props.onRefresh} />
        {isEmpty ? null : <Text dimColor>{`${open.length} open · ${done.length} done`}</Text>}
      </Box>
      {props.warnings.map(path => (
        <Text key={`feature-progress-warning:${path}`} color="warning" wrap="wrap">{`⚠ Not a readable feature file: ${path}`}</Text>
      ))}
      {isEmpty ? (
        <Box flexDirection="column">
          <Text>{EMPTY_TEXT}</Text>
          <Text dimColor wrap="wrap">
            {EMPTY_HINT}
          </Text>
        </Box>
      ) : null}
      {open.map((feature, index) => featureCard(parts, { feature, props, isOpenByDefault: index === 0 }))}
      {done.length === 0 ? null : (
        <Box key="feature-progress-done" flexDirection="column" gap={1}>
          <Button plain key="feature-progress-toggle:done" onPress={() => props.onToggle(DONE_SECTION)}>
            <Text dimColor>{`${isDoneOpen ? EXPANDED : COLLAPSED} `}</Text>
            <Text color="success">{`${styleOf('done', props.icons).glyph} `}</Text>
            <Text bold>{`Done (${done.length})`}</Text>
          </Button>
          {isDoneOpen ? done.map(feature => featureCard(parts, { feature, props, isOpenByDefault: false })) : null}
        </Box>
      )}
    </Box>
  )
}
