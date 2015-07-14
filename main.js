const E = require('../hareactive/event')
const B = require('../hareactive/behavior')

var canvas, ctx
// Behaviors
const sizeB = B.BehaviorK({x: 0, y: 0})

const scrollY = B.BehaviorK(0)
var scrollX = 0
var scrollGestureInitiated = false

var lastPos = {x: 0, y: 0}

// Helper functions
const listen = (elm, event, cb) => elm.addEventListener(event, cb, false)
const part = (fn, args) => () => {
  for (var i = 0; i < arguments.length; ++i) args.push(arguments[i])
  return fn.apply(undefined, args)
}

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
  document.addEventListener('touchcancel', touchCancel)
  document.addEventListener('touchmove', touchMove)

  B.on((dim) => {
    canvas.width = dim.x * window.devicePixelRatio
    canvas.style.width = dim.x + 'px'
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  }, sizeB)

  requestAnimationFrame(function frame() {
    render(canvas, ctx)
    requestAnimationFrame(frame)
  })

  createTaskElms()
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

const addSubTasks = (task, elm) => {
  elm.classList.remove('folded')
  elm.classList.add('unfolded')
  var i, subTaskList = document.createElement('ul')
  for (i = 0; i < task.children.length; ++i) {
    var childElm = createTaskElm(task.children[i])
    subTaskList.appendChild(childElm)
  }
  elm.appendChild(subTaskList)
}

const rmSubTasks = (task, elm) => {
  elm.classList.add('folded')
  elm.classList.remove('unfolded')
  elm.removeChild(elm.querySelector('ul'))
}

const toggleFold = (task, elm) => {
  if (task.children.length > 0) {
    if (task.open === true) {
      task.open = false
      rmSubTasks(task, elm)
    } else {
      task.open = true
      addSubTasks(task, elm)
    }
  }
  adjustHeight()
}

const createTaskElm = (task) => {
  const elm = document.createElement('li')
  // Create line
  const taskLine = document.createElement('div')
  taskLine.classList.add('task-line')
  elm.appendChild(taskLine)
  // Create title elm
  const titleElm = document.createElement('div')
  titleElm.classList.add('title')
  titleElm.textContent = task.title
  listen(titleElm, 'click', part(toggleFold, [task, elm]))
  taskLine.appendChild(titleElm)
  // Create start button
  const startBtn = document.createElement('div')
  startBtn.textContent = 'BEGIN!'
  taskLine.appendChild(startBtn)
  if (task.open === true && task.children.length > 0) {
    addSubTasks(task, elm)
  } else {
    elm.classList.add('folded')
  }
  return elm
}

const createTaskElms = () => {
  const listElm = document.getElementById('tasks')
  for (var i = 0; i < tasks.length; ++i) {
    var elm = createTaskElm(tasks[i])
    listElm.appendChild(elm)
  }
}
