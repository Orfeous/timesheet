const assert = require('assert')
const Task = require('../task')
const {init, Action, update, view} = require('../task')

describe('time', () => {
  describe('update', () => {
    describe('ToggleDone', () => {
      it('toggles done property', () => {
        assert.deepEqual(update(Action.ToggleDone(), {title: 'Foo', done: false}),
                         {title: 'Foo', done: true})
        assert.deepEqual(update(Action.ToggleDone(), {title: 'Bar', done: true}),
                         {title: 'Bar', done: false})
      })
    })
    describe('ToggleFold', () => {
      it('toggles fold property', () => {
        const task = init(undefined, 'Task')
        assert.deepEqual(task.open, false)
        assert.deepEqual(update(Action.ToggleFold(), task).open, true)
      })
    })
    describe('SetKey', () => {
      it('sets key to string', () => {
        const task = init(undefined, 'Task')
        assert.equal(task.key, undefined)
        assert.equal(update(Action.SetKey('foo'), task).key, 'foo')
      })
    })
  })
})
