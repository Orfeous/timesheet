var assert = require('assert')
var T = require('../time')

describe('time', () => {
  describe('daysBetween', () => {
    it('returns correct number of days', () => {
      assert.equal(T.daysBetween(T.now(), T.now()).length, 1)
      assert.equal(T.daysBetween(T.now(), T.now() + T.day).length, 2)
      assert.equal(T.daysBetween(T.now() - T.day, T.now() + T.day).length, 3)
      assert.equal(T.daysBetween(T.now(), T.now() + 2 * T.day).length, 3)
    })
  })
})
