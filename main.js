const snabbdom = require('snabbdom');
const patch = snabbdom.init([
  require('snabbdom/modules/class'),
  require('snabbdom/modules/props'),
  require('snabbdom/modules/style'),
  require('snabbdom/modules/eventlisteners'),
])
const h = require('snabbdom/h')
const attachTo = require('snabbdom/helpers/attachto')
const syncedDB = require('synceddb-client')

// Colors
const base03 = '#002b36'
const base02 = '#073642'
const base01 = '#586e75'
const base00 = '#657b83'
const base0 = '#839496'
const base1 = '#93a1a1'
const base2 = '#eee8d5'
const base3 = '#fdf6e3'
const yellow = '#b58900'
const orange = '#cb4b16'
const red = '#dc322f'
const magenta = '#d33682'
const violet = '#6c71c4'
const blue = '#268bd2'
const cyan = '#2aa198'
const green = '#859900'

// Animation durations
const medDur = 200

const SCROLL_UNDETERMINED = 0
const SCROLL_VERTICAL = 1
const SCROLL_HORIZONTAL = 2

let scrollDirection = SCROLL_UNDETERMINED
let domRender
let canvas, ctx
let containerRect = {width: 0, height: 0}

// Helper functions
const _ = undefined // jshint ignore:line
const noop = () => {}
const part = (fn, ...args) => (...args2) => fn.apply(_, args.concat(args2))
const pull = (elm, list) => (list.splice(list.indexOf(elm), 1), list)
const filter = (pred, list) => list.filter(pred)
const last = (arr) => arr[arr.length - 1]
const isLastOf = (elm, arr) => elm === last(arr)
const log = (name, val) => (console.log(name, val), val)
const isEven = (n) => n % 2 === 0
const isEmpty = (l) => l.length === 0
const notEmpty = (l) => l.length > 0
const hasTail = (l) => l.length > 1
const concat = (l1, l2) => l1.concat(l2)
const prepend = (elm, l) => concat([elm], l)
const append = (elm, l) => concat(l, [elm])
const head = (l) => l[0]
const tail = (l) => l.slice(1)
const map = (fn, list) => {
  const res = []
  for (let i = 0, l = list.length; i < l; ++i) res[i] = fn(list[i])
  return res
}
const fold = (fn, acc, list) => {
  for (let i = 0, l = list.length; i < l; ++i) acc = fn(acc, list[i])
  return acc
}
const each = (fn, list) => {
  for (let i = 0, l = list.length; i < l; ++i) fn(list[i])
}
const fromTo = (i, n) => {
  const res = []
  for (; i <= n; ++i) res[i] = i
  return res
}
const eq = (n, m) => n === m
const add = (n, m) => n + m
const sum = (list) => fold(add, 0, list)
const find = (pred, list) => {
  for (let i = 0, l = list.length; i < l; ++i) {
    if (pred(list[i])) return list[i]
  }
}
const prop = (name, obj) => obj[name]
const setProp = (name, val, obj) => obj[name] = val
const contains = (elm, list) => list.indexOf(elm) !== -1
const inInterval = (n, l, h) => (l <= n && n <= h)
Function.prototype.$ = function() {
  var fn = this
  var args = new Array(arguments.length);
  for (var i = 0, l = arguments.length; i < l; i++) {
    args[i] = arguments[i];
  }
  return function() {
    var res = [], i;
    for (i = 0; i < args.length; ++i) res[i] = args[i]
    for (i = 0; i < arguments.length; ++i) res[args.length + i] = arguments[i]
    return fn.apply(undefined, res)
  }
}

// Time stuff
const millisecond = 1
const second = 1000 * millisecond
const minute = 60 * second
const hour = 60 * minute
const day = 24 * hour
const week = 7 * day
const halfWeek = week / 2
const getDate = (t) => (new Date(t)).getDate()
const getMonth = (t) => (new Date(t)).getMonth()
const now = Date.now
const daysIn = (t) => Math.floor(t / day)

