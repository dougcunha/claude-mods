// The review page: draws the view model the mod builds (DEC-07); it calculates nothing the view model already holds.
// A classic script, not an ES module, so the static page can load it over file:// (DEC-06).
;(function () {
  'use strict'

  var VIEW_VERSION = 1
  /** The SVG namespace, read from the page's own SVG element. */
  var SVG = document.getElementById('edges').namespaceURI
  /** The header row of a container, and the room ELK leaves for it above the children. */
  var HEAD_HEIGHT = 32
  var HEAD_WIDTH = 220
  var BADGES = { added: '+', modified: '~', deleted: '−', context: 'ctx', dropped: '−', unchanged: '=', removed: '−' }
  var LAYOUT = {
    'elk.algorithm': 'layered',
    'elk.direction': 'DOWN',
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.edgeLabels.placement': 'CENTER',
    'elk.spacing.nodeNode': '28',
    'elk.layered.spacing.nodeNodeBetweenLayers': '48',
    'elk.spacing.edgeLabel': '4',
  }
  var CONTAINER_PADDING = '[top=' + (HEAD_HEIGHT + 12) + ',left=12,bottom=12,right=12]'

  var token = new URLSearchParams(location.search).get('t') || ''
  var elk = new ELK()
  var page = { view: null, filter: 'both', closed: {}, drawing: 0, comments: [], awaitingRound: null }

  function el(tag, className, text) {
    var node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
  }

  function svg(tag, attributes) {
    var node = document.createElementNS(SVG, tag)
    Object.keys(attributes).forEach(function (name) {
      node.setAttribute(name, attributes[name])
    })
    return node
  }

  function setStatus(text, isError) {
    var status = document.getElementById('status')
    status.textContent = text
    status.classList.toggle('is-error', Boolean(isError))
  }

  /** A state badge: the glyph shows the state without color, and the label names it for a screen reader. */
  function badge(state) {
    var node = el('span', 'badge is-' + state, BADGES[state] || state)
    node.setAttribute('title', state)
    node.setAttribute('aria-label', state)
    return node
  }

  function heading(state, name, kind) {
    var head = el('h3')
    head.appendChild(badge(state))
    head.appendChild(el('span', 'name', name))
    head.appendChild(el('span', 'kind', kind))
    return head
  }

  function metric(list, text, className) {
    var item = el('li', className, text)
    list.appendChild(item)
    return item
  }

  function unitCard(unit) {
    var card = el('div', 'card is-' + unit.state)
    card.tabIndex = 0
    card.setAttribute('role', 'group')
    card.setAttribute('aria-label', unit.kind + ' ' + unit.name + ', ' + unit.state)
    card.dataset.anchor = 'unit'
    card.dataset.id = unit.id
    card.dataset.focus = 'u:' + unit.id
    card.appendChild(heading(unit.state, unit.name, unit.kind))
    if (unit.state === 'context') return card

    var metrics = el('ul', 'metrics')
    if (unit.lines !== null) metric(metrics, unit.lines + ' lines')
    if (unit.added !== null && unit.state !== 'deleted') metric(metrics, '+' + unit.added, 'plus')
    if (unit.removed !== null && unit.state !== 'added') metric(metrics, '−' + unit.removed, 'minus')
    if (unit.added === null) metric(metrics, 'delta unknown')
    if (unit.methods !== null) metric(metrics, unit.methods + (unit.methods === 1 ? ' method' : ' methods'))
    if (unit.cohesion) {
      var cohesion = metric(metrics, 'C ' + unit.cohesion.score, 'cohesion')
      cohesion.setAttribute('title', unit.cohesion.reason)
      cohesion.setAttribute('aria-label', 'Cohesion ' + unit.cohesion.score + ' of 5: ' + unit.cohesion.reason)
    }
    metric(metrics, 'Ce ' + unit.ce).setAttribute('title', 'Efferent coupling: the units it depends on')
    metric(metrics, 'Ca ' + unit.ca).setAttribute('title', 'Afferent coupling: the units that depend on it')
    card.appendChild(metrics)
    if (unit.summary) card.appendChild(el('p', 'summary', unit.summary))
    if (unit.members.length > 0) {
      var members = el('ul', 'members')
      members.setAttribute('aria-label', 'Changed members')
      unit.members.forEach(function (member) {
        var item = el('li')
        item.dataset.anchor = 'member'
        item.tabIndex = 0
        item.dataset.id = unit.id + '#' + member.id
        item.appendChild(badge(member.state))
        item.appendChild(el('span', '', member.name + (member.kind === 'method' || member.kind === 'constructor' ? '()' : '')))
        members.appendChild(item)
      })
      card.appendChild(members)
    }
    if (!unit.isRangeChecked) card.appendChild(el('p', 'note', 'Range not checked: the file was too large or missing.'))
    return card
  }

  function tableCard(table) {
    var card = el('div', 'card is-' + table.state)
    card.tabIndex = 0
    card.setAttribute('role', 'group')
    card.setAttribute('aria-label', 'Table ' + table.id + ', ' + table.state)
    card.dataset.anchor = 'table'
    card.dataset.id = table.id
    card.dataset.focus = 't:' + table.id
    card.appendChild(heading(table.state, table.id, 'table'))
    var columns = el('ul', 'columns')
    table.columns.forEach(function (column) {
      var item = el('li')
      item.dataset.anchor = 'column'
      item.tabIndex = 0
      item.dataset.id = table.id + '.' + column.name
      item.appendChild(badge(column.state))
      var type = column.baseType && column.baseType !== column.type ? column.baseType + ' → ' + column.type : column.type
      var text = column.name + ' ' + type + (column.isPrimaryKey ? ' PK' : '') + (column.references ? ' → ' + column.references : '')
      item.appendChild(el('span', '', text))
      columns.appendChild(item)
    })
    card.appendChild(columns)
    card.appendChild(el('p', 'note', table.source))
    return card
  }

  function containerHead(container, units) {
    var isClosed = isContainerClosed(container)
    var button = el('button', 'container-head', (isClosed ? '▸ ' : '▾ ') + container.id + ' (' + units.length + ')')
    button.type = 'button'
    button.setAttribute('aria-expanded', String(!isClosed))
    button.dataset.focus = 'c:' + container.id
    button.addEventListener('click', function () {
      page.closed[container.id] = !isContainerClosed(container)
      draw()
    })
    return button
  }

  function isContainerClosed(container) {
    return Object.prototype.hasOwnProperty.call(page.closed, container.id) ? page.closed[container.id] : container.isClosed
  }

  /** Puts each card in the canvas off-screen, so its size is known before the layout. */
  function measure(node, canvas) {
    node.classList.add('is-measuring')
    canvas.appendChild(node)
    return { width: node.offsetWidth, height: node.offsetHeight }
  }

  function labelText(relation) {
    return relation.kind + ' · ' + relation.state
  }

  /** The label of 1 relation: a comment anchor, with its state in the text. */
  function relationLabel(relation) {
    var label = el('button', 'edge-label badge is-' + relation.state, labelText(relation))
    label.dataset.anchor = 'relation'
    label.dataset.id = relation.id
    label.setAttribute('aria-label', relation.kind + ' from ' + relation.from + ' to ' + relation.to + ', ' + relation.state)
    return label
  }

  /**
   * The label of an arrow that stands for several relations into or out of a closed container: the count of each state
   * in the text, and no comment anchor, because a comment belongs to 1 relation (FR-18).
   */
  function mergedLabel(edge) {
    var counts = {}
    edge.relations.forEach(function (relation) {
      counts[relation.state] = (counts[relation.state] || 0) + 1
    })
    var states = ['added', 'removed', 'unchanged']
      .filter(function (state) {
        return counts[state]
      })
      .map(function (state) {
        return BADGES[state] + counts[state]
      })
    var label = el('button', 'edge-label badge', edge.relation.kind + ' · ' + edge.relations.length + ' relations (' + states.join(' ') + ')')
    var names = edge.relations.map(function (relation) {
      return relation.from + ' to ' + relation.to + ', ' + relation.state
    })
    label.setAttribute('aria-label', edge.relations.length + ' ' + edge.relation.kind + ' relations: ' + names.join('; ') + '. Open the container to comment on one.')
    label.setAttribute('title', 'Open the container to comment on one relation.')
    return label
  }

  /** The ELK graph of what the filter shows: containers with their units, the table group, relations and entity links. */
  function graphOf(view, canvas, parts) {
    var showUnits = page.filter !== 'tables'
    var showTables = page.filter !== 'units'
    var root = { id: 'root', layoutOptions: LAYOUT, children: [], edges: [] }
    var nodeOf = {}
    var units = {}
    view.units.forEach(function (unit) {
      units[unit.id] = unit
    })

    if (showUnits)
      view.containers.forEach(function (container) {
        var members = container.units.map(function (id) {
          return units[id]
        })
        var head = containerHead(container, members)
        // The header goes in before its cards, so the Tab order is a container, then its cards.
        measure(head, canvas)
        parts.heads.push({ id: 'c:' + container.id, node: head })
        if (isContainerClosed(container)) {
          root.children.push({ id: 'c:' + container.id, width: HEAD_WIDTH, height: HEAD_HEIGHT })
          members.forEach(function (unit) {
            nodeOf[unit.id] = 'c:' + container.id
          })
          return
        }
        var group = { id: 'c:' + container.id, layoutOptions: { 'elk.padding': CONTAINER_PADDING }, children: [] }
        members.forEach(function (unit) {
          var card = unitCard(unit)
          var size = measure(card, canvas)
          parts.cards.push({ id: 'u:' + unit.id, node: card })
          group.children.push({ id: 'u:' + unit.id, width: size.width, height: size.height })
          nodeOf[unit.id] = 'u:' + unit.id
        })
        root.children.push(group)
      })

    if (showTables && view.tables.length > 0) {
      var tables = { id: 'g:tables', layoutOptions: { 'elk.padding': CONTAINER_PADDING }, children: [] }
      var head = el('div', 'container-head', 'Database tables (' + view.tables.length + ')')
      measure(head, canvas)
      parts.heads.push({ id: 'g:tables', node: head })
      view.tables.forEach(function (table) {
        var card = tableCard(table)
        var size = measure(card, canvas)
        parts.cards.push({ id: 't:' + table.id, node: card })
        tables.children.push({ id: 't:' + table.id, width: size.width, height: size.height })
      })
      root.children.push(tables)
    }

    if (showUnits) {
      // A relation to a unit in a closed container goes to the container; the ones that meet there merge into 1 arrow.
      var merged = {}
      view.relations.forEach(function (relation) {
        var from = nodeOf[relation.from]
        var to = nodeOf[relation.to]
        if (!from || !to || from === to) return
        var key = from + '>' + to + '>' + relation.kind
        if (merged[key]) {
          merged[key].relations.push(relation)
          return
        }
        merged[key] = { id: 'e:' + relation.id, from: from, to: to, relation: relation, relations: [relation] }
      })
      Object.keys(merged).forEach(function (key) {
        var edge = merged[key]
        var isMerged = edge.relations.length > 1
        var label = isMerged ? mergedLabel(edge) : relationLabel(edge.relation)
        label.type = 'button'
        label.dataset.focus = edge.id
        var size = measure(label, canvas)
        // A merged arrow stands for relations of several states, so its line takes no state style of its own.
        var shown = isMerged ? { kind: edge.relation.kind, state: 'merged' } : edge.relation
        parts.edges.push({ id: edge.id, relation: shown, label: label })
        var text = label.textContent
        root.edges.push({ id: edge.id, sources: [edge.from], targets: [edge.to], labels: [{ id: edge.id + ':label', text: text, width: size.width, height: size.height }] })
      })
    }

    if (showUnits && showTables)
      view.links.forEach(function (link) {
        var from = nodeOf[link.unit]
        if (!from || !view.tables.some(function (table) { return table.id === link.table })) return
        parts.edges.push({ id: 'l:' + link.id, isLink: true })
        root.edges.push({ id: 'l:' + link.id, sources: [from], targets: ['t:' + link.table] })
      })

    return root
  }

  function markers(layer) {
    var defs = svg('defs', {})
    var shapes = {
      triangle: { path: 'M0,0 L12,6 L0,12 z', fill: 'var(--bg)' },
      arrow: { path: 'M0,0 L12,6 L0,12', fill: 'none' },
      diamond: { path: 'M0,6 L6,0 L12,6 L6,12 z', fill: 'currentColor' },
    }
    Object.keys(shapes).forEach(function (name) {
      var marker = svg('marker', { id: 'm-' + name, viewBox: '0 0 12 12', refX: name === 'diamond' ? '0' : '12', refY: '6', markerWidth: '10', markerHeight: '10', orient: 'auto-start-reverse' })
      marker.appendChild(svg('path', { d: shapes[name].path, fill: shapes[name].fill, stroke: 'context-stroke', 'stroke-width': '1.5' }))
      defs.appendChild(marker)
    })
    layer.appendChild(defs)
  }

  /** The SVG path of an edge; ELK gives its points relative to the edge's container, at `offset` in the canvas. */
  function pathOf(edge, offset) {
    return (edge.sections || [])
      .map(function (section) {
        var points = [section.startPoint].concat(section.bendPoints || [], [section.endPoint])
        return points
          .map(function (point, index) {
            return (index === 0 ? 'M' : 'L') + (point.x + offset.x) + ',' + (point.y + offset.y)
          })
          .join(' ')
      })
      .join(' ')
  }

  function place(node, box) {
    node.style.left = box.x + 'px'
    node.style.top = box.y + 'px'
    node.classList.remove('is-measuring')
  }

  /**
   * Walks the laid-out graph. ELK gives a node's position relative to its parent and an edge's points relative to its
   * container, so the walk adds up the offsets to place each one in the canvas.
   */
  function render(laid, parts, canvas, layer) {
    var boxes = {}
    var edgesOf = {}
    ;(function walk(node, x, y) {
      boxes[node.id] = { x: x + (node.x || 0), y: y + (node.y || 0), width: node.width, height: node.height, children: node.children }
      ;(node.edges || []).forEach(function (edge) {
        edgesOf[edge.id] = edge
      })
      ;(node.children || []).forEach(function (child) {
        walk(child, boxes[node.id].x, boxes[node.id].y)
      })
    })(laid, 0, 0)
    canvas.style.width = laid.width + 'px'
    canvas.style.height = laid.height + 'px'
    layer.setAttribute('width', String(laid.width))
    layer.setAttribute('height', String(laid.height))
    markers(layer)

    parts.heads.forEach(function (head) {
      var box = boxes[head.id]
      var isGroup = Boolean(box.children && box.children.length)
      if (isGroup || head.id === 'g:tables')
        layer.appendChild(svg('rect', { class: 'container-box' + (head.id === 'g:tables' ? ' is-tables' : ''), x: box.x, y: box.y, width: box.width, height: box.height, rx: '8' }))
      head.node.style.width = Math.min(box.width - 8, 400) + 'px'
      place(head.node, { x: box.x + 4, y: box.y + 4 })
    })
    parts.cards.forEach(function (card) {
      place(card.node, boxes[card.id])
    })
    parts.edges.forEach(function (part) {
      var edge = edgesOf[part.id]
      if (!edge) return
      var offset = boxes[edge.container] || boxes.root
      var kind = part.isLink ? 'link' : part.relation.kind
      var attributes = { class: 'edge is-' + kind + (part.isLink ? '' : ' is-' + part.relation.state), d: pathOf(edge, offset) }
      if (kind === 'inheritance' || kind === 'implementation') attributes['marker-end'] = 'url(#m-triangle)'
      if (kind === 'dependency') attributes['marker-end'] = 'url(#m-arrow)'
      if (kind === 'composition') attributes['marker-start'] = 'url(#m-diamond)'
      layer.appendChild(svg('path', attributes))
      var label = (edge.labels || [])[0]
      if (part.label && label) place(part.label, { x: label.x + offset.x, y: label.y + offset.y })
    })
  }

  function showCounts(view) {
    document.getElementById('base').textContent = 'Against ' + view.baseLabel + ' · branch ' + view.branch
    var counts = document.getElementById('counts')
    counts.textContent = ''
    ;[
      ['+', view.counts.units.added, 'units added'],
      ['~', view.counts.units.modified, 'units modified'],
      ['−', view.counts.units.deleted, 'units deleted'],
      ['+', view.counts.tables.added, 'tables added'],
      ['~', view.counts.tables.modified, 'tables modified'],
      ['−', view.counts.tables.dropped, 'tables dropped'],
    ].forEach(function (row) {
      counts.appendChild(el('li', '', row[0] + ' ' + row[1] + ' ' + row[2]))
    })
  }

  function showOtherFiles(view) {
    var section = document.getElementById('other')
    var list = document.getElementById('other-list')
    list.textContent = ''
    section.hidden = view.otherFiles.length === 0
    view.otherFiles.forEach(function (file) {
      var counts = file.added === null ? 'binary' : '+' + file.added + ' −' + file.removed
      var rename = file.oldPath ? ' (from ' + file.oldPath + ')' : ''
      list.appendChild(el('li', '', file.path + rename + ' · ' + counts + (file.reason ? ' · ' + file.reason : '')))
    })
  }

  /** Draws the view model again: after a new model, a filter change, or a container toggle. A newer draw wins. */
  function draw() {
    var view = page.view
    if (!view) return
    var drawing = ++page.drawing
    var started = performance.now()
    var canvas = document.getElementById('canvas')
    var layer = document.getElementById('edges')
    // A draw replaces every element, so the focus goes back to the element with the same key.
    var focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.focus : null
    Array.prototype.slice.call(canvas.children).forEach(function (child) {
      if (child !== layer) canvas.removeChild(child)
    })
    layer.textContent = ''
    var parts = { heads: [], cards: [], edges: [] }
    var graph = graphOf(view, canvas, parts)
    elk
      .layout(graph)
      .then(function (laid) {
        if (drawing !== page.drawing) return
        render(laid, parts, canvas, layer)
        renderComments()
        var units = view.units.length
        setStatus('Drew ' + units + (units === 1 ? ' unit' : ' units') + ' and ' + view.tables.length + ' tables in ' + Math.round(performance.now() - started) + ' ms.')
        var again = focused && canvas.querySelector('[data-focus="' + CSS.escape(focused) + '"]')
        if (again) again.focus()
      })
      .catch(function (error) {
        setStatus('The diagram could not be drawn: ' + error.message, true)
      })
  }

  // Comments (FR-18 to FR-23): the page keeps the comment set of the view model, sends the whole set after each change,
  // and the mod stores it; a new view model brings the stored set back, drafts included. The static page (FR-24) has no
  // way back to the mod: it keeps the set in the browser's storage and copies the review text instead of sending it.
  var TYPE_LABELS = { change: 'Change request', question: 'Question' }
  var isServed = !window.VIEW
  var form = { anchor: null, editing: null }
  /** The status each submitted comment had in the view model, to tell which ones the reviewer changed on the static page. */
  var shownStatus = {}

  function anchorLabel(anchor) {
    return anchor.kind === 'review' ? 'The whole review' : anchor.kind + ' ' + anchor.id
  }

  function post(path, body) {
    return fetch(path, { method: 'POST', headers: { 'X-Review-Token': token, 'Content-Type': 'application/json' }, body: body === undefined ? '' : JSON.stringify(body) }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status)
      return response
    })
  }

  /** The browser storage key of the static page's comments: the branch and the base commit of the review. */
  function localKey() {
    return 'visual-review:' + page.view.branch + ':' + page.view.base
  }

  /** The comment set the static page saved, or null; the storage can be off or full, which reads as nothing saved. */
  function readLocal() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(localKey()) || 'null')
      return Array.isArray(saved) ? saved : null
    } catch (error) {
      return null
    }
  }

  function writeLocal(comments) {
    try {
      window.localStorage.setItem(localKey(), JSON.stringify(comments))
      return true
    } catch (error) {
      return false
    }
  }

  /** The view model's comments with the static page's saved drafts and status changes on top, as the mod merges them. */
  function withLocal(comments) {
    var saved = readLocal()
    if (!saved) return comments
    var statusOf = {}
    saved.forEach(function (comment) {
      if (comment.status !== 'draft') statusOf[comment.id] = comment.status
    })
    // A saved draft may name an element the new model lost, so its anchor is checked again (FR-23).
    var anchors = {}
    ;(page.view.anchors || []).forEach(function (key) {
      anchors[key] = true
    })
    return comments
      .filter(function (comment) {
        return comment.status !== 'draft'
      })
      .map(function (comment) {
        return statusOf[comment.id] ? Object.assign({}, comment, { status: statusOf[comment.id] }) : comment
      })
      .concat(
        saved
          .filter(function (comment) {
            return comment.status === 'draft'
          })
          .map(function (comment) {
            if (!page.view.anchors) return comment
            var isAnchored = comment.anchor.kind === 'review' || anchors[comment.anchor.kind + ':' + comment.anchor.id] === true
            return Object.assign({}, comment, { isAnchored: isAnchored })
          }),
      )
  }

  /** Sends the whole comment set; the mod replaces its drafts with it, so a repeated send changes nothing. */
  function saveAll() {
    renderComments()
    var comments = page.comments.map(function (comment) {
      return { id: comment.id, anchor: comment.anchor, type: comment.type, text: comment.text, status: comment.status, round: comment.round, isAnchored: comment.isAnchored }
    })
    if (!isServed) {
      if (!writeLocal(comments)) setStatus('The browser did not keep the comments. Copy the review before you close the page.', true)
      return
    }
    post('/comments', { comments: comments }).catch(function (error) {
      setStatus('The comments were not saved (' + error.message + '). Keep the page open and try again.', true)
    })
  }

  function newId() {
    return window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
  }

  function openForm(anchor, comment) {
    form.anchor = anchor
    form.editing = comment || null
    var node = document.getElementById('form')
    node.hidden = false
    document.getElementById('form-anchor').textContent = (comment ? 'Edit the comment on ' : 'Comment on ') + anchorLabel(anchor)
    document.getElementById('form-text').value = comment ? comment.text : ''
    node.querySelector('input[value="' + (comment ? comment.type : 'change') + '"]').checked = true
    document.getElementById('form-text').focus()
  }

  function closeForm() {
    document.getElementById('form').hidden = true
    form.anchor = null
    form.editing = null
  }

  function commentItem(comment) {
    var item = el('li')
    item.appendChild(el('div', 'meta', TYPE_LABELS[comment.type] + ' · ' + anchorLabel(comment.anchor) + (comment.status === 'draft' ? '' : ' · round ' + comment.round)))
    item.appendChild(el('p', '', comment.text))
    var actions = el('div', 'actions')
    if (comment.status === 'draft') {
      var edit = el('button', '', 'Edit')
      edit.type = 'button'
      edit.addEventListener('click', function () {
        openForm(comment.anchor, comment)
      })
      var remove = el('button', '', 'Delete')
      remove.type = 'button'
      remove.addEventListener('click', function () {
        page.comments = page.comments.filter(function (other) {
          return other.id !== comment.id
        })
        saveAll()
      })
      actions.appendChild(edit)
      actions.appendChild(remove)
    } else {
      var label = el('label', '', 'Status ')
      var select = el('select')
      ;['open', 'resolved'].forEach(function (status) {
        var option = el('option', '', status === 'open' ? 'Open' : 'Resolved')
        option.value = status
        option.selected = comment.status === status
        select.appendChild(option)
      })
      select.addEventListener('change', function () {
        comment.status = select.value
        saveAll()
      })
      label.appendChild(select)
      actions.appendChild(label)
    }
    item.appendChild(actions)
    return item
  }

  /** Fills the panel lists and puts a count next to each anchor that has comments. */
  function renderComments() {
    var lists = { drafts: [], earlier: [], unanchored: [] }
    page.comments.forEach(function (comment) {
      if (comment.isAnchored === false) lists.unanchored.push(comment)
      else lists[comment.status === 'draft' ? 'drafts' : 'earlier'].push(comment)
    })
    Object.keys(lists).forEach(function (name) {
      var list = document.getElementById(name)
      list.textContent = ''
      if (lists[name].length === 0) list.appendChild(el('li', 'meta', name === 'drafts' ? 'No comment yet. Click a card, a member, an arrow label, a table or a column.' : 'None.'))
      lists[name].forEach(function (comment) {
        list.appendChild(commentItem(comment))
      })
    })
    document.getElementById('panel-title').textContent = 'Comments (' + lists.drafts.length + ' new)'
    Array.prototype.slice.call(document.querySelectorAll('.comment-count')).forEach(function (badge) {
      badge.remove()
    })
    var counts = {}
    page.comments.forEach(function (comment) {
      if (comment.anchor.kind === 'review') return
      var key = comment.anchor.kind + '\n' + comment.anchor.id
      counts[key] = (counts[key] || 0) + 1
    })
    Array.prototype.slice.call(document.querySelectorAll('[data-anchor]')).forEach(function (node) {
      var count = counts[node.dataset.anchor + '\n' + node.dataset.id]
      if (!count) return
      var badge = el('span', 'comment-count', String(count))
      badge.setAttribute('aria-label', count + (count === 1 ? ' comment' : ' comments'))
      ;(node.querySelector('h3') || node).appendChild(badge)
    })
  }

  /** The anchor a click or Enter lands on: the innermost element with an anchor (a member before its card). */
  function anchorAt(target) {
    var node = target.closest && target.closest('[data-anchor]')
    return node ? { kind: node.dataset.anchor, id: node.dataset.id } : null
  }

  document.getElementById('canvas').addEventListener('click', function (event) {
    var anchor = anchorAt(event.target)
    if (anchor) openForm(anchor)
  })
  document.getElementById('canvas').addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' || event.target.tagName === 'BUTTON') return
    var anchor = anchorAt(event.target)
    if (!anchor) return
    event.preventDefault()
    openForm(anchor)
  })
  document.getElementById('comment-review').addEventListener('click', function () {
    openForm({ kind: 'review', id: 'review' })
  })
  document.getElementById('form-cancel').addEventListener('click', closeForm)
  document.getElementById('form').addEventListener('submit', function (event) {
    event.preventDefault()
    var text = document.getElementById('form-text').value.trim()
    if (!text || !form.anchor) return
    var type = document.querySelector('#form input[name="type"]:checked').value
    if (form.editing) {
      form.editing.text = text
      form.editing.type = type
    } else {
      page.comments.push({ id: newId(), anchor: form.anchor, type: type, text: text, status: 'draft', round: page.view ? page.view.round : 1, isAnchored: true })
    }
    closeForm()
    saveAll()
  })
  /** Copies text with the clipboard API, else with a selected text box, which a page opened from a file may need. */
  function copyText(text) {
    var fallback = function () {
      var box = el('textarea')
      box.value = text
      document.body.appendChild(box)
      box.select()
      var isCopied = false
      try {
        isCopied = document.execCommand('copy')
      } catch (error) {
        isCopied = false
      }
      box.remove()
      if (!isCopied) throw new Error('the browser did not allow it')
    }
    if (!navigator.clipboard || !navigator.clipboard.writeText) return Promise.resolve().then(fallback)
    return navigator.clipboard.writeText(text).catch(fallback)
  }

  /** The drafts, and the submitted comments whose status changed on this page or in the store since the last submit. */
  function reviewParts() {
    return {
      drafts: page.comments.filter(function (comment) {
        return comment.status === 'draft'
      }),
      changed: page.comments.filter(function (comment) {
        return comment.status !== 'draft' && (comment.isStatusChanged || (shownStatus[comment.id] && comment.status !== shownStatus[comment.id]))
      }),
    }
  }

  /** Copy review (FR-24): the text the server page would send, from the drafts and the status changes of this page. */
  function copyReview(sent) {
    var parts = reviewParts()
    if (parts.drafts.length === 0 && parts.changed.length === 0) {
      sent.textContent = 'The review has no new comment and no status change to copy.'
      return
    }
    copyText(window.reviewText({ baseLabel: page.view.baseLabel, drafts: parts.drafts, changed: parts.changed }))
      .then(function () {
        sent.textContent = 'Review copied. Paste it in the Claude Code prompt.'
      })
      .catch(function (error) {
        sent.textContent = ''
        setStatus('The review was not copied (' + error.message + '). Try again.', true)
      })
  }

  document.getElementById('submit').addEventListener('click', function () {
    var sent = document.getElementById('sent')
    if (!isServed) return copyReview(sent)
    var parts = reviewParts()
    if (parts.drafts.length === 0 && parts.changed.length === 0) {
      sent.textContent = 'The review has no new comment and no status change to send.'
      return
    }
    // The server only hands the review to the mod; the next view model says whether it entered the session (FR-20).
    // Set before the request: the new model can arrive before the request's own answer.
    page.awaitingRound = page.view.round
    post('/submit')
      .then(function () {
        if (page.awaitingRound !== null) sent.textContent = 'Review handed to the session. It enters when Claude is idle.'
      })
      .catch(function (error) {
        page.awaitingRound = null
        sent.textContent = ''
        setStatus('The review was not sent (' + error.message + '). Try again.', true)
      })
  })

  /** After a submit, a new round says the review entered the session, and a notice says why it did not. */
  function showOutcome(view) {
    if (page.awaitingRound === null) return
    var sent = document.getElementById('sent')
    if (view.round > page.awaitingRound) sent.textContent = 'Review sent.'
    else if (view.notice) sent.textContent = view.notice.text
    else return
    page.awaitingRound = null
  }

  function show(view) {
    if (!view || view.version !== VIEW_VERSION) return setStatus('This page cannot read the view model. Run /visual-review again.', true)
    page.view = view
    page.comments = (view.comments || []).map(function (comment) {
      return Object.assign({}, comment)
    })
    shownStatus = {}
    page.comments.forEach(function (comment) {
      shownStatus[comment.id] = comment.status
    })
    if (!isServed) page.comments = withLocal(page.comments)
    showOutcome(view)
    showCounts(view)
    showOtherFiles(view)
    renderComments()
    draw()
  }

  Array.prototype.slice.call(document.querySelectorAll('[data-filter]')).forEach(function (button) {
    button.addEventListener('click', function () {
      page.filter = button.dataset.filter
      Array.prototype.slice.call(document.querySelectorAll('[data-filter]')).forEach(function (other) {
        other.setAttribute('aria-pressed', String(other === button))
      })
      draw()
    })
  })

  // The static page sets window.VIEW before this script; the server page fetches the view model and follows its updates.
  if (window.VIEW) {
    document.getElementById('submit').textContent = 'Copy review'
    return show(window.VIEW)
  }
  fetch('/view', { headers: { 'X-Review-Token': token } })
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status)
      return response.json()
    })
    .then(show)
    .catch(function (error) {
      setStatus('The view model did not load (' + error.message + '). Run /visual-review again.', true)
    })
  var events = new EventSource('/events?t=' + encodeURIComponent(token))
  events.addEventListener('model', function (event) {
    try {
      show(JSON.parse(event.data))
    } catch (error) {
      setStatus('The new view model could not be read. Run /visual-review again.', true)
    }
  })
})()
