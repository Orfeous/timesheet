const snabbdom = require('snabbdom');
const patch = snabbdom.init([
  require('snabbdom/modules/class'),
  require('snabbdom/modules/hero'),
  require('snabbdom/modules/style'),
  require('snabbdom/modules/eventlisteners'),
])
const h = require('snabbdom/h')
const attachTo = require('snabbdom/helpers/attachto')

const prmColor = '#801e74'
const secColor = '#1cc6ae'

var canvas, ctx
var windowWidth = 0
var canvasHeight = 0
var containerRect = {width: 0, height: 0}

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

var scrollX = 0

const SCROLL_UNDETERMINED = 0
const SCROLL_VERTICAL = 1
const SCROLL_HORIZONTAL = 2
var scrollDirection = SCROLL_UNDETERMINED

var lastPos = {x: 0, y: 0}

var domRender

// Helper functions
const noop = () => {}
const part = (fn, ...args) => (...args2) => fn.apply(undefined, args.concat(args2))
const pull = (elm, list) => (list.splice(list.indexOf(elm), 1), list)
const last = (arr) => arr[arr.length - 1]
const isLastOf = (elm, arr) => elm === last(arr)
const log = (name, val) => (console.log(name, val), val)
const isEven = (n) => n % 2 === 0
const map = (fn, list) => {
  const res = []
  for (let i = 0, l = list.length; i < l; ++i) res[i] = fn(list[i])
  return res
}
const fromTo = (i, n) => {
  const res = []
  for (; i <= n; ++i) res[i] = i
  return res
}

Function.prototype.$ = function(...args) {
  return (...args2) => this.apply(undefined, args.concat(args2))
}

// Snabbdom helpers
const indentColorNames = ['yellow', 'orange', 'red', 'magenta', 'violet', 'blue', 'cyan', 'green']
const indentColors = ['#b58900', '#cb4b16', '#dc322f', '#d33682', '#6c71c4', '#268bd2', '#2aa198', '#859900']
const colorAtIndent = (n) => indentColors[isEven(n) ? n / 2 : (n - 1) / 2 + 4]
// DOM helper functions
const listen = (elm, event, cb) => elm.addEventListener(event, cb, false)
const targetValue = (ev) => ev.target.value

