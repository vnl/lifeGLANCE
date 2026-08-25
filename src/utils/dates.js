import {
  differenceInYears,
  differenceInMonths,
  differenceInDays,
  differenceInCalendarDays,
  format,
} from 'date-fns'

// Returns the age (in whole years) at a given date, or null if birthday not set
// or the target date precedes the birthday.
export function ageAtDate(birthdayStr, targetDateStr) {
  if (!birthdayStr || !targetDateStr) return null
  const born   = new Date(birthdayStr)
  const target = new Date(targetDateStr)
  if (isNaN(born.getTime()) || isNaN(target.getTime())) return null
  if (target < born) return null
  return differenceInYears(target, born)
}

// Converts a UTC-midnight ISO date string to a local Date at noon so date-fns
// formatters always see the intended calendar day regardless of UTC offset.
function toLocalNoon(dateStr) {
  const d = new Date(dateStr)
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0)
}

export function relativeLabel(dateStr, precision = 'day') {
  const date = toLocalNoon(dateStr)
  const now  = new Date()

  // Use calendar-day distance so "today", "yesterday", and "tomorrow"
  // are correct regardless of the current time of day.
  const dayDiff = differenceInCalendarDays(date, now)
  if (dayDiff === 0) return 'today'

  const past   = dayDiff < 0
  const days   = Math.abs(dayDiff)
  const from   = past ? date : now
  const to     = past ? now : date
  const years  = differenceInYears(to, from)
  const months = differenceInMonths(to, from) % 12

  if (past) {
    if (years > 0 && months > 0) return `${years} yr${years !== 1 ? 's' : ''}, ${months} mo ago`
    if (years > 0)               return `${years} yr${years !== 1 ? 's' : ''} ago`
    if (days > 30)               return `${Math.floor(days / 30)} mo ago`
    return `${days} day${days !== 1 ? 's' : ''} ago`
  }

  if (years > 0 && months > 0) return `in ${years} yr${years !== 1 ? 's' : ''}, ${months} mo`
  if (years > 0)               return `in ${years} yr${years !== 1 ? 's' : ''}`
  if (days > 30)               return `in ${Math.floor(days / 30)} mo`
  return `in ${days} day${days !== 1 ? 's' : ''}`
}

export function formatDateDisplay(dateStr, precision = 'day') {
  const date = toLocalNoon(dateStr)
  if (precision === 'year')  return format(date, 'yyyy')
  if (precision === 'month') return format(date, 'MMMM yyyy')
  return format(date, 'MMMM d, yyyy')
}

// Returns { years, months } elapsed/remaining for count-up animation
export function getYearsMonths(dateStr) {
  const date = toLocalNoon(dateStr)
  const now  = new Date()
  const past = date < now
  const a = past ? date : now
  const b = past ? now  : date
  return {
    years:  differenceInYears(b, a),
    months: differenceInMonths(b, a) % 12,
    days:   differenceInDays(b, a),
    past,
  }
}

export function buildDateFromParts(month, year, precision, day) {
  const y = Number(year)
  const m = Number(month) - 1
  if (precision === 'year')  return new Date(Date.UTC(y, 0, 1))
  if (precision === 'day')   return new Date(Date.UTC(y, m, Number(day) || 1))
  return new Date(Date.UTC(y, m, 15)) // month precision — use midpoint
}
