const R = require('ramda')
const Type = require('union-type')
const h = require('snabbdom/h')
import * as Task from './task'
const treis = require('treis')
const Future = require('ramda-fantasy').Future

const _ = undefined // jshint ignore:line
const c = R.compose
import {modal, delayRm} from './snabbdom-helpers'
import {putTask} from './db'

function updateWhere(pred, fn, list) {
  return R.map(function(elm) { return pred(elm) === true ? fn(elm) : elm; }, list);
}

const promToFut = (promFn) => Future((rej, res) => promFn().then(res, rej))

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

// Model

export const init = (parent, task, days) => ({
  task,
  parent,
  children: [],
  sessions: [],
  days,
  showOptionsModal: false,
})

// Update

const taskLens = R.lensProp('task')

export const Action = Type({
  UpdateTask: [Task.Action],
  UpdateChild: [String, Action],
  AppendChild: [Object],
  ToggleOptionsModal: [],
})

const keyL = c(R.lensProp('task'), R.lensProp('key'))
const childrenL = R.lensProp('children')

const updateChild = R.curry((key, action, children) =>
  R.reduce(([children, effects], child) => {
    if (child.task.key === key) {
      const [newChild, newEffects] = update(action, child)
      children.push(newChild)
      return [children, R.concat(effects, newEffects)]
    } else {
      children.push(child)
      return [children, effects]
    }
  }, [[], []], children))

const noEffect = (model) => [model, []]

// update : action -> model -> [model', [Futures]]
export const update = Action.caseOn({
  UpdateTask: (taskAction, model) => {
    const [newTask, effects] = Task.updateE(taskAction, model.task)
    return [R.set(taskLens, newTask, model), R.map(R.map(Action.UpdateTask), effects)]
  },
  UpdateChild: (key, action, model) => {
    const [newChildren, effects] = updateChild(key, action, model.children)
    return [R.set(childrenL, newChildren, model), effects]
  },
  AppendChild: (child, model) => noEffect(R.over(childrenL, R.append(child), model)),
  ToggleOptionsModal: c(noEffect, R.over(R.lensProp('showOptionsModal'), R.not)),
})

// View

const FOLD_IN = 0, FOLD_OUT = 1
const taskLineH = 51
const medDur = 200

const indentColors = ['#b58900', '#cb4b16', '#dc322f', '#d33682', '#6c71c4', '#268bd2', '#2aa198', '#859900']
const colorAtIndent = (n) => indentColors[n % 2 === 0 ? n / 2 : (n - 1) / 2 + 4]

const log = console.log.bind(log)

const doneCheckbox = (update, task) =>
  h('div.fold-indicator', {
    on: {click: [c(update, Action.UpdateTask, Task.Action.ToggleDone), task]},
  }, [h('div.checkbox', {class: {checked: task.done}}, [h('div', [h('div')])])])

const foldIndicator = (pos, nrOfSubtasks, node) =>
  h('a.fold-indicator', {
    on: {click: [log, pos, nrOfSubtasks, node]},
  }, [h('div.chevron', {class: {open: node.task.open}}, [h('div', [h('div')])])])

const taskOptionsModal = (parentChildren, node, pos, nrOfSubtasks) =>
  h('div', {style: {}}, [
    h('div.btn.btn-block', {
      style: {marginBottom: '.5em'}, on: {click: [log /*toggleFold*/, pos, nrOfSubtasks, node]}
    }, [h('i.fa.fa-chevron-right'), 'Unfold']),
    h('div.btn.btn-block', {
      style: {marginBottom: '.5em'}, on: {click: [log /*toggleTimerModal*/, node.task, node.children]}
    }, [h('i.fa.fa-clock-o'), 'Start timing']),
    h('div.btn.btn-block', {
      style: {marginBottom: '.5em'}, on: {click: [log /*beginCreateTask*/, node, node.children]}
    }, [h('i.fa.fa-plus'), 'Create subtask']),
    h('div.btn.btn-block.btn-danger', {
      on: {click: [log /*deleteTask*/, node, parentChildren]}
    }, [h('i.fa.fa-times'), 'Delete task']),
  ])

const subView = R.curry((children, foldedAt, foldDir, foldDiff, path, update, acc, node) =>
  view(children, foldedAt, foldDir, foldDiff, R.append(node.task.key, path), c(update, Action.UpdateChild(node.task.key)), acc, node))

export const view = R.curry((parentChildren, foldedAt, foldDir, foldDiff, path, update, [pos, nodes], model) => {
  const level = path.length
  const {task, children} = model
  const [newPos, subTasks] = task.open ? R.reduce(subView(children, foldedAt, foldDir, foldDiff, R.append(task.key, path), update), [pos + 1, []], children)
                                       : [pos + 1, []]
  const nrOfSubtasks = newPos - pos - 1
  return [newPos, R.append(h('li.task', {
    class: {folded: !task.open},
  }, [
    h('div.task-line', {
      style: {opacity: 0, transform: `translateY(${pos*taskLineH}px)`,
              transitionDuration: `${medDur}ms, ${medDur/2}ms`,
              transitionDelay: `${(pos-foldedAt)*medDur/6+(medDur/2)}ms, ${foldDir===FOLD_IN ? foldDiff*medDur/6+medDur : 0}ms`,
              delayed: {opacity: 1, transform: `translateY(${pos*taskLineH}px)`},
              destroy: {opacity: 0, transitionDelay: `${(foldDiff-(pos-foldedAt))*medDur/6}ms, 0ms`}},
    },
    R.map((l) => h('div.indent-indicator', {
      class: {'indent-faded': l !== level},
      style: {marginLeft: `${l*19}px`, backgroundColor: colorAtIndent(l)}
    }), R.range(0, level+1)).concat([
      task.hasSubtasks ? foldIndicator(pos, nrOfSubtasks, model) : doneCheckbox(update, task),
      h('a.title-container', {
        on: {click: [update, Action.ToggleOptionsModal()]},
      }, [h('span.title', {
        class: {done: task.done},
        style: {color: !task.done ? colorAtIndent(level) : base1}
      }, task.title)]),
      h('a.start-timing-btn', {on: {click: [console.log.bind(console), task]}}, [h('i.fa.fa-lg.fa-clock-o')]),
    ])),
    R.complement(R.isEmpty)(subTasks) ? h('ul', {hook: {remove: delayRm((newPos-pos-1)*medDur)}}, subTasks) : '',
    task.timerModalOpen ? modal(startSessionModal(model), toggleTimerModal.$(task)) : '',
    model.showOptionsModal ? modal(taskOptionsModal(parentChildren, model, pos, nrOfSubtasks), () => update(Action.ToggleOptionsModal())) : '',
  ]), nodes)]
})
