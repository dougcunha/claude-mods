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
  /** Overview draws straight arrows between the closed groups: orthogonal routes of many arrows need wide corridors. */
  var OVERVIEW_LAYOUT = Object.assign({}, LAYOUT, { 'elk.edgeRouting': 'POLYLINE', 'elk.spacing.nodeNode': '40', 'elk.layered.spacing.nodeNodeBetweenLayers': '64' })
  var CONTAINER_PADDING = '[top=' + (HEAD_HEIGHT + 12) + ',left=12,bottom=12,right=12]'
  /** The width under which the style sheet puts the panel under the diagram. */
  var NARROW_QUERY = '(max-width: 900px)'

  /** The words of a relation in the list, seen from its source and from its target. */
  var RELATION_WORDS = {
    inheritance: ['extends', 'extended by'],
    implementation: ['implements', 'implemented by'],
    composition: ['owns', 'owned by'],
    dependency: ['uses', 'used by'],
  }
  var ZOOM_MIN = 0.1
  var ZOOM_MAX = 2
  var MODES = ['overview', 'diagram', 'list']
  var MODE_KEY = 'visual-review:mode'

  var token = new URLSearchParams(location.search).get('t') || ''
  var elk = new ELK()
  // closed: the open or closed groups of each mode, by group key. focus: the unit or table key the graph modes show
  // with its neighbors only. size: the laid-out size of the last graph, for Fit.
  var page = {
    view: null,
    filter: 'both',
    mode: 'diagram',
    closed: { overview: {}, diagram: {}, list: {} },
    focus: null,
    zoom: 1,
    size: null,
    zoomAfterDraw: null,
    drawing: 0,
    comments: [],
    awaitingRound: null,
    isScrolled: false,
  }

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

  /** The button that shows a card with its neighbors only; on the card in focus, it shows everything again. */
  function focusButton(key, name) {
    var isFocused = page.focus === key
    var button = el('button', 'focus-button', isFocused ? 'Show all' : 'Focus')
    button.type = 'button'
    button.dataset.focusOn = key
    button.setAttribute('aria-label', isFocused ? 'Show all units and tables' : 'Show ' + name + ' with its neighbors only')
    return button
  }

  /** A unit card or a unit row of the list: the anchor, the heading and, for a changed unit, the body. */
  function unitNode(tag, className, unit) {
    var node = el(tag, className + ' is-' + unit.state)
    node.tabIndex = 0
    // A list row keeps its list item role.
    if (tag === 'div') node.setAttribute('role', 'group')
    node.setAttribute('aria-label', unit.kind + ' ' + unit.name + ', ' + unit.state)
    node.dataset.anchor = 'unit'
    node.dataset.id = unit.id
    node.dataset.focus = 'u:' + unit.id
    node.appendChild(heading(unit.state, unit.name, unit.kind))
    if (unit.state !== 'context') unitBody(unit, node)
    return node
  }

  function unitCard(unit) {
    var card = unitNode('div', 'card', unit)
    if (page.focus === 'u:' + unit.id) card.classList.add('is-focused')
    card.querySelector('h3').appendChild(focusButton('u:' + unit.id, unit.name))
    return card
  }

  function unitBody(unit, card) {
    var metrics = el('ul', 'metrics')
    if (unit.lines !== null) metric(metrics, unit.lines + ' lines')
    if (unit.added !== null && unit.state !== 'deleted') metric(metrics, '+' + unit.added, 'plus')
    if (unit.removed !== null && unit.state !== 'added') metric(metrics, '−' + unit.removed, 'minus')
    if (unit.added === null) metric(metrics, 'delta unknown')
    if (unit.methods !== null) metric(metrics, unit.methods + (unit.methods === 1 ? ' method' : ' methods'))
    // The quality metrics (cohesion, Ce, Ca) take a row of their own under the size metrics.
    if (unit.cohesion) {
      var cohesion = metric(metrics, 'C ' + unit.cohesion.score, 'cohesion quality')
      cohesion.setAttribute('title', unit.cohesion.reason)
      cohesion.setAttribute('aria-label', 'Cohesion ' + unit.cohesion.score + ' of 5: ' + unit.cohesion.reason)
    }
    metric(metrics, 'Ce ' + unit.ce, 'quality').setAttribute('title', 'Efferent coupling: the units it depends on')
    metric(metrics, 'Ca ' + unit.ca, 'quality').setAttribute('title', 'Afferent coupling: the units that depend on it')
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
  }

  /** A table card or a table row of the list: the anchor, the heading, the columns and the source. */
  function tableNode(tag, className, table) {
    var card = el(tag, className + ' is-' + table.state)
    card.tabIndex = 0
    if (tag === 'div') card.setAttribute('role', 'group')
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

  function tableCard(table) {
    var card = tableNode('div', 'card', table)
    if (page.focus === 't:' + table.id) card.classList.add('is-focused')
    card.querySelector('h3').appendChild(focusButton('t:' + table.id, table.id))
    return card
  }

  /**
   * The head of a group (a container or the table group), a button that opens or closes it in the current mode. In
   * focus, every group is open, so the head is only a label.
   */
  function groupHead(key, text, isClosed, className) {
    if (page.focus && page.mode !== 'list') return el('div', 'container-head ' + className, text)
    // The open or closed chevron is drawn by the style sheet from aria-expanded.
    var button = el('button', 'container-head ' + className, text)
    button.type = 'button'
    button.title = text
    button.setAttribute('aria-expanded', String(!isClosed))
    button.dataset.focus = key
    button.addEventListener('click', function () {
      page.closed[page.mode][key] = !isClosed
      draw()
    })
    return button
  }

  /**
   * Whether a group is closed: the reviewer's choice in the current mode, else the mode's default. Overview starts with
   * every group closed, List with every group open, and Diagram with the containers the view model closes.
   */
  function isGroupClosed(key, isClosedInModel) {
    if (page.focus && page.mode !== 'list') return false
    var closed = page.closed[page.mode]
    if (Object.prototype.hasOwnProperty.call(closed, key)) return closed[key]
    if (page.mode === 'overview') return true
    return page.mode === 'list' ? false : isClosedInModel
  }

  /** The count of each changed state in a group, as glyphs: `+3 ~5 −2`. */
  function stateSummary(items) {
    var counts = {}
    items.forEach(function (item) {
      counts[item.state] = (counts[item.state] || 0) + 1
    })
    return ['added', 'modified', 'deleted', 'dropped']
      .filter(function (state) {
        return counts[state]
      })
      .map(function (state) {
        return BADGES[state] + counts[state]
      })
      .join(' ')
  }

  function groupText(name, items, isClosed) {
    var summary = isClosed ? stateSummary(items) : ''
    return name + ' (' + items.length + ')' + (summary ? ' · ' + summary : '')
  }

  /** The units and tables that focus shows: the unit or table in focus and its direct neighbors; null shows all. */
  function focusSet(view) {
    if (!page.focus || page.mode === 'list') return null
    var set = { units: {}, tables: {} }
    var id = page.focus.slice(2)
    if (page.focus.indexOf('u:') === 0) {
      set.units[id] = true
      view.relations.forEach(function (relation) {
        if (relation.from === id) set.units[relation.to] = true
        if (relation.to === id) set.units[relation.from] = true
      })
      view.links.forEach(function (link) {
        if (link.unit === id) set.tables[link.table] = true
      })
    } else {
      set.tables[id] = true
      view.links.forEach(function (link) {
        if (link.table === id) set.units[link.unit] = true
      })
    }
    return set
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

  /** The label of an Overview arrow: only the count of the relations it stands for, with the kinds for a screen reader. */
  function overviewLabel(edge) {
    var count = edge.relations.length
    var label = el('button', 'edge-label badge', String(count))
    var kinds = {}
    edge.relations.forEach(function (relation) {
      kinds[relation.kind] = (kinds[relation.kind] || 0) + 1
    })
    var text = Object.keys(kinds)
      .map(function (kind) {
        return kinds[kind] + ' ' + kind
      })
      .join(', ')
    label.setAttribute('aria-label', count + (count === 1 ? ' relation' : ' relations') + ' from ' + edge.from.slice(2) + ' to ' + edge.to.slice(2) + ': ' + text + '. Open a container to comment on one.')
    label.setAttribute('title', text + '. Open a container to comment on one relation.')
    return label
  }

  /** The ELK graph of what the filter shows: containers with their units, the table group, relations and entity links. */
  function graphOf(view, canvas, parts) {
    var showUnits = page.filter !== 'tables'
    var showTables = page.filter !== 'units'
    var root = { id: 'root', layoutOptions: page.mode === 'overview' && !page.focus ? OVERVIEW_LAYOUT : LAYOUT, children: [], edges: [] }
    var nodeOf = {}
    var tableNodeOf = {}
    var units = {}
    view.units.forEach(function (unit) {
      units[unit.id] = unit
    })
    var shown = focusSet(view)

    /** Adds a group to the graph: its head, then its cards, or only its head when it is closed. */
    function addGroup(key, name, items, isClosed, headClass, cardOf, nodeMap) {
      // An Overview box is larger than a closed head of the diagram, so its text stays legible after Fit.
      var isLarge = isClosed && page.mode === 'overview' && !page.focus
      var head = groupHead(key, groupText(name, items, isClosed), isClosed, headClass + (isLarge ? ' is-large' : ''))
      // The header goes in before its cards, so the Tab order is a container, then its cards.
      var headSize = measure(head, canvas)
      parts.heads.push({ id: key, node: head })
      if (isClosed) {
        // A closed group is short; it sits at the top of its layer, not in the middle of a tall neighbor.
        // The slack covers the rounding of the text width at a zoom under 100 %, which would cut the last glyph.
        var width = Math.min(isLarge ? 640 : 480, Math.max(HEAD_WIDTH, headSize.width + 12))
        root.children.push({ id: key, width: width, height: headSize.height, layoutOptions: { 'elk.alignment': 'TOP' } })
        items.forEach(function (item) {
          nodeMap[item.id] = key
        })
        return
      }
      var group = { id: key, layoutOptions: { 'elk.padding': CONTAINER_PADDING }, children: [] }
      items.forEach(function (item) {
        var card = cardOf(item)
        var size = measure(card, canvas)
        parts.cards.push({ id: card.dataset.focus, node: card })
        group.children.push({ id: card.dataset.focus, width: size.width, height: size.height })
        nodeMap[item.id] = card.dataset.focus
      })
      root.children.push(group)
    }

    if (showUnits)
      view.containers.forEach(function (container) {
        var members = container.units
          .map(function (id) {
            return units[id]
          })
          .filter(function (unit) {
            return !shown || shown.units[unit.id]
          })
        if (members.length === 0) return
        var key = 'c:' + container.id
        addGroup(key, container.id, members, isGroupClosed(key, container.isClosed), 'is-container', unitCard, nodeOf)
      })

    var tables = view.tables.filter(function (table) {
      return !shown || shown.tables[table.id]
    })
    if (showTables && tables.length > 0) addGroup('g:tables', 'Database tables', tables, isGroupClosed('g:tables', false), 'is-tables', tableCard, tableNodeOf)

    if (showUnits) {
      // A relation to a unit in a closed container goes to the container; the ones that meet there merge into 1 arrow.
      // Overview merges the relations of every kind between 2 groups, so its few boxes keep few arrows.
      var isOverview = page.mode === 'overview' && !page.focus
      var merged = {}
      view.relations.forEach(function (relation) {
        var from = nodeOf[relation.from]
        var to = nodeOf[relation.to]
        if (!from || !to || from === to) return
        var key = from + '>' + to + (isOverview ? '' : '>' + relation.kind)
        if (merged[key]) {
          merged[key].relations.push(relation)
          return
        }
        merged[key] = { id: 'e:' + relation.id, from: from, to: to, relation: relation, relations: [relation] }
      })
      Object.keys(merged).forEach(function (key) {
        var edge = merged[key]
        var isMerged = edge.relations.length > 1 || isOverview
        var label = isOverview ? overviewLabel(edge) : isMerged ? mergedLabel(edge) : relationLabel(edge.relation)
        label.type = 'button'
        label.dataset.focus = edge.id
        var size = measure(label, canvas)
        // A merged arrow stands for relations of several states, so its line takes no state style of its own; in
        // Overview it can also stand for several kinds, and then it is a plain arrow.
        var kinds = edge.relations.filter(function (relation) {
          return relation.kind === edge.relation.kind
        })
        var kind = kinds.length === edge.relations.length ? edge.relation.kind : 'mixed'
        var drawn = isMerged ? { kind: kind, state: 'merged' } : edge.relation
        if (isOverview) {
          // An Overview arrow has no label, which keeps the layout small: its width grows with its count.
          label.remove()
          parts.edges.push({ id: edge.id, relation: drawn, count: edge.relations.length, title: label.getAttribute('aria-label') })
          root.edges.push({ id: edge.id, sources: [edge.from], targets: [edge.to] })
          return
        }
        parts.edges.push({ id: edge.id, relation: drawn, label: label })
        var text = label.textContent
        root.edges.push({ id: edge.id, sources: [edge.from], targets: [edge.to], labels: [{ id: edge.id + ':label', text: text, width: size.width, height: size.height }] })
      })
    }

    if (showUnits && showTables) {
      // The links that meet at the same closed group draw 1 line.
      var linked = {}
      view.links.forEach(function (link) {
        var from = nodeOf[link.unit]
        var to = tableNodeOf[link.table]
        if (!from || !to || linked[from + '>' + to]) return
        linked[from + '>' + to] = true
        parts.edges.push({ id: 'l:' + link.id, isLink: true })
        root.edges.push({ id: 'l:' + link.id, sources: [from], targets: [to] })
      })
    }

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
    page.size = { width: laid.width, height: laid.height }
    canvas.style.width = laid.width + 'px'
    canvas.style.height = laid.height + 'px'
    layer.setAttribute('width', String(laid.width))
    layer.setAttribute('height', String(laid.height))
    markers(layer)

    parts.heads.forEach(function (head) {
      var box = boxes[head.id]
      var isFramed = Boolean(box.children && box.children.length)
      if (isFramed) layer.appendChild(svg('rect', { class: 'container-box' + (head.id === 'g:tables' ? ' is-tables' : ''), x: box.x, y: box.y, width: box.width, height: box.height }))
      // The head is the top band of its frame; a closed container has no frame, so its head draws its own border.
      var inset = isFramed ? 1 : 0
      head.node.style.width = box.width - 2 * inset + 'px'
      place(head.node, { x: box.x + inset, y: box.y + inset })
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
      if (kind === 'dependency' || kind === 'mixed') attributes['marker-end'] = 'url(#m-arrow)'
      if (kind === 'composition') attributes['marker-start'] = 'url(#m-diamond)'
      if (part.count) attributes.style = 'stroke-width: ' + Math.min(5, 1 + part.count / 2) + 'px'
      var path = layer.appendChild(svg('path', attributes))
      if (part.title) path.appendChild(svg('title', {})).textContent = part.title
      var label = (edge.labels || [])[0]
      if (part.label && label) place(part.label, { x: label.x + offset.x, y: label.y + offset.y })
    })
  }

  function showCounts(view) {
    document.getElementById('base').textContent = 'Against ' + view.baseLabel + ' · branch ' + view.branch
    var counts = document.getElementById('counts')
    counts.textContent = ''
    ;[
      ['added', view.counts.units.added, 'units\nadded'],
      ['modified', view.counts.units.modified, 'units\nmodified'],
      ['deleted', view.counts.units.deleted, 'units\ndeleted'],
      ['added', view.counts.tables.added, 'tables\nadded'],
      ['modified', view.counts.tables.modified, 'tables\nmodified'],
      ['deleted', view.counts.tables.dropped, 'tables\ndropped'],
    ].forEach(function (row) {
      // The count is a large figure over its label, set on 2 lines; the label names the state, so the color is not the
      // only sign.
      var item = el('li', 'is-' + row[0] + (row[1] === 0 ? ' is-zero' : ''))
      item.appendChild(el('span', 'count-value', String(row[1])))
      item.appendChild(el('span', 'count-label', row[2]))
      counts.appendChild(item)
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

  /**
   * On a narrow screen, the first draw scrolls the diagram to the first open container, so the first screen shows a
   * card and not an empty strip of the layout. Later draws keep the reviewer's scroll.
   */
  function scrollToFirstContainer(canvas) {
    if (page.isScrolled || !window.matchMedia(NARROW_QUERY).matches) return
    page.isScrolled = true
    var first = canvas.querySelector('.container-head[aria-expanded="true"]')
    // The diagram's own padding is left of the frame, and the neighbor before it is out of the screen.
    if (first) document.getElementById('diagram').scrollLeft = first.offsetLeft * page.zoom
  }

  /**
   * A mouse drag on the diagram scrolls it in both directions. The drag starts only after the pointer moves
   * PAN_THRESHOLD pixels, so a plain click still lands on its card and opens the comment form. A touch screen scrolls
   * the diagram on its own.
   */
  var PAN_THRESHOLD = 4
  function enablePan(diagram) {
    var pan = null
    var isPanned = false
    diagram.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'touch' || event.button !== 0) return
      if (event.target.closest('input, select, textarea')) return
      pan = { id: event.pointerId, x: event.clientX, y: event.clientY, left: diagram.scrollLeft, top: diagram.scrollTop, isMoving: false }
      isPanned = false
    })
    diagram.addEventListener('pointermove', function (event) {
      if (!pan || event.pointerId !== pan.id) return
      var dx = event.clientX - pan.x
      var dy = event.clientY - pan.y
      if (!pan.isMoving) {
        if (Math.abs(dx) < PAN_THRESHOLD && Math.abs(dy) < PAN_THRESHOLD) return
        pan.isMoving = true
        diagram.setPointerCapture(pan.id)
        diagram.classList.add('is-panning')
        // The first pixels of the drag can start a text selection; the drag removes it.
        window.getSelection().removeAllRanges()
      }
      diagram.scrollLeft = pan.left - dx
      diagram.scrollTop = pan.top - dy
    })
    function stop(event) {
      if (!pan || event.pointerId !== pan.id) return
      isPanned = pan.isMoving
      pan = null
      diagram.classList.remove('is-panning')
    }
    diagram.addEventListener('pointerup', stop)
    diagram.addEventListener('pointercancel', stop)
    // The click after a drag is not a click on what the drag started on.
    diagram.addEventListener(
      'click',
      function (event) {
        if (!isPanned) return
        isPanned = false
        event.stopPropagation()
        event.preventDefault()
      },
      true,
    )
  }

  // Zoom (the graph modes): the CSS zoom of the canvas, so the scroll area follows the zoomed size.

  function showZoom() {
    document.getElementById('canvas').style.zoom = page.zoom === 1 ? '' : String(page.zoom)
    document.getElementById('zoom-value').textContent = Math.round(page.zoom * 100) + '%'
  }

  /** Sets the zoom and keeps the point under `at` (a client point, else the center of the diagram) in its place. */
  function setZoom(value, at) {
    var diagram = document.getElementById('diagram')
    var canvas = document.getElementById('canvas')
    var frame = diagram.getBoundingClientRect()
    var origin = canvas.getBoundingClientRect()
    var point = at || { x: frame.left + diagram.clientWidth / 2, y: frame.top + diagram.clientHeight / 2 }
    // The point in the canvas at zoom 1, and the left and top padding of the scroll area.
    var x = (point.x - origin.left) / page.zoom
    var y = (point.y - origin.top) / page.zoom
    var left = origin.left - frame.left + diagram.scrollLeft
    var top = origin.top - frame.top + diagram.scrollTop
    page.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value))
    showZoom()
    diagram.scrollLeft = left + x * page.zoom - (point.x - frame.left)
    diagram.scrollTop = top + y * page.zoom - (point.y - frame.top)
  }

  /**
   * Fits the whole graph in the diagram, between `floor` (default ZOOM_MIN) and 100 %; a narrow screen fits only the
   * width, as the page scrolls.
   */
  function fit(floor) {
    if (!page.size) return
    var diagram = document.getElementById('diagram')
    var style = getComputedStyle(diagram)
    var width = diagram.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    var height = diagram.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
    var scale = width / page.size.width
    if (!window.matchMedia(NARROW_QUERY).matches) scale = Math.min(scale, height / page.size.height)
    page.zoom = Math.min(1, Math.max(floor || ZOOM_MIN, scale))
    showZoom()
    diagram.scrollTo(0, 0)
  }

  /**
   * After a mode or focus change, the next draw fits the graph, or goes back to 100 % at the top left. Focus fits no
   * lower than 75 %, so its cards stay legible; a tall neighborhood scrolls.
   */
  function zoomAfter() {
    if (page.zoomAfterDraw === 'fit') fit()
    else if (page.zoomAfterDraw === 'focus') {
      fit(0.75)
      // A tall neighborhood at 75 % can put the card in focus under the fold.
      var card = document.getElementById('canvas').querySelector('[data-focus="' + CSS.escape(page.focus) + '"]')
      if (card) card.scrollIntoView({ block: 'center', inline: 'center' })
    } else if (page.zoomAfterDraw === 'reset') {
      page.zoom = 1
      showZoom()
      document.getElementById('diagram').scrollTo(0, 0)
    }
    page.zoomAfterDraw = null
  }

  // Focus (the graph modes): 1 unit or table with its direct neighbors only.

  /** The full name of a unit (its container and name) or of a table, as the status and the focus line show it. */
  function nameOf(key) {
    var id = key.slice(2)
    var unit = page.view.units.filter(function (item) {
      return item.id === id
    })[0]
    return unit ? unit.container + '.' + unit.name : id
  }

  /** Shows 1 unit or table with its neighbors, or everything again with null; the keyboard focus stays on its card. */
  function setFocus(key) {
    var previous = page.focus
    page.focus = key
    // Focus fits its few cards in the window; Show all goes back to how the mode starts.
    page.zoomAfterDraw = key ? 'focus' : page.mode === 'overview' ? 'fit' : 'reset'
    page.focusAfterDraw = key || previous
    draw()
  }

  function showFocusBar() {
    var bar = document.getElementById('focus')
    bar.hidden = !page.focus || page.mode === 'list'
    if (bar.hidden) return
    var shown = focusSet(page.view)
    var neighbors = Object.keys(shown.units).length + Object.keys(shown.tables).length - 1
    document.getElementById('focus-text').textContent = 'Focus on ' + nameOf(page.focus) + ' and ' + neighbors + (neighbors === 1 ? ' neighbor.' : ' neighbors.')
  }

  // Modes: Overview (every group closed, fitted), Diagram (the full graph), List (rows, no layout).

  function setMode(mode) {
    page.mode = mode
    page.zoomAfterDraw = mode === 'overview' ? 'fit' : mode === 'diagram' ? 'reset' : null
    try {
      window.localStorage.setItem(MODE_KEY, mode)
    } catch (error) {
      // The mode lasts until the page closes.
    }
    draw()
  }

  function readMode() {
    try {
      var mode = window.localStorage.getItem(MODE_KEY)
      return MODES.indexOf(mode) >= 0 ? mode : 'diagram'
    } catch (error) {
      return 'diagram'
    }
  }

  function showMode() {
    var isList = page.mode === 'list'
    Array.prototype.slice.call(document.querySelectorAll('[data-mode]')).forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.mode === page.mode))
    })
    document.getElementById('diagram').hidden = isList
    document.getElementById('list').hidden = !isList
    document.getElementById('zoom').hidden = isList
    showFocusBar()
  }

  // List: 1 row per unit and per table, by group, with the relations as words and links to the other rows.

  function jumpLink(key, text) {
    var link = el('a', 'jump', text)
    link.href = '#'
    link.dataset.target = key
    return link
  }

  /** The name of another unit as a row shows it: with its container when that is not the row's own. */
  function linkName(id, units, container) {
    var other = units[id]
    if (!other) return id
    return other.container === container ? other.name : other.container + '.' + other.name
  }

  function listRelations(unit, units) {
    var list = el('ul', 'relations')
    list.setAttribute('aria-label', 'Relations')
    page.view.relations.forEach(function (relation) {
      var side = relation.from === unit.id ? 0 : relation.to === unit.id ? 1 : -1
      if (side < 0) return
      var other = side === 0 ? relation.to : relation.from
      var item = el('li')
      item.dataset.anchor = 'relation'
      item.dataset.id = relation.id
      item.tabIndex = 0
      item.appendChild(badge(relation.state))
      item.appendChild(el('span', '', (RELATION_WORDS[relation.kind] || [relation.kind, relation.kind])[side] + ' '))
      item.appendChild(jumpLink('u:' + other, linkName(other, units, unit.container)))
      list.appendChild(item)
    })
    page.view.links.forEach(function (link) {
      if (link.unit !== unit.id) return
      var item = el('li')
      item.appendChild(el('span', '', 'maps to table '))
      item.appendChild(jumpLink('t:' + link.table, link.table))
      list.appendChild(item)
    })
    return list
  }

  function listUnit(unit, units) {
    var row = unitNode('li', 'row', unit)
    var relations = listRelations(unit, units)
    if (relations.children.length > 0) row.appendChild(relations)
    return row
  }

  function listTable(table, units) {
    var row = tableNode('li', 'row', table)
    var entities = el('ul', 'relations')
    page.view.links.forEach(function (link) {
      if (link.table !== table.id) return
      var item = el('li')
      item.appendChild(el('span', '', 'mapped by '))
      item.appendChild(jumpLink('u:' + link.unit, linkName(link.unit, units, null)))
      entities.appendChild(item)
    })
    if (entities.children.length > 0) row.appendChild(entities)
    return row
  }

  function listGroup(key, name, items, rowOf, headClass) {
    var isClosed = isGroupClosed(key, false)
    var group = el('section', 'list-group')
    group.appendChild(groupHead(key, groupText(name, items, isClosed), isClosed, 'list-head ' + headClass))
    if (isClosed) return group
    var rows = el('ul', 'rows')
    items.forEach(function (item) {
      rows.appendChild(rowOf(item))
    })
    group.appendChild(rows)
    return group
  }

  function renderList() {
    var view = page.view
    var list = document.getElementById('list')
    var focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.focus : null
    var units = {}
    view.units.forEach(function (unit) {
      units[unit.id] = unit
    })
    list.textContent = ''
    if (page.filter !== 'tables')
      view.containers.forEach(function (container) {
        var members = container.units.map(function (id) {
          return units[id]
        })
        list.appendChild(listGroup('c:' + container.id, container.id, members, function (unit) {
          return listUnit(unit, units)
        }, 'is-container'))
      })
    if (page.filter !== 'units' && view.tables.length > 0)
      list.appendChild(listGroup('g:tables', 'Database tables', view.tables, function (table) {
        return listTable(table, units)
      }, 'is-tables'))
    var count = view.units.length
    setStatus('Listed ' + count + (count === 1 ? ' unit' : ' units') + ' and ' + view.tables.length + ' tables.')
    var again = focused && list.querySelector('[data-focus="' + CSS.escape(focused) + '"]')
    if (again) again.focus()
  }

  /** Goes to the row of a unit or a table in the list, and opens its group first when it is closed. */
  function jumpTo(key) {
    var list = document.getElementById('list')
    var selector = '[data-focus="' + CSS.escape(key) + '"]'
    if (!list.querySelector(selector)) {
      var id = key.slice(2)
      var group = key.indexOf('t:') === 0 ? 'g:tables' : null
      page.view.containers.forEach(function (container) {
        if (container.units.indexOf(id) >= 0) group = 'c:' + container.id
      })
      if (group) page.closed.list[group] = false
      renderList()
      renderComments()
    }
    var row = list.querySelector(selector)
    if (!row) return setStatus('The filter hides ' + nameOf(key) + '.')
    row.scrollIntoView({ block: 'center' })
    row.focus({ preventScroll: true })
    // A mouse click does not show the focus ring, so the row is marked for a moment.
    row.classList.add('is-jumped')
    setTimeout(function () {
      row.classList.remove('is-jumped')
    }, 1500)
  }

  /** Draws the view model again: after a new model, a mode, filter or focus change, or a group toggle. A newer draw wins. */
  function draw() {
    var view = page.view
    if (!view) return
    var drawing = ++page.drawing
    showMode()
    if (page.mode === 'list') {
      renderList()
      renderComments()
      return
    }
    var started = performance.now()
    var canvas = document.getElementById('canvas')
    var layer = document.getElementById('edges')
    // A draw replaces every element, so the focus goes back to the element with the same key.
    var focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.focus : null
    if (page.focusAfterDraw !== undefined) {
      focused = page.focusAfterDraw
      page.focusAfterDraw = undefined
    }
    Array.prototype.slice.call(canvas.children).forEach(function (child) {
      if (child !== layer) canvas.removeChild(child)
    })
    layer.textContent = ''
    // The cards are measured at zoom 1, as ELK lays them out.
    canvas.style.zoom = ''
    var parts = { heads: [], cards: [], edges: [] }
    var graph = graphOf(view, canvas, parts)
    elk
      .layout(graph)
      .then(function (laid) {
        if (drawing !== page.drawing) return
        render(laid, parts, canvas, layer)
        showZoom()
        zoomAfter()
        renderComments()
        var units = view.units.length
        setStatus('Drew ' + units + (units === 1 ? ' unit' : ' units') + ' and ' + view.tables.length + ' tables in ' + Math.round(performance.now() - started) + ' ms.')
        var again = focused && canvas.querySelector('[data-focus="' + CSS.escape(focused) + '"]')
        if (again) again.focus({ preventScroll: true })
        scrollToFirstContainer(canvas)
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

  /** The browser storage key of the panel's hidden state, the same for every review: a preference of the reviewer. */
  var PANEL_KEY = 'visual-review:panel-hidden'

  function isPanelHidden() {
    return document.body.classList.contains('is-panel-hidden')
  }

  /** Hides or shows the comment panel; the storage can be off, and then the page forgets the choice on reload. */
  function setPanelHidden(isHidden) {
    document.body.classList.toggle('is-panel-hidden', isHidden)
    document.getElementById('toggle-panel').setAttribute('aria-expanded', String(!isHidden))
    updateToggleLabel()
    try {
      window.localStorage.setItem(PANEL_KEY, isHidden ? '1' : '0')
    } catch (error) {
      // The choice lasts until the page closes.
    }
  }

  /** The hidden panel's button shows the count of new comments, so the reviewer sees that drafts wait. */
  function updateToggleLabel() {
    var drafts = page.comments.filter(function (comment) {
      return comment.status === 'draft'
    }).length
    document.getElementById('toggle-panel').textContent = isPanelHidden() ? 'Show comments' + (drafts > 0 ? ' (' + drafts + ' new)' : '') : 'Hide comments'
  }

  function readPanelHidden() {
    try {
      return window.localStorage.getItem(PANEL_KEY) === '1'
    } catch (error) {
      return false
    }
  }

  function openForm(anchor, comment) {
    // A comment needs the panel, so a click on an anchor shows it again.
    if (isPanelHidden()) setPanelHidden(false)
    form.anchor = anchor
    form.editing = comment || null
    var node = document.getElementById('form')
    node.hidden = false
    document.getElementById('form-anchor').textContent = (comment ? 'Edit the comment on ' : 'Comment on ') + anchorLabel(anchor)
    document.getElementById('form-text').value = comment ? comment.text : ''
    node.querySelector('input[value="' + (comment ? comment.type : 'change') + '"]').checked = true
    document.getElementById('form-text').focus()
    markTarget()
  }

  function closeForm() {
    document.getElementById('form').hidden = true
    form.anchor = null
    form.editing = null
    markTarget()
  }

  /** Marks the element the open form is about, so the reviewer sees what the comment goes to. */
  function markTarget() {
    Array.prototype.slice.call(document.querySelectorAll('.is-target')).forEach(function (node) {
      node.classList.remove('is-target')
    })
    if (!form.anchor || form.anchor.kind === 'review') return
    Array.prototype.slice.call(document.querySelectorAll('[data-anchor]')).forEach(function (node) {
      if (node.dataset.anchor === form.anchor.kind && node.dataset.id === form.anchor.id) node.classList.add('is-target')
    })
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
    updateToggleLabel()
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
    markTarget()
  }

  /** The anchor a click or Enter lands on: the innermost element with an anchor (a member before its card). */
  function anchorAt(target) {
    var node = target.closest && target.closest('[data-anchor]')
    return node ? { kind: node.dataset.anchor, id: node.dataset.id } : null
  }

  // The diagram and the list take the same clicks: a Focus button, a link to another row, else a comment anchor.
  ;['canvas', 'list'].forEach(function (id) {
    var node = document.getElementById(id)
    node.addEventListener('click', function (event) {
      var focusOn = event.target.closest('[data-focus-on]')
      if (focusOn) return setFocus(page.focus === focusOn.dataset.focusOn ? null : focusOn.dataset.focusOn)
      var jump = event.target.closest('a.jump')
      if (jump) {
        event.preventDefault()
        return jumpTo(jump.dataset.target)
      }
      var anchor = anchorAt(event.target)
      if (anchor) openForm(anchor)
    })
    node.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' || event.target.tagName === 'BUTTON' || event.target.tagName === 'A') return
      var anchor = anchorAt(event.target)
      if (!anchor) return
      event.preventDefault()
      openForm(anchor)
    })
  })
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || !page.focus || page.mode === 'list' || event.target.closest('form')) return
    setFocus(null)
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
    // A new model can lose the unit or table in focus; then the page shows everything.
    if (page.focus) {
      var id = page.focus.slice(2)
      var items = page.focus.indexOf('u:') === 0 ? view.units : view.tables
      if (!items.some(function (item) { return item.id === id })) page.focus = null
    }
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

  Array.prototype.slice.call(document.querySelectorAll('[data-mode]')).forEach(function (button) {
    button.addEventListener('click', function () {
      if (button.dataset.mode !== page.mode) setMode(button.dataset.mode)
    })
  })
  document.getElementById('focus-clear').addEventListener('click', function () {
    setFocus(null)
  })
  document.getElementById('zoom-in').addEventListener('click', function () {
    setZoom(page.zoom * 1.25)
  })
  document.getElementById('zoom-out').addEventListener('click', function () {
    setZoom(page.zoom / 1.25)
  })
  document.getElementById('zoom-fit').addEventListener('click', function () {
    fit()
  })
  // Ctrl+wheel, and the pinch of a touchpad, zoom at the pointer.
  document.getElementById('diagram').addEventListener(
    'wheel',
    function (event) {
      if (!event.ctrlKey) return
      event.preventDefault()
      setZoom(page.zoom * Math.exp(-event.deltaY * 0.002), { x: event.clientX, y: event.clientY })
    },
    { passive: false },
  )

  document.getElementById('toggle-panel').addEventListener('click', function () {
    setPanelHidden(!isPanelHidden())
  })
  if (readPanelHidden()) setPanelHidden(true)
  enablePan(document.getElementById('diagram'))
  page.mode = readMode()
  if (page.mode === 'overview') page.zoomAfterDraw = 'fit'
  showMode()

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
