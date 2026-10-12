import type { FileChange } from '../types'

import { relativeTo } from './paths'

type TreeNode<T> = { name: string; key: string; children: Map<string, TreeNode<T>>; change?: T }

export type Row<T = FileChange> = {
  key: string
  guide: string
  name: string
  isDir: boolean
  isOpen: boolean
  fileCount: number
  change?: T
}

const node = <T>(name: string, key: string): TreeNode<T> => ({ name, key, children: new Map() })

/** The tree of the files under `base`; a path outside it keeps its absolute form. */
export function buildTree<T extends { path: string }>(base: string, changes: readonly T[]): TreeNode<T> {
  const root = node<T>('', '')
  for (const change of changes) {
    const parts = relativeTo(base, change.path).split('/').filter(Boolean)
    let at = root
    parts.forEach((part, i) => {
      const key = at.key ? `${at.key}/${part}` : part
      const child = at.children.get(part) ?? node<T>(part, key)
      at.children.set(part, child)
      if (i === parts.length - 1) child.change = change
      at = child
    })
  }

  return compress(root)
}

/** Folds a chain of single-child directories into one row: `src/app/ui`. */
function compress<T>(dir: TreeNode<T>): TreeNode<T> {
  for (const [name, child] of dir.children) dir.children.set(name, compress(child))
  const [only] = dir.children.values()
  const isChain = dir.key !== '' && dir.children.size === 1 && only !== undefined && only.change === undefined
  if (!isChain || only === undefined) return dir

  return { ...only, name: `${dir.name}/${only.name}` }
}

const countFiles = <T>(n: TreeNode<T>): number =>
  n.change ? 1 : [...n.children.values()].reduce((sum, child) => sum + countFiles(child), 0)

const sorted = <T>(n: TreeNode<T>): TreeNode<T>[] =>
  [...n.children.values()].sort((a, b) => {
    const byKind = Number(a.change !== undefined) - Number(b.change !== undefined)

    return byKind || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })

/** The rows to draw, directories first, with the guide lines that lead to each. */
export function flatten<T>(root: TreeNode<T>, collapsed: ReadonlySet<string>): Row<T>[] {
  const rows: Row<T>[] = []
  const walk = (dir: TreeNode<T>, prefix: string): void => {
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
