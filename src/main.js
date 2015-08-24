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
const stack = require('../../stack-concat/stack-concat.js')
const R = require('ramda')
const treis = require('treis')

import * as T from './time'
import * as Task from './task'
import * as TaskNode from './tasknode'

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
let canvas, ctx, gridBarCanvas, gridBarCtx
let containerRect = {width: 0, height: 0}

const hasChromeAlarm = 'chrome' in window && 'alarms' in chrome
const hasNotifications = 'Notification' in window
if (hasNotifications) Notification.requestPermission()

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
const range = (low, high) => {
  const res = [];
  for (; low < high; ++low) res.push(low)
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
const intervalsOverlap = (l1, h1, l2, h2) => inInterval(l1, l2, h2) || inInterval(h1, l2, h2)
const then = (fn, p) => p.then(fn)
const reduceIdx = R.addIndex(R.reduce)

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
    ['byEndTime', 'endTime'],
    ['byDay', 'day'],
    ['inDay', 'days', {multiEntry: true}],
  ]
}

const migrations = {
  2: (IDBDb, ev) => {
    db.transaction(['sessions'], 'rw', function(sessions) {
      sessions.byStartTime.getAll().then((ses) => {
        map((s) => {
          s.days = T.daysBetween(s.startTime, s.endTime)
          sessions.put(s)
        }, ses)
      })
    }).then(() => console.log('saved'))
  }
}

const db = syncedDB.open({
  name: 'timeApp',
  version: 2,
  stores: stores,
  migrations: migrations,
})
const putTask = (t) => db.tasks.put(t)

// State

let state
const defaultState = {
  newTask: _,
  timeView: {startTime: T.now() - halfWeek, duration: week}
}

const isSessionDone = (s) => s.endTime !== 0

const loadTaskByParentKey = (key) => db.tasks.byParent.get(key)

const loadSessions = (node) => db.sessions.byTask.get(node.task.key).then(filter.$(isSessionDone))

const loadActiveSessions = () => db.sessions.byEndTime.get(0)

const loadAndSetSessions = (node) => loadSessions(node).then((s) => node.sessions = s)

const addChildTasks = (node, children) => {
  node.children = map((t) => TaskNode.init(node, t, initEmptyDaysArr(startDay, endDay)), children)
}

const isNodeOpen = (node) => node.task.open

const loadChildren = (node) => Promise.all(map(loadTaskIfOpen, node.children))

const loadTaskIfOpen = (node) =>
  node.task.open === true ? loadTaskByParentKey(node.task.key).then(addChildTasks.$(node))
                                                              .then(loadAndSetSessions.$(node))
                                                              .then(loadChildren.$(node))
                          : loadAndSetSessions(node)

const loadChildTasks = (parentKey) => db.tasks.byParent.get(parentKey)

const loadChildNodes = (parentNode) => loadChildTasks(parentNode.task.key).then(map.$(taskNode.$(parentNode)))

const setChildNodes = (parentNode, children) => parentNode.children = children

const loadSetChildNodes = (parentNode) => loadChildNodes(parentNode).then(setChildNodes.$(parentNode))

const initChildNodes = (parentNode) => loadSetChildNodes(parentNode)
                                       .then(copyDaysFromNodeToChildren.$(parentNode))
                                       .then(() => Promise.all(map(initChildNodes, filter(isNodeOpen, parentNode.children))))

