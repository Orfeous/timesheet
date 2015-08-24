const attachTo = require('snabbdom/helpers/attachto')
const h = require('snabbdom/h')

export const delayRm = (t) => (_, cb) => setTimeout(cb, t)
export const focus = (vnode) => vnode.elm.focus()
export const modal = (vnode, rmCb) => attachTo(document.body, h('div.modal', {
    style: {opacity: 0, delayed: {opacity: 1}, remove: {opacity: 0}},
  }, [
    h('div.modal-backdrop', {
      on: {click: rmCb},
    }),
    vnode
  ]))