// Snabbdom helpers
const indentColorNames = ['yellow', 'orange', 'red', 'magenta', 'violet', 'blue', 'cyan', 'green']
const indentColors = ['#b58900', '#cb4b16', '#dc322f', '#d33682', '#6c71c4', '#268bd2', '#2aa198', '#859900']
const colorAtIndent = (n) => indentColors[isEven(n) ? n / 2 : (n - 1) / 2 + 4]
const delayRm = (t) => (_, cb) => setTimeout(cb, t)
const focus = (vnode) => vnode.elm.focus()

// DOM helper functions
const listen = (elm, event, cb) => elm.addEventListener(event, cb, false)
const targetValue = (ev) => ev.target.value

// Database
const stores = {
  tasks: [
    ['byParent', 'parent'],
    ['atRoot', 'atRoot'],
  ],
  sessions: [
    ['byTask', 'taskKeys', {multiEntry: true}],
    ['byStartTime', 'startTime'],
    ['byEndTime', 'endTime', {multiEntry: false}],
    ['byDay', 'day'],
  ]
}
const db = syncedDB.open({
  name: 'timeApp',
  version: 1,
  stores: stores,
})
const loadTaskByParentKey = (key) => db.tasks.byParent.get(key)
const putTask = (t) => db.tasks.put(t)

// State
let state
const defaultState = {
  newTask: _,
  timeView: {startTime: now() - halfWeek, duration: week}
}

const isSessionDone = (s) => s.endTime !== 0 && s.endTime < now()

const loadSessions = (node) =>
  db.sessions.byTask.get(node.task.key).then((s) => node.sessions = filter(isSessionDone, s))
const loadSessionsEndingAfterNow = () => db.sessions.byEndTime.inRange({gte: now()})
const loadSessionsEndingAtZero = () => db.sessions.byEndTime.get(0)
const loadActiveSessions = () => loadSessionsEndingAfterNow().then((l) => notEmpty(l) ? l : loadSessionsEndingAtZero())
const addChildTasks = (node, children) => (node.children = map((t) => taskNode(node, t), children))
const loadChildren = (node) => Promise.all(map(loadTaskIfOpen, node.children))
const loadTaskIfOpen = (node) =>
  node.task.open === true ? loadTaskByParentKey(node.task.key).then(addChildTasks.$(node))
                                                              .then(loadSessions.$(node))
                                                              .then(loadChildren.$(node))
                          : loadSessions(node)

const initializeState = () => {
  const restoredState = null
  const state = restoredState !== null ? JSON.parse(restoredState) : defaultState
  return db.tasks.atRoot.getAll().then((rootTasks) => {
    const rootNodes = map((t) => taskNode(undefined, t), rootTasks)
    state.taskTree = rootNodes
    return Promise.all(map(loadTaskIfOpen, rootNodes))
  }).then(loadActiveSessions).then((s) => {
    if (notEmpty(s)) {
      state.activeSession = head(s)
    }
    return state
  })
}

// Canvas rendering

const renderSessions = (ctx, msSize, startTime, endTime, offset, node) => {
  const {task, sessions, children} = node
  for (let i = 0; i < sessions.length; ++i) {
    let s = sessions[i]
    if (inInterval(s.startTime, startTime, endTime) ||
        inInterval(s.endTime, startTime, endTime)) {
      ctx.fillRect((s.startTime - startTime) * msSize, offset * taskLineH + 24 + 2,
                   (s.endTime - s.startTime) * msSize, taskLineH - 3)
    }
  }
  return task.open === true ? fold(renderSessions.$(ctx, msSize, startTime, endTime), offset + 1, children)
                            : offset + 1
}

let msSize, daysVisible, daySize, startTime, endTime, offset, pixelSize
const calcGrid = () => {
  const tW = state.timeView
  const {startTime: start, duration} = tW
  endTime = start + duration
  msSize = containerRect.width / duration
  daysVisible = Math.ceil(duration / day) + 1
  daySize = containerRect.width / (duration / day)
  startTime = start - (start % day)
  offset = (start % day) / day * daySize
  pixelSize = duration / containerRect.width
}

