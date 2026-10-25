import type { Elements } from 'claude-code'

import type { Feature } from '../types'

import { glyphColumns, styleOf } from './icons'
import type { IconSet } from './icons'
import { countOf, filledCells, fitTitle, METER_CELLS, STALE_MARKER, stageText } from './progress'
import { meter } from './meter'

type Parts = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

/** The space between the parts of the band. */
const SEPARATOR = '  '

/** The fewest title columns the band keeps before it drops the meter. */
const MIN_TITLE_COLUMNS = 12

/** What the band draws: the open feature updated last, whether it is stale, the band's width, the icon set, and what a press does. */
export type BandProps = { feature: Feature; isStale: boolean; columns: number; icons: IconSet; onOpen: () => void }

/** One line: glyph, title cut to fit, the stage as a chip, a meter, the count and the stale marker; the meter goes first, then the title shortens (NFR-05). */
export function bandLine({ Box, Text, Button }: Parts, { feature, isStale, columns, icons, onOpen }: BandProps) {
  const style = styleOf(feature.state, icons)
  const { done, total } = countOf(feature)
  const chip = ` ${stageText(feature)} `
  const count = ` ${done}/${total}`
  const stale = isStale ? `${SEPARATOR}${STALE_MARKER}` : ''
  const fixed = glyphColumns(icons) + 1 + SEPARATOR.length + [...chip].length + SEPARATOR.length + count.length + [...stale].length
  const hasMeter = columns - fixed - METER_CELLS >= MIN_TITLE_COLUMNS
  const title = fitTitle(feature.title, columns - fixed - (hasMeter ? METER_CELLS : 0))

  return (
    <Box key="feature-progress-band" flexDirection="row">
      <Button plain key="feature-progress-open" onPress={onOpen}>
        <Text color={style.color}>{`${style.glyph} `}</Text>
        <Text bold>{title}</Text>
        <Text>{SEPARATOR}</Text>
        <Text bold color="inverseText" backgroundColor={style.color}>{chip}</Text>
        <Text>{SEPARATOR}</Text>
        {hasMeter ? meter(Text, filledCells(done, total, METER_CELLS), METER_CELLS) : null}
        <Text bold>{count}</Text>
        {isStale ? <Text color="warning">{stale}</Text> : null}
      </Button>
    </Box>
  )
}
