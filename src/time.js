export const millisecond = 1
export const second = 1000 * millisecond
export const minute = 60 * second
export const hour = 60 * minute
export const day = 24 * hour
export const week = 7 * day
export const halfWeek = week / 2
export const getDate = (t) => (new Date(t)).getDate()
export const getMonth = (t) => (new Date(t)).getMonth()
export const now = Date.now
export const daysIn = (t) => Math.floor(t / day)
export const daysBetween = (t1, t2) => {
  let low = daysIn(t1), high = daysIn(t2), res = []
  for (; low <= high; ++low) res.push(low)
  return res
}