let lastRenderTime = now()
const gridBarH = 24
const render = (time) => {
  const w = canvas.width
  const h = canvas.height
  if (velocity !== 0) {
    const dt = time - lastRenderTime
    state.timeView.startTime -= velocity * pixelSize * dt
    calcGrid()
    velocity = velocity > 0 ? Math.max(0, velocity - (dt * 0.004))
                            : Math.min(0, velocity + (dt * 0.004))
  }
  if (containerRect.width !== w || containerRect.height !== h) {
    resizeCanvas(canvas, containerRect)
  } else {
    ctx.clearRect(0, 0, w, h)
  }
  ctx.fillStyle = base2
  ctx.fillRect(0, 0, w, gridBarH)
  ctx.fillStyle = base1
  const showHours = (endTime - state.timeView.startTime) < day
  const lineTime = showHours ? hour : day
  const lineDist = showHours ? daySize / 24 : daySize
  ctx.fillStyle = base1
  for (let i = 0; startTime + i * lineTime < endTime; ++i) {
    ctx.fillRect(-offset + i * lineDist, 0, 1, 24)
  }
  ctx.fillStyle = base2
  for (let i = 0; startTime + i * lineTime < endTime; ++i) {
    ctx.fillRect(-offset + i * lineDist, 24, 1, h-24)
  }
  ctx.fillStyle = base00
  for (let i = 0; i < daysVisible; ++i) {
    let t = startTime + (i * day)
    ctx.fillText(getDate(t) + ' / ' + getMonth(t), -offset + i * daySize + 5, 15)
  }
  ctx.fillStyle = base2
  fold(renderSessions.$(ctx, msSize, state.timeView.startTime, endTime), 0, state.taskTree)
  lastRenderTime = time
  if (touchesDown.length !== 0 || velocity !== 0) {
    requestAnimationFrame(render)
  }
}

const resizeCanvas = (canvas, {width: w, height: h}) => {
  canvas.width = w * window.devicePixelRatio
  canvas.height = h * window.devicePixelRatio
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
}

listen(document, 'DOMContentLoaded', () => {
  initializeState().then((initState) => {
    state = initState
    domRender = domRenderer()
    domRender()
    updateContainerRect()

    canvas = document.getElementById('canvas')
    ctx = canvas.getContext('2d')

    const content = document.getElementById('task-container')
    listen(window, 'resize', updateContainerRect)
    listen(content, 'touchstart', touchStart)
    listen(content, 'touchend', touchEnd)
    listen(content, 'touchcancel', touchCancel)
    listen(content, 'touchmove', touchMove)
    requestAnimationFrame(render)
  })
})

const updateContainerRect = () => {
  containerRect.width = document.body.clientWidth
  calcGrid()
  if (canvas !== undefined) requestAnimationFrame(render)
}

// Handle gestures
let touchesDown = []
let startTimeHistory = []
let velocity = 0

const findTouch = (id, touches) => find((t) => t.identifier === id, touches)

const touchStart = (ev) => {
  scrollDirection = SCROLL_UNDETERMINED
  if (velocity !== 0) { ev.preventDefault(); velocity = 0; }
  const touch = ev.changedTouches[0];
  touchesDown = concat(touchesDown, map((t) => ({id: t.identifier, x: t.pageX, y: t.pageY}), ev.changedTouches))
  if (touchesDown.length === 2) requestAnimationFrame(render)
}

