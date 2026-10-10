import type { FileChange } from '../types'

import { relativeTo } from './paths'

type TreeNode = { name: string; key: string; children: Map<string, TreeNode>; change?: FileChange }

export type Row = {
  key: string
  guide: string
  name: string
  isDir: boolean
  isOpen: boolean
  fileCount: number
  change?: FileChange
}

const node = (name: string, key: string): TreeNode => ({ name, key, children: new Map() })

export function buildTree(cwd: string, changes: readonly FileChange[]): TreeNode {
  const root = node('', '')
  for (const change of changes) {
    const parts = relativeTo(cwd, change.path).split('/').filter(Boolean)
    let at = root
    parts.forEach((part, i) => {
      const key = at.key ? `${at.key}/${part}` : part
      const child = at.children.get(part) ?? node(part, key)
      at.children.set(part, child)
      if (i === parts.length - 1) child.change = change
      at = child
    })
  }

  return compress(root)
}

/** Folds a chain of single-child directories into one row: `src/app/ui`. */
function compress(dir: TreeNode): TreeNode {
  for (const [name, child] of dir.children) dir.children.set(name, compress(child))
  const [only] = dir.children.values()
  const isChain = dir.key !== '' && dir.children.size === 1 && only !== undefined && only.change === undefined
  if (!isChain || only === undefined) return dir

  return { ...only, name: `${dir.name}/${only.name}` }
}

const countFiles = (n: TreeNode): number =>
  n.change ? 1 : [...n.children.values()].reduce((sum, child) => sum + countFiles(child), 0)

const sorted = (n: TreeNode): TreeNode[] =>
  [...n.children.values()].sort((a, b) => {
    const byKind = Number(a.change !== undefined) - Number(b.change !== undefined)

    return byKind || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })

/** The rows to draw, directories first, with the guide lines that lead to each. */
export function flatten(root: TreeNode, collapsed: ReadonlySet<string>): Row[] {
  const rows: Row[] = []
  const walk = (dir: TreeNode, prefix: string): void => {
    const kids = sorted(dir)
    kids.forEach((kid, i) => {
      const isLast = i === kids.length - 1
      const isDir = kid.change === undefined
      const isOpen = isDir && !collapsed.has(kid.key)
      const guide = prefix + (isLast ? '└─ ' : '├─ ')
      rows.push({ key: kid.key, guide, name: kid.name, isDir, isOpen, fileCount: countFiles(kid), change: kid.change })
      if (isOpen) walk(kid, prefix + (isLast ? '   ' : '│  '))
    })
  }
  walk(root, '')

  return rows
}
