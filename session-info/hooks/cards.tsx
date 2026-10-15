import type { Color, Elements, RenderChildren } from 'claude-code'

import { ALIGN_GROW } from './title'
import type { TitleAlign } from './title'

type Widgets = Pick<Elements['terminal'], 'Box' | 'Text'>

/** One headline figure of the tiles row: a bold value, then a dim label. */
export type Tile = { key: string; value: string; label: string; color?: Color }

/** Below this many columns a frame costs more than it shows, and sections draw bare. */
const FRAME_MIN_COLUMNS = 44
/** Rows a frame adds to its section: the top and bottom border. */
export const FRAME_ROWS = 2
/** Columns a frame takes from its body: two borders and one cell of padding on each side. */
export const FRAME_COLUMNS = 4
const TILE_MIN_COLUMNS = 18
const TILE_ROWS = 3
/** Rows the pane's title banner takes: its rule row alone. The blank row below comes from the pane itself. */
export const BANNER_ROWS = 1
/** Dashes in each side of the title rule, more than any pane is wide; the box clips them. */
const RULE_LENGTH = 400
/** Columns of the side of the rule that does not grow. */
const RULE_STUB = 2

export const isFramed = (columns: number): boolean => columns >= FRAME_MIN_COLUMNS

/** How wide each tile is and how many rows the tiles take once they wrap to the pane's width. */
export function tileLayout(count: number, columns: number): { width: number; rows: number } {
  if (count === 0) return { width: columns, rows: 0 }
  const perRow = Math.min(count, Math.max(1, Math.floor(columns / TILE_MIN_COLUMNS)))

  return { width: Math.floor(columns / perRow), rows: Math.ceil(count / perRow) * TILE_ROWS }
}

/** Framed cards and KPI tiles drawn with the surface's own `Box` and `Text`; the frame lights under the pointer. */
export function widgets({ Box, Text }: Widgets, isTerminal = true) {
  const card = (key: string, isOpen: boolean, children: RenderChildren) => (
    <Box
      key={`card:${key}`}
      flexDirection="column"
      borderStyle="round"
      borderColor="subtle"
      borderDimColor={!isOpen}
      paddingX={1}
      {...(isTerminal ? {} : { marginBottom: 1, paddingY: 1 })}
      hover={{ borderColor: 'claude', borderDimColor: false }}
    >
      {children}
    </Box>
  )

  /** Cells mean nothing outside a terminal: there the tiles take half the row each and wrap by share. */
  const tiles = (data: readonly Tile[], columns: number) => {
    const { width } = tileLayout(data.length, columns)

    return (
      <Box
        flexDirection="row"
        flexWrap="wrap"
        justifyContent={isTerminal ? 'flex-start' : 'space-between'}
        {...(isTerminal ? {} : { marginBottom: 1, rowGap: 1 })}
      >
        {data.map(tile => (
          <Box
            key={`tile:${tile.key}`}
            width={isTerminal ? width : '49%'}
            // bodyColumns is a little narrower than the row: the width sets the wrap and the grow takes up what is left.
            {...(isTerminal ? { flexGrow: 1 } : {})}
            flexDirection="row"
            borderStyle="round"
            borderColor="subtle"
            paddingX={1}
            hover={{ borderColor: 'claude' }}
          >
            <Text bold color={tile.color}>{tile.value}</Text>
            <Text dimColor wrap="truncate-end">{` ${tile.label}`}</Text>
          </Box>
        ))}
      </Box>
    )
  }

  /** One side of the title rule: a row of dashes clipped to the width the box gets, which is the rest of the row when it grows and RULE_STUB columns when it does not. */
  const rule = (key: string, color: string, isGrowing: boolean) => (
    <Box key={key} height={1} overflow="hidden" {...(isGrowing ? { flexGrow: 1 } : { width: RULE_STUB, flexShrink: 0 })}>
      <Text color={color || 'subtle'}>{'─'.repeat(RULE_LENGTH)}</Text>
    </Box>
  )

  /** The pane's custom title on one row between two rules, no margin, the title bold in the title color; align picks the side that grows. */
  const banner = (title: string, color: string, align: TitleAlign) => {
    const [isLeftGrowing, isRightGrowing] = ALIGN_GROW[align]

    return (
      <Box key="pane-title" flexDirection="row">
        {rule('pane-title:left', color, isLeftGrowing)}
        <Box key="pane-title:text" flexShrink={0}>
          <Text bold {...(color === '' ? {} : { color })}>{` ${title} `}</Text>
        </Box>
        {rule('pane-title:right', color, isRightGrowing)}
      </Box>
    )
  }

  return { card, tiles, banner }
}