const touchMove = (ev) => {
  const tW = state.timeView
  if (touchesDown.length === 1) {
    if (scrollDirection === SCROLL_VERTICAL) return
    ev.preventDefault()
    const t = touchesDown[0]
    const {pageX: x, pageY: y} = find((moved) => moved.identifier === t.id, ev.changedTouches)
    if (scrollDirection === SCROLL_UNDETERMINED) {
      if (Math.abs(x - t.x) > 30) {
        scrollDirection = SCROLL_HORIZONTAL
        t.x = x
        t.y = y
        requestAnimationFrame(render)
      } else if (Math.abs(y - t.y) > 30) {
        scrollDirection = SCROLL_VERTICAL
      }
    } else if (scrollDirection === SCROLL_HORIZONTAL) {
      tW.startTime -= (x - t.x) * pixelSize
      startTimeHistory.push([now(), x])
      t.x = x
      t.y = y
      calcGrid()
    }
  } else {
    ev.preventDefault()
    const t1 = touchesDown[0], t2 = touchesDown[1]
    const m1 = findTouch(t1.id, ev.touches)
    const m2 = findTouch(t2.id, ev.touches)
    const nRelX1 = m1.screenX / containerRect.width
    const nRelX2 = m2.screenX / containerRect.width
    const time1 = tW.startTime + (t1.x / containerRect.width) * tW.duration
    const time2 = tW.startTime + (t2.x / containerRect.width) * tW.duration
    tW.duration = Math.abs(time1 - time2) / Math.abs(nRelX1 - nRelX2)
    tW.startTime = time1 - (tW.duration * nRelX1)
    t1.x = m1.screenX; t1.y = m1.screenY
    t2.x = m2.screenX; t2.y = m2.screenY
    calcGrid()
  }
}

const touchEnd = (ev) => {
  const ids = map(prop.$('identifier'), ev.changedTouches)
  if (touchesDown.length === 1 && startTimeHistory.length > 0) {
    let curTime = now(), i
    for (i = startTimeHistory.length - 1; 1 <= i; --i) {
      if (startTimeHistory[i][0] < (curTime - 50)) break;
    }
    const [prevTime, prevX] = startTimeHistory[i]
    velocity = (touchesDown[0].x - prevX) / (curTime - prevTime)
  }
  startTimeHistory = []
  touchesDown = filter((t) => !contains(t.id, ids), touchesDown)
}

const touchCancel = (ev) => {
  const ids = map(prop.$('identifier'), ev.changedTouches)
  touchesDown = filter((t) => !contains(t.id, ids), touchesDown)
}

const notify = () => {
  navigator.vibrate([100, 100, 100, 300, 300])
}

const taskNode = (parent, task) => ({task, parent, children: [], sessions: []})

// Modify state

const FOLD_IN = 0, FOLD_OUT = 1
let foldedAt = 0
let foldDiff = 0
let foldDir = FOLD_OUT

const toggleFold = (pos, nPos, node) => {
  const start = performance.now()
  const task = node.task
  foldDir = task.open ? FOLD_IN : FOLD_OUT
  foldedAt = pos
  if (foldDir === FOLD_IN) {
    foldDiff = nPos - pos - 1
    domRender()
  }
  task.open = !task.open
  loadTaskIfOpen(node).then(() => {
    if (task.open) foldDiff = countChildren(node)
    domRender()
    setTimeout(() => putTask(task), foldDiff * medDur)
  })
}

const toggleDone = (task) => {
  const start = performance.now()
  task.done = !task.done
  setTimeout(() => putTask(task), medDur)
  domRender()
}

const toggleTimerModal = (task, ev) => {
  task.timerModalOpen = !task.timerModalOpen
  domRender()
}

const walkUpNodes = (acc, node) => node.parent ? walkUpNodes(concat([node], acc), node.parent)
                                               : concat([node], acc)
const countChildren = (node) => node.children.length + sum(map(countChildren, node.children))
const findTask = (key, list) => find((n) => n.task.key === key, list)
const walkDown = (found, keys, nodes) => {
  const node = findTask(head(keys), nodes);
  return hasTail(keys) ? walkDown(append(node, found), tail(keys), node.children)
                       : append(node, found)
}
const walkTreeByTaskKey = (keys, nodes) => walkDown([], keys, nodes)

const createSession = (node, duration) => {
  const startTime = now() - hour
  const keys = map(prop.$('key'), map(prop.$('task'), walkUpNodes([], node)))
  const session = {
    taskKeys: keys,
    startTime,
    day: daysIn(startTime),
    endTime: duration === _ ? 0 : startTime + duration
  }
  state.activeSession = session
  node.task.timerModalOpen = false
  db.sessions.put(session)
  domRender()
}

const endSession = (session) => {
  if (session.endTime === 0) session.endTime = now()
  db.sessions.put(session).then(() => {
    state.activeSession = _
    const sessionsLists = map(prop.$('sessions'), walkTreeByTaskKey(session.taskKeys, state.taskTree))
    each((sessions) => sessions.push(session), sessionsLists)
    domRender()
  })
}