const defaultTasks = [
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

const restoredState = localStorage.getItem('state')
const state = restoredState !== null ? JSON.parse(restoredState) : {
  tasks: defaultTasks,
  newTask: undefined,
}
const tasks = state.tasks

const render = (canvas, ctx) => {
  const w = canvas.width
  const h = canvas.height
  if (containerRect.width !== w || containerRect.height !== h) {
    resizeCanvas(canvas, containerRect)
  } else {
    ctx.clearRect(0, 0, w, h)
  }
  ctx.fillStyle = base2
  ctx.fillRect(0, 0, w, 24)
  ctx.fillStyle = base1
  for (let i = 0; i < 100; ++i) {
    ctx.fillStyle = base1
    ctx.fillRect(scrollX + i * 80, 0, 1, 24)
    ctx.fillStyle = base2
    ctx.fillRect(scrollX + i * 80, 24, 1, h-24)
  }
  ctx.fillStyle = base00
  for (let i = 0; i < 100; ++i) {
    ctx.fillText(i + ' July', scrollX + i * 80 + 5, 15)
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
  domRender = domRenderer()
  domRender()
  setTimeout(() => updateContainerRect(canvas, ctx), 200)

  canvas = document.getElementById('canvas')
  ctx = canvas.getContext('2d')

  const content = document.getElementById('task-container')
  listen(content, 'resize', updateContainerRect)
  listen(content, 'touchstart', touchStart)
  listen(content, 'touchend', touchEnd)
  listen(content, 'touchcancel', touchCancel)
  listen(content, 'touchmove', touchMove)

  requestAnimationFrame(function frame() {
    render(canvas, ctx)
    requestAnimationFrame(frame)
  })
})

const updateContainerRect = () => {
  const rect = document.getElementById('task-container').getBoundingClientRect()
  containerRect.width = rect.width | 0
  containerRect.height = rect.height | 0
}

// Handle gestures

const touchStart = (ev) => {
  scrollDirection = SCROLL_UNDETERMINED
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
  if (scrollDirection === SCROLL_UNDETERMINED) {
    if (Math.abs(x - lastPos.x) > 30) {
      ev.preventDefault()
      scrollDirection = SCROLL_HORIZONTAL
      lastPos.x = x
      lastPos.y = y
    } else if (Math.abs(y - lastPos.y) > 30) {
      scrollDirection = SCROLL_VERTICAL
    }
  } else if (scrollDirection === SCROLL_HORIZONTAL) {
    ev.preventDefault()
    scrollX += x - lastPos.x
    lastPos.x = x
    lastPos.y = y
  }
}

// Modify state

const toggleFold = (task, elm) => {
  if (task.children.length > 0) {
    task.open = !task.open
    domRender()
    updateContainerRect()
  }
}

const toggleDone = (task) => {
  task.done = !task.done
  domRender()
}

const toggleTimerModal = (task, ev) => {
  task.timerModalOpen = !task.timerModalOpen
  domRender()
}

const startTimer = (task, duration) => {
  const now = Date.now()
  task.timerModalOpen = false
  task.timerStartedAt = now
  task.timerEndsAt = duration !== undefined ? now + duration : undefined
  domRender()
}

const endTimer = (task) => {
  task.timerStartedAt = undefined
  domRender()
}

const toggleOptionsMenu = (task) => {
  task.showOptionsMenu = !task.showOptionsMenu
  domRender()
}

const beginCreateTask = (parent) => {
  if (parent) parent.showOptionsMenu = false
  state.newTask = {name: '', parent: parent}
  domRender()
}

const dropNewTask = () => {
  state.newTask = undefined
  domRender()
}

const deleteTask = (task, parent) => {
  task.showOptionsMenu = undefined
  domRender()
  if (parent !== undefined) {
    pull(task, parent.children)
    if (parent.children.length === 0) parent.open = false
  } else {
    pull(task, state.tasks)
  }
  domRender()
  updateContainerRect()
}

const updateNewSubtaskName = (task, ev) => {
  state.newTask.name = targetValue(ev)
}

const createNewTask = (newTask, ev) => {
  ev.preventDefault()
  const target = newTask.parent ? newTask.parent.children : state.tasks
  if (newTask.parent) newTask.parent.open = true
  target.push({title: newTask.name, open: false, children: []})
  state.newTask = undefined
  domRender()
  updateContainerRect()
}

// View

const startTimerModal = (task) =>
  h('div.begin-session', [
    h('div.btn.btn-block', {on: {click: startTimer.$(task, undefined)}}, 'Stop timer manually'),
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

const createSubtaskModal = (task) =>
  h('div', [
    h('h2', 'Create subtask'),
    h('form', {on: {submit: createNewTask.$(task)}}, [
        h('input', {on: {input: updateNewSubtaskName.$(task)}})
    ])
  ])

const taskOptionsModal = (parent, task) =>
  h('div', {style: {}}, [
    h('div.btn.btn-block', {style: {marginBottom: '.5em'}, on: {click: beginCreateTask.$(task)}}, 'Create subtask'),
    h('div.btn.btn-block.btn-danger', {on: {click: deleteTask.$(task, parent)}}, 'Delete task'),
  ])

const foldIndicator = (task) =>
  h('div.fold-indicator', {
    on: {click: [toggleFold, task]},
  }, [h('i.fa.fa-chevron-right', {
    style: {transform: `rotate(${task.open ? 90 : 0}deg)`},
  })])

const doneCheckbox = (task) =>
  h('div.fold-indicator', {
    on: {click: [toggleDone, task]},
  }, [task.done ? h('i.fa.fa-check-square') : h('i.fa.fa-square-o')])

const vtask = (parent, level, task) => {
  const isLast = parent && isLastOf(task, parent.children)
  const indentationChange = task.open || isLast
  return h('li.task', {
    class: {folded: !task.open},
  }, [
    h('div.task-line', {
      style: {opacity: 0, transform: 'translateY(0px)',
              delayed: {opacity: 1, transform: 'translateY(0px)'}},
    },// [
      /*
      h('div.indent-indicator', {
        class: {'indent-top-half': indentationChange},
        style: {marginLeft: `${level/2}em`}
      }),
      indentationChange ? h('div.indent-indicator.indent-bottom-half', {
        class: {},
        style: {marginLeft: `${level/2+(task.open ? 0.5 : -0.5)}em`}
      }) : '',
      */
    map((l) => h('div.indent-indicator', {
      class: {'indent-faded': l !== level},
      style: {marginLeft: `${l}em`, backgroundColor: colorAtIndent(l)}
    }), fromTo(0, level)).concat([
      task.children.length > 0 ? foldIndicator(task) : doneCheckbox(task),
      h('div.title-container', {
        on: {click: [toggleOptionsMenu, task]},
      }, [h('span.title', {
        class: {done: task.done},
        style: {color: !task.done ? colorAtIndent(level) : base1}
      }, task.title)]),
      h('div.start-timing-btn', {on: {click: toggleTimerModal.$(task)}}, [h('i.fa.fa-lg.fa-clock-o')]),
    ])),
    task.open ? h('ul', {style: {borderRadius: '0px'}}, map(vtask.$(task, level + 1), task.children)) : '',
    task.timerModalOpen ? modal(startTimerModal(task), toggleTimerModal.$(task)) : '',
    task.timerStartedAt ? modal(timerModal(task), endTimer.$(task)) : '',
    task.showOptionsMenu ? modal(taskOptionsModal(parent, task), toggleOptionsMenu.$(task)) : '',
  ])
}

const vtree = (state) =>
  h('div#container', [
    h('div.top-bar', [
      h('div.app-name', 'Timesheet'),
      h('i.menu-btn.fa.fa-ellipsis-v'),
    ]),
    h('div.top-bar-filler'),
    h('canvas#canvas'),
    h('div#task-container', [
      h('ul#tasks', tasks.map(vtask.$(undefined, 0))),
      h('div.btn', {style: {margin: '.2em'}, on: {click: beginCreateTask.$(undefined)}}, 'Create task'),
      state.newTask ? modal(createSubtaskModal(state.newTask), dropNewTask) : '',
    ])
  ])

const domRenderer = () => {
  var oldVtree = document.getElementById('container')
  return () => {
    oldVtree = patch(oldVtree, vtree(state))
    localStorage.setItem('state', JSON.stringify(state))
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
