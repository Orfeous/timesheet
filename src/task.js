const R = require('ramda')
const Type = require('union-type')
const h = require('snabbdom/h')


const _ = undefined // jshint ignore:line

// Model

export const init = (parentTask, title) => {
  const newTask = {title, open: false, done: false, key: undefined}
  if (parentTask === _) {
    newTask.atRoot = 1
  } else {
    newTask.parent = parentTask.key
  }
  return newTask
}

// Update

const doneL = R.lensProp('done')
const keyL = R.lensProp('key')
const openL = R.lensProp('open')

export const Action = Type({
  ToggleDone: [],
  ToggleFold: [],
  SetKey: [String],
})

export const update = Action.caseOn({
  ToggleDone: R.over(doneL, R.not),
  SetKey: R.set(keyL),
  ToggleFold: R.over(openL, R.not),
})

// View

export const view = (actions, model) => {
}