const toggleOptionsMenu = (task) => {
  task.showOptionsMenu = !task.showOptionsMenu
  domRender()
}

const beginCreateTask = (parentNode, target) => {
  if (parentNode !== _) {
    const parent = parentNode.task
    parent.showOptionsMenu = false
    parent.open = true
    putTask(parent)
  }
  state.newTask = {title: '', target, parentNode}
  domRender()
}

const dropNewTask = () => {
  state.newTask = _
  domRender()
}

const updateNewSubtaskTitle = (task, ev) => {
  state.newTask.title = targetValue(ev)
}

const createNewTask = ({parentNode, target, title}, ev) => {
  ev.preventDefault()
  const createdTask = {title, open: false}
  if (parentNode === _) {
    createdTask.atRoot = 1
  } else {
    const parent = parentNode.task
    createdTask.parent = parent.key
    if (parent.hasSubtasks !== true) {
      parent.hasSubtasks = true
      putTask(parent)
    }
  }
  target.push(taskNode(parent, createdTask))
  state.newTask = _
  putTask(createdTask)
  domRender()
}

const deleteTask = (node, parentChildren) => {
  node.task.showOptionsMenu = _
  domRender()
  pull(node, parentChildren)
  domRender()
  db.tasks.delete(node.task.key)
}

// View

const taskLineH = 51
const startSessionModal = (node) =>
  h('div.begin-session', [
    h('div.btn.btn-block', {on: {click: [createSession, node, _]}}, 'Stop timer manually'),
    h('h2', 'or after'),
    h('table', [
      h('tr', [
        h('td.btn', {on: {click: notify}}, '0s'),
        h('td.btn', {on: {click: [setTimeout, notify, 5000]}}, '5s'),
        h('td.btn', '10m'),
      ]),
      h('tr', [
        h('td.btn', '15m'),
        h('td.btn', '20m'),
        h('td.btn', '25m'),
      ]),
      h('tr', [
        h('td.btn', '30m'),
        h('td.btn', '35m'),
        h('td.btn', '40m'),
      ]),
      h('tr', [
        h('td.btn', '45m'),
        h('td.btn', '50m'),
        h('td.btn', '55m'),
      ]),
      h('tr', [
        h('td.btn', '1h'),
        h('td.btn', '1h 15m'),
        h('td.btn', '1h 30m'),
      ]),
    ]),
  ])

const sessionModal = (session) =>
  h('div', [
    'Session started!', h('br'),
    session.startTime, h('br'),
    session.endTime || 'never ends',
    h('div.btn', {on: {click: [endSession, session]}}, 'End'),
  ])

const createTaskModal = (newTask) =>
  h('div', {
    style: {alignSelf: 'flex-end'},
  }, [
    h('h2', 'Create subtask'),
    h('form', {on: {submit: createNewTask.$(newTask)}}, [
      h('input.block-input', {
        on: {input: updateNewSubtaskTitle.$(newTask)},
        props: {type: 'text', placeholder: 'Task title'},
        hook: {insert: focus}
      })
    ])
  ])

const taskOptionsModal = (parentChildren, node) =>
  h('div', {style: {}}, [
    h('div.btn.btn-block', {
      style: {marginBottom: '.5em'}, on: {click: [beginCreateTask, node, node.children]}
    }, [h('i.fa.fa-plus'), 'Create subtask']),
    h('div.btn.btn-block.btn-danger', {
      on: {click: [deleteTask, node, parentChildren]}
    }, [h('i.fa.fa-times'), 'Delete task']),
  ])

const foldIndicator = (pos, nPos, node) =>
  h('div.fold-indicator', {
    on: {click: [toggleFold, pos, nPos, node]},
  }, [h('i.fa.fa-chevron-down', {
    style: {transform: `rotate(${node.task.open ? 0 : -90}deg)`},
  })])

