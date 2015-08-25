const R = require('ramda')
const Type = require('union-type')
const h = require('snabbdom/h')
const Future = require('ramda-fantasy').Future

import {putTask} from './db'

const c = R.compose
const _ = undefined // jshint ignore:line

const promToFut = (promFn) => Future((rej, res) => promFn().then(res, rej))


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
  Saved: [String],
})

export const update = Action.caseOn({
  ToggleDone: R.over(doneL, R.not),
  SetKey: R.set(keyL),
  ToggleFold: R.over(openL, R.not),
  Saved: R.identity,
})

export const updateE = (action, model) =>
  Action.case({
    Saved: () => [model, []],
    _: () => {
      const newModel = update(action, model)
      return [newModel, [R.map(c(Action.Saved, R.head), promToFut(() => putTask(newModel)))]]
    },
  }, action)

// View

export const view = (actions, model) => {
}
