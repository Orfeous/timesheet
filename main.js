const E = require('../hareactive/event')
const B = require('../hareactive/behavior')

const snabbdom = require('snabbdom');
const patch = snabbdom.init([
  require('snabbdom/modules/class'),
  require('snabbdom/modules/hero'),
  require('snabbdom/modules/style'),
  require('snabbdom/modules/eventlisteners'),
])
const h = require('snabbdom/h')
const attachTo = require('snabbdom/helpers/attachto')

var canvas, ctx
// Behaviors
const sizeB = B.BehaviorK({x: 0, y: 0})

const scrollY = B.BehaviorK(0)
var scrollX = 0
var scrollGestureInitiated = false

var lastPos = {x: 0, y: 0}

var domRender

// Helper functions
const noop = () => {}
const listen = (elm, event, cb) => elm.addEventListener(event, cb, false)
const part = (fn, ...args) => (...args2) => fn.apply(undefined, args.concat(args2))

const tasks = [
  {title: 'Eat pomegranate', open: false, children: [
    {title: 'Hole fruit', open: false, children: []},
    {title: 'Nasty smoothie', open: false, children: []},
  ]},
  {title: 'Snabbdom', open: false, children: [
    {title: 'JSX', open: false, children: []},
    {title: 'Animation documentation', open: false, children: [
      {title: 'Delayed style', open: false, children: []},
      {title: 'Hooks', open: false, children: []},
    ]},
    {title: 'SVG', open: false, children: []},
    {title: 'Render to text', open: false, children: []},
  ]},
  {title: 'Timesheet', open: false, children: [
    {title: 'Animations', open: false, children: [
      {title: 'Unfold', open: false, children: []},
      {title: 'Options buttons apperance', open: false, children: []},
      {title: 'Something', open: false, children: []},
      {title: 'Event more', open: false, children: []},
    ]},
    {title: 'Activity creation', open: false, children: [
      {title: 'Bloah', open: false, children: []},
      {title: 'Pli', open: false, children: []},
      {title: 'Husly', open: false, children: []},
    ]},
  ]},
  {title: 'Call housing association', open: false, children: []},
]

const render = (canvas, ctx) => {
  const w = canvas.width
  const h = canvas.height
  ctx.fillStyle = '#cfcfcf'
  ctx.clearRect(0, 0, w, h)
  for (var i = 0; i < 100; ++i) {
    ctx.fillRect(scrollX + i * 80, 0, 1, h)
  }
  ctx.fillStyle = '#7a7a7a'
  for (var i = 0; i < 100; ++i) {
    ctx.fillText(i + ' July', scrollX + i * 80 + 5, 15)
  }
}

listen(document, 'DOMContentLoaded', () => {
  canvas = document.getElementById('canvas')
  ctx = canvas.getContext('2d')

  B.push(sizeB, {x: window.innerWidth, y: window.innerHeight})
  window.addEventListener('resize', () =>
    B.push(sizeB, {x: window.innerWidth, y: window.innerHeight})
  )

  listen(document, 'touchstart', touchStart)
  listen(document, 'touchend', touchEnd)
  listen(document, 'touchcancel', touchCancel)
  listen(document, 'touchmove', touchMove)

  B.on((dim) => {
    canvas.width = dim.x * window.devicePixelRatio
    canvas.style.width = dim.x + 'px'
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  }, sizeB)

  requestAnimationFrame(function frame() {
    render(canvas, ctx)
    requestAnimationFrame(frame)
  })

  domRender = domRenderer()
  domRender()
  adjustHeight(canvas, ctx)
})

const adjustHeight = () => {
  const listElm = document.getElementById('tasks')
  const rect = listElm.getBoundingClientRect()
  canvas.height = (rect.height | 0) * window.devicePixelRatio
  canvas.style.height = rect.height | 0
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
}

// Handle gestures
const touchStart = (ev) => {
  scrollGestureInitiated = false
  const touch = ev.changedTouches[0];
  lastPos.x = touch.pageX
  lastPos.y = touch.pageY
}

const touchEnd = (ev) => {
}

const touchCancel = (ev) => {
}

const touchMove = (ev) => {
  const touch = ev.changedTouches[0];
  const x = touch.pageX
  const y = touch.pageY
  if (Math.abs(x - lastPos.x) > 30 && scrollGestureInitiated === false) {
    ev.preventDefault()
    scrollGestureInitiated = true
    lastPos.x = x
    lastPos.y = y
  } else if (scrollGestureInitiated === true) {
    ev.preventDefault()
    B.push(scrollY, B.at(scrollY) + (y - lastPos.y))
    scrollX += x - lastPos.x
    lastPos.x = x
    lastPos.y = y
  }
}

const toggleFold = (task, elm) => {
  if (task.children.length > 0) {
    task.open = !task.open
    domRender()
    adjustHeight()
  }
}

const openTimerModal = (task, ev) => {
  task.timerModalOpen = true;
  domRender()
}

const closeTimerModal = (task, ev) => {
  task.timerModalOpen = false;
  domRender()
}

const startTimer = (task, duration) => {
  const now = Date.now()
  task.timerModalOpen = false
  task.timerStartedAt = now
  task.timerEndsAt = duration !== undefined ? now + duration : undefined
  domRender()
}

// View

const startTimerModal = (task) =>
  h('div.begin-session', [
    h('div.btn', {on: {click: part(startTimer, task, undefined)}}, 'Stop timer manually'),
    h('h2', 'or after'),
    h('table', [
      h('tr', [
        h('td.btn', '10s'),
        h('td.btn', '5m'),
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

const timerModal = (task) =>
  h('div', [
    'Session started!', h('br'),
    task.timerStartedAt, h('br'),
    task.timerEndsAt || 'never ends',
  ])

const vtask = (task) =>
  h('li', {
    class: {folded: !task.open}
  }, [
    h('div.task-line', [
      h('div.title', {on: {click: [toggleFold, task]}}, task.title),
      h('div', {on: {click: part(openTimerModal, task)}}, 'BEGIN!'),
    ]),
    task.open ? h('ul', task.children.map(vtask)) : '',
    task.timerModalOpen ? modal(startTimerModal(task), part(closeTimerModal, task)) : '',
    task.timerStartedAt ? modal(timerModal(task), noop) : '',
  ])

const vtree = (state) =>
  h('div#container', [
    h('ul#tasks', tasks.map(vtask))
  ])

const domRenderer = () => {
  var oldVtree = document.getElementById('container')
  return (state) => oldVtree = patch(oldVtree, vtree(state))
}

const modal = (vnode, rmCb) => attachTo(document.body, h('div.modal', [
  h('div.modal-backdrop', {on: {click: rmCb}}),
  vnode
]))
