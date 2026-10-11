import type { Color, Elements, RenderChildren } from 'claude-code'

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

export const isFramed = (columns: number): boolean => columns >= FRAME_MIN_COLUMNS

/** How wide each tile is and how many rows the tiles take once they wrap to the pane's width. */
export function tileLayout(count: number, columns: number): { width: number; rows: number } {
  if (count === 0) return { width: columns, rows: 0 }
  const perRow = Math.min(count, Math.max(1, Math.floor(columns / TILE_MIN_COLUMNS)))

  return { width: Math.floor(columns / perRow), rows: Math.ceil(count / perRow) * TILE_ROWS }
}

/** Framed cards and KPI tiles drawn with the surface's own `Box` and `Text`; the frame lights under the pointer. */
export function widgets({ Box, Text }: Widgets) {
  const card = (key: string, isOpen: boolean, children: RenderChildren) => (
    <Box
      key={`card:${key}`}
      flexDirection="column"
      borderStyle="round"
      borderColor="subtle"
      borderDimColor={!isOpen}
      paddingX={1}
      hover={{ borderColor: 'claude', borderDimColor: false }}
    >
      {children}
    </Box>
  )

  const tiles = (data: readonly Tile[], columns: number) => {
    const { width } = tileLayout(data.length, columns)

    return (
      <Box flexDirection="row" flexWrap="wrap">
        {data.map(tile => (
          <Box
            key={`tile:${tile.key}`}
            width={width}
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

  return { card, tiles }
}
