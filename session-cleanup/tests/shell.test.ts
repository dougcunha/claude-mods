import { expect, test } from 'claude-code/testing'

import { shellTargets } from '../hooks/shell'
import type { ShellContext } from '../hooks/shell'

const VARS: Record<string, string> = { TEMP: 'C:/Users/me/AppData/Local/Temp', HOME: '/home/me' }

const bash: ShellContext = { kind: 'bash', cwd: '/repo', home: '/home/me', isWindows: false, env: name => VARS[name.toUpperCase()] }
const pwsh: ShellContext = { kind: 'powershell', cwd: 'D:/repo', home: 'C:/Users/me', isWindows: true, env: name => VARS[name.toUpperCase()] }

const paths = (command: string, context: ShellContext): string[] => shellTargets(command, context).map(target => target.path)

test('a redirect names its target; a null device and a descriptor copy name none', () => {
  expect(paths('echo hi > out.txt 2>&1', bash)).toEqual(['/repo/out.txt'])
  expect(paths('ls >> /tmp/list.log 2>/dev/null', bash)).toEqual(['/tmp/list.log'])
  expect(paths('dir > $null', pwsh)).toEqual([])
})

test('touch, mkdir and tee name their operands; mkdir marks a folder', () => {
  expect(shellTargets('mkdir -p build/tmp && touch build/tmp/a.txt', bash)).toEqual([
    { path: '/repo/build/tmp', isFolder: true },
    { path: '/repo/build/tmp/a.txt', isFolder: false },
  ])
  expect(paths('make | tee -a make.log', bash)).toEqual(['/repo/make.log'])
})

test('a cd earlier in the command moves where relative paths land', () => {
  expect(paths('cd /tmp && echo x > scratch.txt', bash)).toEqual(['/tmp/scratch.txt'])
  expect(paths('cd ~ ; touch notes.md', bash)).toEqual(['/home/me/notes.md'])
})

test('PowerShell cmdlets: Set-Content, Out-File, New-Item with a folder type, and positional paths', () => {
  expect(paths('Set-Content -Path "$env:TEMP\\probe.txt" -Value "x"', pwsh)).toEqual(['C:/Users/me/AppData/Local/Temp/probe.txt'])
  expect(paths("Get-Process | Out-File procs.txt -Encoding utf8", pwsh)).toEqual(['D:/repo/procs.txt'])
  expect(shellTargets('New-Item -ItemType Directory -Path .\\tmp-out -Force', pwsh)).toEqual([{ path: 'D:/repo/tmp-out', isFolder: true }])
  expect(paths("Set-Content 'C:\\work\\it''s.txt' 'x'", pwsh)).toEqual(["C:/work/it's.txt"])
})

test('a copy names its destination with the sources, so a folder destination can be resolved later', () => {
  expect(shellTargets('cp a.txt b.txt /tmp/', bash)).toEqual([{ path: '/tmp', isFolder: false, sources: ['/repo/a.txt', '/repo/b.txt'] }])
  expect(shellTargets('Copy-Item -Path x.log -Destination C:\\backup', pwsh)).toEqual([{ path: 'C:/backup', isFolder: false, sources: ['D:/repo/x.log'] }])
})

test('downloads, clones and virtual environments name what they write', () => {
  expect(paths('curl -sL https://example.com/a.zip -o a.zip', bash)).toEqual(['/repo/a.zip'])
  expect(paths('Invoke-WebRequest https://example.com -OutFile page.html', pwsh)).toEqual(['D:/repo/page.html'])
  expect(shellTargets('git clone https://github.com/o/tool.git', bash)).toEqual([{ path: '/repo/tool', isFolder: true }])
  expect(shellTargets('python -m venv .venv', bash)).toEqual([{ path: '/repo/.venv', isFolder: true }])
})

test('a path with an unknown variable, a substitution or a glob is skipped', () => {
  expect(paths('echo x > $UNKNOWN/a.txt', bash)).toEqual([])
  expect(paths('echo x > "$(mktemp)"', bash)).toEqual([])
  expect(paths('touch *.txt', bash)).toEqual([])
  expect(paths("echo x > '$HOME/lit.txt'", bash)).toEqual(['/repo/$HOME/lit.txt'])
})

test('a Git Bash drive path reads as a Windows drive path', () => {
  expect(paths('touch /c/Users/me/x.tmp', { ...bash, isWindows: true })).toEqual(['C:/Users/me/x.tmp'])
})
