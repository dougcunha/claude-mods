// The review text that "Copy review" copies on the static page. It is the text of `reviewPrompt` in hooks/prompts.ts,
// which the server page sends; tests/prompts.test.ts holds the two equal. A classic script with no import or export, so
// the static page loads it over file:// (DEC-06) and a test can import it.
;(function (root) {
  'use strict'

  var TYPE_LABELS = { change: 'Change request', question: 'Question' }
  var ANCHOR_ORDER = ['review', 'unit', 'member', 'relation', 'table', 'column']

  /** Orders text by code unit, the same on every machine. */
  function compareText(a, b) {
    if (a < b) return -1
    return a > b ? 1 : 0
  }

  /** A comment's text as list content: each further line indented, so a line of the text cannot start a new item. */
  function indented(text) {
    return text.trim().split(/\r?\n/).join('\n    ')
  }

  function anchorLine(comment) {
    return comment.anchor.kind === 'review' ? 'The whole review' : comment.anchor.kind + ' ' + comment.anchor.id
  }

  /** The comments by anchor, in anchor kind order, then anchor id, then the order the reviewer wrote them. */
  function byAnchor(comments) {
    var groups = []
    var groupOf = {}
    comments
      .slice()
      .sort(function (a, b) {
        return ANCHOR_ORDER.indexOf(a.anchor.kind) - ANCHOR_ORDER.indexOf(b.anchor.kind) || compareText(a.anchor.id, b.anchor.id)
      })
      .forEach(function (comment) {
        var key = comment.anchor.kind + ' ' + comment.anchor.id
        if (!groupOf[key]) {
          groupOf[key] = []
          groups.push(groupOf[key])
        }
        groupOf[key].push(comment)
      })
    return groups
  }

  /** The review text of `{ baseLabel, drafts, changed }`: the comments of this round by anchor, then the status changes. */
  function reviewText(input) {
    var drafts = input.drafts
    var lines = [
      'visual-review: the person reviewed the design of the change against ' + input.baseLabel + ' and sent ' + drafts.length + (drafts.length === 1 ? ' comment.' : ' comments.'),
      '',
      'Answer each question. For the change requests, propose a plan. Do not change any file until the person confirms the plan.',
    ]
    byAnchor(drafts).forEach(function (group) {
      lines.push('', '## ' + anchorLine(group[0]))
      group.forEach(function (comment) {
        lines.push('- ' + TYPE_LABELS[comment.type] + ': ' + indented(comment.text))
      })
    })
    if (input.changed.length > 0) {
      lines.push('', '## Status changes of earlier comments')
      input.changed.forEach(function (comment) {
        lines.push('- ' + (comment.status === 'resolved' ? 'Resolved' : 'Open again') + ': ' + TYPE_LABELS[comment.type] + ' on ' + anchorLine(comment) + ': ' + indented(comment.text))
      })
    }
    return lines.join('\n')
  }

  root.reviewText = reviewText
})(globalThis)
