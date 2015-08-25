const syncedDB = require('synceddb-client')

// Database
const stores = {
  tasks: [
    ['byParent', 'parent'],
    ['atRoot', 'atRoot'],
  ],
  sessions: [
    ['byTask', 'taskKeys', {multiEntry: true}],
    ['byStartTime', 'startTime'],
    ['byEndTime', 'endTime'],
    ['byDay', 'day'],
    ['inDay', 'days', {multiEntry: true}],
  ]
}

const migrations = {
  2: (IDBDb, ev) => {
    db.transaction(['sessions'], 'rw', function(sessions) {
      sessions.byStartTime.getAll().then((ses) => {
        map((s) => {
          s.days = T.daysBetween(s.startTime, s.endTime)
          sessions.put(s)
        }, ses)
      })
    }).then(() => console.log('saved'))
  }
}

export const db = syncedDB.open({
  name: 'timeApp',
  version: 2,
  stores: stores,
  migrations: migrations,
})

export const putTask = (t) => db.tasks.put(t)
