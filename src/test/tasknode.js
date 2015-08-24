const assert = require('assert')
const Task = require('../task')
const {init, Action, update, view} = require('../tasknode.js')

describe('task node', () => {
  describe('update', () => {
    describe('AppendChild', () => {
      it('appends child', () => {
        const task = Task.init(undefined, 'Task')
        const node = init(undefined, task, [])
        assert.equal(node.children.length, 0)
        const childTask = Task.init(undefined, 'Child task')
        const childNode = init(undefined, childTask, [])
        const node2 = update(Action.AppendChild(childNode), node)
        assert.equal(node2.children.length, 1)
      })
    })
    describe('UpdateTask', () => {
      it('passes action to task', () => {
        const task = Task.init(undefined, 'Task')
        const node = init(undefined, task, [])
        assert.equal(node.task.done, false)
        const node2 = update(Action.UpdateTask(Task.Action.ToggleDone()), node)
        assert.equal(node2.task.done, true)
      })
    })
    describe('UpdateChild', () => {
      it('passes action to child node', () => {
        const task = Task.init(undefined, 'Task')
        const node = init(undefined, task, [])
        const childTask = Task.update(Task.Action.SetKey('foo'), Task.init(undefined, 'Child task'))
        const childNode = init(undefined, childTask, [])
        const node2 = update(Action.AppendChild(childNode), node)
        assert.strictEqual(node2.children[0].task.done, false)
        const node3 = update(Action.UpdateChild('foo', Action.UpdateTask(Task.Action.ToggleDone())), node2)
        assert.strictEqual(node3.children[0].task.done, true)
      })
    })
    describe('ToggleOptionsModal', () => {
      it('toggles the modal flag', () => {
        const task = Task.init(undefined, 'Task')
        const node = init(undefined, task, [])
        assert.strictEqual(node.showOptionsModal, false)
        assert.strictEqual(update(Action.ToggleOptionsModal(), node).showOptionsModal, true)
      })
    })
  })
})
