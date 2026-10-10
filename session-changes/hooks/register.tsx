import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { FileChange, InlineDiff } from '../types'

import { gitStatus } from './git'
import type { Host } from './host'
import { fileIcon, folderIcon, STATUS } from './icons'
import type { IconSet } from './icons'
import { SHELLS, track } from './track'
import { buildTree, flatten } from './tree'
import type { Row } from './tree'
import { openDiff } from './viewer'
import type { Viewer } from './viewer'

const files = atom({ plugin: 'session-changes', key: 'files' } as const, {} as Record<string, FileChange>)
const collapsed = atom({ plugin: 'session-changes', key: 'collapsed' } as const, [] as string[])
const inline = atom({ plugin: 'session-changes', key: 'inline' } as const, null as InlineDiff | null)

const PANE = 'session-changes'
const TITLE = 'Alterações da sessão'

const toggle = (list: readonly string[], key: string): string[] =>
  list.includes(key) ? list.filter(one => one !== key) : [...list, key]

function summary(changes: readonly FileChange[]): string {
  const count = (status: FileChange['status']) => changes.filter(one => one.status === status).length

  return (['created', 'modified', 'deleted'] as const).map(s => `${STATUS[s].glyph} ${count(s)}`).join('  ')
}

function hostOf($: EngineInterface): Host {
  return {
    run: (argv, cwd) => $.process.run(argv, cwd === undefined ? undefined : { cwd }),
    spawn: argv => $.process.spawn({ argv }),
    readFile: path => $.fs.read(path),
    writeFile: (path, text) => $.fs.write(path, text),
    exists: path => $.fs.exists(path),
    env: async () => ({ temp: await $.env.get('TEMP'), tmpdir: await $.env.get('TMPDIR'), os: await $.env.get('OS') }),
    sessionId: () => $.session.id(),
    cwd: () => $.session.cwd(),
    toast: text => $.ui.toast(text),
    files: () => read($, files),
    updateFiles: async fn => void (await update($, files, all => fn(all ?? {}))),
    showInline: async diff => void (await update($, inline, () => diff)),
  }
}

/** A folder folds or unfolds; a file opens its diff. */
async function press($: EngineInterface, row: Row, viewer: Viewer): Promise<void> {
  try {
    if (row.isDir) await update($, collapsed, list => toggle(list ?? [], row.key))
    else if (row.change) await openDiff(hostOf($), row.change, viewer)
  } catch (error) {
    $.ui.toast(`session-changes: ${String(error)}`)
  }
}

export const register: Register = (on, options) => {
  const viewer = (options.viewer as Viewer | undefined) ?? 'auto'
  const icons = (options.icons as IconSet | undefined) ?? 'unicode'

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'changes',
      description: 'Mostra os arquivos criados, alterados e excluídos nesta sessão; Enter ou clique abre o diff',
    })

    return next(e)
  })

  on('command.run', { command: 'changes' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE, focus: true })

    return { text: 'Painel de alterações aberto.' }
  })

  on('tool.call', async ($, e, next) => {
    const isShell = (SHELLS as readonly string[]).includes(e.tool)
    const before = isShell ? await gitStatus(hostOf($)).catch(() => undefined) : undefined
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError)
      await track(hostOf($), e.tool, ran.result, before).catch(error => $.ui.toast(`session-changes: ${String(error)}`))

    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const changes = Object.values(await read($, files))
    const shut = new Set(await read($, collapsed))
    const diff = await read($, inline)
    const rows = flatten(buildTree(await $.session.cwd(), changes), shut)
    const room = Math.max(3, (e.viewport?.rows ?? 30) - (diff ? 16 : 6))

    const line = (row: Row) => {
      const status = row.change ? STATUS[row.change.status] : undefined

      return (
        <Box flexDirection="row">
          <Text dimColor>{row.guide}</Text>
          <Button plain key={`${row.isDir ? 'd' : 'f'}:${row.key}`} onPress={() => void press($, row, viewer)}>
            {row.isDir || !status || !row.change
              ? [
                  <Text color="suggestion">{folderIcon(icons, row.isOpen)}</Text>,
                  ` ${row.name}`,
                  <Text dimColor>{row.isOpen ? '' : `  ${row.fileCount}`}</Text>,
                ]
              : [
                  <Text color={status.color}>{fileIcon(icons, row.name, row.change.status)}</Text>,
                  ' ',
                  <Text strikethrough={row.change.status === 'deleted'} dimColor={row.change.status === 'deleted'}>
                    {row.name}
                  </Text>,
                  <Text color={status.color}>{`  ${status.letter}`}</Text>,
                ]}
          </Button>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold>{`${changes.length} arquivo${changes.length === 1 ? '' : 's'}`}</Text>
          <Text>{summary(changes)}</Text>
        </Box>
        {rows.length === 0 && <Text dimColor>Nenhum arquivo alterado nesta sessão ainda.</Text>}
        {rows.slice(0, room).map(line)}
        {rows.length > room && <Text dimColor>{`… mais ${rows.length - room} linhas`}</Text>}
        {diff && (
          <Box flexDirection="column" marginTop={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text bold>{diff.path}</Text>
              <Button key="close-diff" plain onPress={() => void update($, inline, () => null)}>
                ✕ fechar diff
              </Button>
            </Box>
            {diff.source ? <Code format="diff" path={diff.path} source={diff.source} /> : <Text dimColor>Sem diferenças.</Text>}
          </Box>
        )}
        <Box flexDirection="row" marginTop={1} gap={2}>
          <Button key="collapse" hotkey="c" onPress={() => void update($, collapsed, () => rows.filter(r => r.isDir).map(r => r.key))}>
            recolher
          </Button>
          <Button key="expand" hotkey="e" onPress={() => void update($, collapsed, () => [])}>
            expandir
          </Button>
          <Button key="clear" hotkey="l" onPress={() => void update($, files, () => ({}))}>
            limpar
          </Button>
        </Box>
        <Text dimColor>Clique ou Enter num arquivo abre o diff · numa pasta, recolhe/expande</Text>
      </Box>
    )
  })
}