const initializeState = () => {
  const restoredState = null
  const state = restoredState !== null ? JSON.parse(restoredState) : defaultState
  const {startTime: start, duration} = state.timeView
  endTime = start + duration
  startTime = start - (start % day)
  startDay = T.daysIn(startTime)
  endDay = T.daysIn(endTime)
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

// Tree

const walkUpNodes = (acc, node) => node.parent ? walkUpNodes(concat([node], acc), node.parent)
                                               : concat([node], acc)
const countChildren = (node) => node.children.length + sum(map(countChildren, node.children))
const findTask = (key, list) => find((n) => n.task.key === key, list)
const walkDown = (found, [key, ...keys], nodes) => {
  const node = findTask(key, nodes);
  return node === _     ? found
       : !isEmpty(keys) ? walkDown(append(node, found), keys, node.children)
                        : append(node, found)
}
const walkTreeByTaskKey = (keys, nodes) => walkDown([], keys, nodes)
const eachNode_ = (fn, node) => { fn(node); each(eachNode_.$(fn), node.children) }
const eachNode = (fn, nodes) => each(eachNode_.$(fn), nodes)

// Day
const loadSessionsInDay = (day) => db.sessions.inDay.get(day)
const Day = (dayNr) => ({
  sessions: [], duration: 0, dayNr, startTime: dayNr * T.day
})
const addSessionToDay = (session, day) => {
  day.sessions.push(session)
  day.duration += Math.max(session.endTime, day.startTime + T.day) - Math.min(session.startTime, day.startTime)
}
const copyDayFromTo = (childKey, parentDay, childDay) => {
  each((session) => {
    if (contains(childKey, session.taskKeys)) {
      addSessionToDay(session, childDay)
    }
  }, parentDay.sessions)
}
const initEmptyDaysArr = (start, end) => map(Day, range(start - PRELOAD_SIZE_DAY, end + PRELOAD_SIZE_DAY))

const copyDaysFromTo = (childKey, parentDays, childDays) => R.zipWith(copyDayFromTo.$(childKey), parentDays, childDays)

const copyDaysFromNodeToChild = (parentNode, childNode) => copyDaysFromTo(childNode.task.key, parentNode.days, childNode.days)

const copyDaysFromNodeToChildren = (node) => map(copyDaysFromNodeToChild.$(node), node.children)

const addSessionToDays = (nodes, dayNr, session) => {
  const daysList = map(prop.$('days'), walkTreeByTaskKey(session.taskKeys, nodes))
  if (isEmpty(daysList)) console.log('session without task', session.key)
  each((days) => addSessionToDay(session, days[dayNr - startDay + PRELOAD_SIZE_DAY]), daysList)
}
const loadDay = (nodes, dayNr) =>
  loadSessionsInDay(dayNr).then((ses) => {
    each(addSessionToDays.$(nodes, dayNr), ses)
  })
const prependExtraDay = (dayNr, nodes) => {
  eachNode((node) => node.days.unshift(Day(dayNr)), nodes)
  loadDay(nodes, dayNr - PRELOAD_SIZE_DAY)
}
const appendExtraDay = (dayNr, nodes) => {
  eachNode((node) => node.days.push(Day(dayNr)), nodes)
  loadDay(nodes, dayNr + PRELOAD_SIZE_DAY - 1)
}

const dropPreDay = (nodes) => eachNode((node) => node.days.shift(), nodes)

const dropPostDay = (nodes) => eachNode((node) => node.days.pop(), nodes)

// Canvas rendering

const renderSessions = (ctx, msSize, startTime, endTime, offset, node) => {
  const {task, sessions, children, days} = node
  rendered = 0
  for (let i = 0; i < sessions.length; ++i) {
    let {startTime: start, endTime: end} = sessions[i]
    if(intervalsOverlap(start, end, startTime, endTime)) {
      rendered++;
      ctx.fillRect((start - startTime) * msSize, offset * taskLineH + 2,
                   (end - start) * msSize, taskLineH - 3)
    }
  }
  var rendered = 0
  ctx.fillStyle = 'rgba(0, 0, 100, .2)'
  for (let dayNr = startDay; dayNr <= endDay; ++dayNr) {
    const dayStartTime = dayNr * day
    const dayEndTime = (dayNr + 1) * day
    let sessions = days[PRELOAD_SIZE_DAY - startDay + dayNr].sessions
    for (let i = 0; i < sessions.length; ++i) {
      const start = Math.max(sessions[i].startTime, dayStartTime)
      const end = Math.min(sessions[i].endTime, dayEndTime)
      rendered++
      ctx.fillRect((start - startTime) * msSize, offset * taskLineH + 2,
                   (end - start) * msSize, taskLineH - 3)
    }
  }
  ctx.fillStyle = base2 // fixme
  return task.open === true ? fold(renderSessions.$(ctx, msSize, startTime, endTime), offset + 1, children)
                            : offset + 1
}

const PRELOAD_SIZE_DAY = 5
let msSize, daysVisible, daySize, startTime, endTime, offset, pixelSize, startDay, endDay
const calcGrid = () => {
  const {startTime: start, duration} = state.timeView
  endTime = start + duration
  startTime = start - (start % day)
  const newStartDay = T.daysIn(startTime)
  const newEndDay = T.daysIn(endTime)
  daysVisible = T.daysIn(endTime) - T.daysIn(start) + 1
  msSize = containerRect.width / duration
  daySize = containerRect.width / (duration / day)
  offset = (start % day) / day * daySize
  pixelSize = duration / containerRect.width
  if (newStartDay < startDay) {
    //console.log('Load pre', newStartDay)
    prependExtraDay(newStartDay, state.taskTree)
  } else if (newStartDay > startDay) {
    //console.log('Drop pre', newStartDay)
    dropPreDay(state.taskTree)
  }
  if (newEndDay > endDay) {
    //console.log('Load post', newEndDay)
    appendExtraDay(newEndDay, state.taskTree)
  } else if (newEndDay < endDay) {
    //console.log('Drop post', newEndDay)
    dropPostDay(state.taskTree)
  }
  startDay = newStartDay
  endDay = newEndDay
}

let lastRenderTime = T.now()
const gridBarH = 16
const render = (time) => {
  let w = canvas.width
  let h = canvas.height
  if (velocity !== 0) { // handle velocity
    const dt = time - lastRenderTime
    state.timeView.startTime -= velocity * pixelSize * dt
    calcGrid()
    velocity = velocity > 0 ? Math.max(0, velocity - (dt * 0.004))
                            : Math.min(0, velocity + (dt * 0.004))
  }
  if (containerRect.width * devicePixelRatio !== w ||
      containerRect.height * devicePixelRatio - gridBarH !== h) { // resize or clear canvas
    resizeCanvas(canvas, gridBarCanvas, containerRect)
    w = canvas.width
    h = canvas.height
  } else {
    ctx.clearRect(0, 0, w, h)
  }
  gridBarCtx.fillStyle = base2 // draw grid bar
  gridBarCtx.fillRect(0, 0, w, gridBarH)
  gridBarCtx.fillStyle = base1 // fixme
  const showHours = (endTime - state.timeView.startTime) < day
  const lineTime = showHours ? hour : day
  const lineDist = showHours ? daySize / 24 : daySize
  gridBarCtx.fillStyle = base1
  for (let i = 0; startTime + i * lineTime < endTime; ++i) { // draw bar vertical lines
    gridBarCtx.fillRect(-offset + i * lineDist, 0, 1, gridBarH)
  }
  gridBarCtx.fillStyle = base00
  for (let i = 0; i < daysVisible; ++i) { // draw dates
    let t = startTime + (i * day)
    gridBarCtx.fillText(T.getDate(t) + ' / ' + T.getMonth(t), -offset + i * daySize + 5, 12)
  }
  ctx.fillStyle = base2
  for (let i = 0; startTime + i * lineTime < endTime; ++i) { // draw long vertical lines
    ctx.fillRect(-offset + i * lineDist, 0, 1, h)
  }
  ctx.fillStyle = base2
  fold(renderSessions.$(ctx, msSize, state.timeView.startTime, endTime), 0, state.taskTree)
  lastRenderTime = time
  if (touchesDown.length !== 0 || velocity !== 0) {
    requestAnimationFrame(render)
  }
}

const resizeCanvas = (canvas, gridBarCanvas, {width: w, height: h}) => {
  canvas.width = w * window.devicePixelRatio
  canvas.height = (h - gridBarH) * window.devicePixelRatio
  canvas.style.width = w + 'px'
  canvas.style.height = h - gridBarH + 'px'
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  gridBarCanvas.width = w * window.devicePixelRatio
  gridBarCanvas.height = gridBarH * window.devicePixelRatio
  gridBarCanvas.style.width = w + 'px'
  gridBarCanvas.style.height = gridBarH + 'px'
  gridBarCtx.scale(window.devicePixelRatio, window.devicePixelRatio)
}

listen(document, 'DOMContentLoaded', () => {
  initializeState().then((initState) => {
    state = initState
    domRender = domRenderer()
    domRender()
    updateContainerRect()

    //console.log('load', startDay - PRELOAD_SIZE_DAY, endDay + PRELOAD_SIZE_DAY,
                        //(endDay + PRELOAD_SIZE_DAY) - (startDay - PRELOAD_SIZE_DAY) + 1)
    canvas = document.getElementById('canvas')
    ctx = canvas.getContext('2d')
    gridBarCanvas = document.getElementById('grid-bar')
    gridBarCtx = gridBarCanvas.getContext('2d')
    console.log(startDay - PRELOAD_SIZE_DAY -( endDay + PRELOAD_SIZE_DAY))
    console.log(range(startDay - PRELOAD_SIZE_DAY, endDay + PRELOAD_SIZE_DAY))
    console.log(range(startDay - PRELOAD_SIZE_DAY, endDay + PRELOAD_SIZE_DAY).length)
    Promise.all(map(loadDay.$(state.taskTree),
                range(startDay - PRELOAD_SIZE_DAY, endDay + PRELOAD_SIZE_DAY)))
           .then(() => console.log(state.taskTree) || requestAnimationFrame(render))

    const content = document.getElementById('task-container')
    listen(window, 'resize', updateContainerRect)
    listen(content, 'touchstart', touchStart)
    listen(content, 'touchend', touchEnd)
    listen(content, 'touchcancel', touchCancel)
    listen(content, 'touchmove', touchMove)
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
    var t = touchesDown[0]
    var {pageX: x, pageY: y} = find((moved) => moved.identifier === t.id, ev.changedTouches)
    if (scrollDirection === SCROLL_UNDETERMINED) {
      if (Math.abs(x - t.x) > 20) {
        scrollDirection = SCROLL_HORIZONTAL
        t.x = x
        t.y = y
        requestAnimationFrame(render)
      } else if (Math.abs(y - t.y) > 20) {
        scrollDirection = SCROLL_VERTICAL
      }
    } else if (scrollDirection === SCROLL_HORIZONTAL) {
      ev.preventDefault()
      tW.startTime -= (x - t.x) * pixelSize
      startTimeHistory.push([T.now(), x])
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
    let curTime = T.now(), i
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

const notify = (msDelay) => {
  if (hasChromeAlarm) {
    chrome.alarms.create('countdown', {when: T.now() + msDelay})
  } else if ('cordova' in window) {
    cordova.plugins.notification.local.schedule({
      text: 'Task done yolo',
      at: new Date(msDelay + T.now()),
      sound: 'file://sound.mp3',
    })
  } else {
    setTimeout(() => {
      navigator.vibrate([100, 100, 100, 300, 300])
      if (hasNotifications) {
        new Notification('Task done');
      }
    }, msDelay)
  }
}

const taskNode = (parent, task) => ({
  task,
  parent,
  children: [],
  sessions: [],
  days: initEmptyDaysArr(startDay, endDay)
})

// Modify state

const FOLD_IN = 0, FOLD_OUT = 1
let foldedAt = 0
let foldDiff = 0
let foldDir = FOLD_OUT

const toggleFold = (pos, nrOfSubtasks, node) => {
  const {task} = node
  foldDir = task.open ? FOLD_IN : FOLD_OUT
  foldedAt = pos
  if (foldDir === FOLD_IN) {
    foldDiff = nrOfSubtasks
    domRender()
    //node.children = [] // FIXME
    task.open = !task.open
    setTimeout(domRender, 20)
  } else {
    task.open = !task.open
    initChildNodes(node).then(() => {
      foldDiff = countChildren(node)
      domRender()
    })
  }
  setTimeout(() => putTask(task), foldDiff * medDur)
}

const toggleDone = (task) => {
  //task.done = !task.done
  task = Task.update(Task.Action.ToggleDone(), task)
  setTimeout(() => putTask(task), medDur)
  domRender()
}

const toggleTimerModal = (task, ev) => {
  task.showOptionsMenu = false
  task.timerModalOpen = !task.timerModalOpen
  domRender()
}

const createSession = (node, duration) => {
  const startTime = T.now()
  const keys = map(prop.$('key'), map(prop.$('task'), walkUpNodes([], node)))
  const session = {
    taskKeys: keys,
    startTime,
    day: T.daysIn(startTime),
    endTime: 0 // endTime = 0 means active/open
  }
  if (duration !== undefined) {
    session.duration = duration
    notify(duration)
  }
  state.activeSession = session
  node.task.timerModalOpen = false
  db.sessions.put(session)
  domRender()
}

const endSession = (session) => {
  session.endTime = T.now()
  delete session.duration
  session.days = T.daysBetween(session.startTime, session.endTime)
  db.sessions.put(session).then(() => {
    state.activeSession = _
    const sessionsLists = map(prop.$('sessions'), walkTreeByTaskKey(session.taskKeys, state.taskTree))
    each((sessions) => sessions.push(session), sessionsLists)
    each((dayNr) => addSessionToDays(state.taskTree, dayNr, session), session.days)
    domRender()
    requestAnimationFrame(render)
  })
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
  const parentTask = parentNode === _ ? _ : parentNode.task
  const createdTask = Task.init(parentTask, title)
  if (parentTask.hasSubtasks !== true) {
    parentTask.hasSubtasks = true
    putTask(parentTask)
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

const updateTaskNode = R.curry((idx, action) => {
  state.taskTree[idx] = TaskNode.update(action, state.taskTree[idx])
  domRender()
})

// View

const taskLineH = 51
const startSessionModal = (node) =>
  h('div.begin-session', [
    h('div.btn.btn-block', {on: {click: [createSession, node, _]}}, 'Stop timer manually'),
    h('h2', 'or after'),
    h('table', [
      h('tr', [
        h('td.td-btn', {on: {click: [createSession, node, second]}}, '1s'),
        h('td.td-btn', {on: {click: [createSession, node, 5*second]}}, '5s'),
        h('td.td-btn', {on: {click: [createSession, node, minute]}}, '1m'),
      ]),
      h('tr', [
        h('td.td-btn', {on: {click: [createSession, node, 15*minute]}}, '15m'),
        h('td.td-btn', {on: {click: [createSession, node, 20*minute]}}, '20m'),
        h('td.td-btn', {on: {click: [createSession, node, 25*minute]}}, '25m'),
      ]),
      h('tr', [
        h('td.td-btn', {on: {click: [createSession, node, 30*minute]}}, '30m'),
        h('td.td-btn', {on: {click: [createSession, node, 35*minute]}}, '35m'),
        h('td.td-btn', {on: {click: [createSession, node, 40*minute]}}, '40m'),
      ]),
      h('tr', [
        h('td.td-btn', {on: {click: [createSession, node, 45*minute]}}, '45m'),
        h('td.td-btn', {on: {click: [createSession, node, 50*minute]}}, '50m'),
        h('td.td-btn', {on: {click: [createSession, node, 55*minute]}}, '55m'),
      ]),
      h('tr', [
        h('td.td-btn', {on: {click: [createSession, node, hour]}}, '1h'),
        h('td.td-btn', {on: {click: [createSession, node, hour+15*minute]}}, '1h 15m'),
        h('td.td-btn', {on: {click: [createSession, node, 1*hour+30*minute]}}, '1h 30m'),
      ]),
    ]),
  ])

const sessionModal = (session) =>
  attachTo(document.body, h('div.session-modal', [
    h('h1', 'Session started!'),
    (new Date(session.startTime)).toString(), h('br'),
    session.duration ? (new Date(session.startTime + session.duration)).toString() : 'never ends',
    h('div.row.session-modal-btn-row', [
      h('div.white-outline-btn', 'Pause'),
      h('div.white-outline-btn', {on: {click: [endSession, session]}}, 'End'),
    ])
  ]))

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

const taskNodeView = (acc, model, idx) => TaskNode.view(state.taskTree, foldedAt, foldDir, foldDiff, [], updateTaskNode(idx), acc, model)

const vtree = (state) => {
  const [nTasks, tasks] = reduceIdx(taskNodeView, [0, []], state.taskTree)
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
    h('canvas#grid-bar', []),
    h('div.top-bar-filler'),
    h('canvas#canvas'),
    h('div#task-container', {style: {height: nTasks*taskLineH+'px'}}, [
      h('ul#tasks', tasks),
      state.newTask ? modal(createTaskModal(state.newTask), dropNewTask) : '',
      state.activeSession ? sessionModal(state.activeSession) : '',
    ]),
    h('div.after-tasks', {
      style: {transform: `translateY(${nTasks*taskLineH}px)`,
              transitionDuration: medDur/2 + 'ms',
              transitionDelay: (foldDir === FOLD_IN ? foldDiff*medDur/6+medDur : 0) + 'ms'},
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
      state.timeView = {startTime: T.now() - halfWeek, duration: week}
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