const doneCheckbox = (task) =>
  h('div.fold-indicator', {
    on: {click: [toggleDone, task]},
  }, [task.done ? h('i.fa.fa-check-square') : h('i.fa.fa-square-o')])

const vtask = (parentChildren, level, [pos, nodes], node) => {
  const {task, children} = node
  const [newPos, subTasks] = task.open ? fold(vtask.$(children, level + 1), [pos + 1, []], children)
                                       : [pos + 1, []]
  return [newPos, append(h('li.task', {
    class: {folded: !task.open},
  }, [
    h('div.task-line', {
      style: {opacity: 0, transform: `translateY(${pos*taskLineH}px)`,
              transitionDuration: `${medDur}ms, ${foldDiff*medDur/2}ms`,
              transitionDelay: `${(pos-foldedAt)*medDur/2}ms, ${foldDir===FOLD_IN?medDur/2:0}ms`,
              delayed: {opacity: 1, transform: `translateY(${pos*taskLineH}px)`},
              destroy: {opacity: 0, transitionDelay: `${(foldDiff-(pos-foldedAt))*medDur/2}ms, 0ms`}},
    },
    map((l) => h('div.indent-indicator', {
      class: {'indent-faded': l !== level},
      style: {marginLeft: `${l}em`, backgroundColor: colorAtIndent(l)}
    }), fromTo(0, level)).concat([
      task.hasSubtasks ? foldIndicator(pos, newPos, node) : doneCheckbox(task),
      h('div.title-container', {
        on: {click: [toggleOptionsMenu, task]},
      }, [h('span.title', {
        class: {done: task.done},
        style: {color: !task.done ? colorAtIndent(level) : base1}
      }, task.title)]),
      h('div.start-timing-btn', {on: {click: [toggleTimerModal, task]}}, [h('i.fa.fa-lg.fa-clock-o')]),
    ])),
    notEmpty(subTasks) ? h('ul', {hook: {remove: delayRm((newPos-pos-1)*medDur)}}, subTasks) : '',
    task.timerModalOpen ? modal(startSessionModal(node), toggleTimerModal.$(task)) : '',
    task.showOptionsMenu ? modal(taskOptionsModal(parentChildren, node), toggleOptionsMenu.$(task)) : '',
  ]), nodes)]
}

const vtree = (state) => {
  const [nTasks, tasks] = fold(vtask.$(state.taskTree, 0), [0, []], state.taskTree)
  const newHeight = nTasks * taskLineH + gridBarH
  if (containerRect.height !== newHeight) {
    containerRect.height = newHeight
    requestAnimationFrame(render)
  }
  return h('div#container', [
    h('div.top-bar', [
      h('div.app-name', 'Timesheet'),
      h('i.menu-btn.fa.fa-ellipsis-v'),
    ]),
    h('div.top-bar-filler'),
    h('canvas#canvas'),
    h('div#task-container', {style: {height: nTasks*taskLineH+'px'}}, [
      h('ul#tasks', tasks),
      state.newTask ? modal(createTaskModal(state.newTask), dropNewTask) : '',
      state.activeSession ? modal(sessionModal(state.activeSession), noop) : '',
    ]),
    h('div.after-tasks', {
      style: {transform: `translateY(${nTasks*taskLineH}px)`,
              transitionDuration: foldDiff*medDur/2 + 'ms',
              transitionDelay: (foldDir === FOLD_IN ? medDur/2 : 0) + 'ms'},
    }, [
      h('div.btn', {
        style: {margin: '.2em'},
        on: {click: [beginCreateTask, _, state.taskTree]},
      }, 'Create task'),
    ])
  ])
}

const domRenderer = () => {
  var oldVtree = document.getElementById('container')
  return () => {
    if (state.timeView === _) {
      state.timeView = {startTime: now() - halfWeek, duration: week}
    }
    oldVtree = patch(oldVtree, vtree(state))
  }
}

const modal = (vnode, rmCb) => attachTo(document.body, h('div.modal', {
    style: {opacity: 0, delayed: {opacity: 1}, remove: {opacity: 0}},
  }, [
    h('div.modal-backdrop', {
      on: {click: rmCb},
    }),
    vnode
  ]))
