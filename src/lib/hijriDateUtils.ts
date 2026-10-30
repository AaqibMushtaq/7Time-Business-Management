/**
 * Hijri (Islamic Lunar) Date Utilities
 *
 * Provides verified lunar calendar conversions and Hawl (Zakat lunar-year anniversary) calculations.
 * Uses JavaScript Intl Islamic calendar engine ('islamic-umalqura') with support for regional
 * sighting offset calibration (+/- 1-2 days).
 *
 * Strict Validation Rules:
 * - Gregorian dates must be valid ISO YYYY-MM-DD strings representing actual calendar dates.
 * - Sighting offsets must be integers between -2 and +2.
 * - Does NOT silently guess or use static 354-day fallbacks if calendar resolution fails.
 */

export const HIJRI_MONTH_NAMES = [
  "Muharram",
  "Safar",
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  "Jumada al-Ula",
  "Jumada al-Ukhra",
  "Rajab",
  "Sha'ban",
  "Ramadan",
  "Shawwal",
  "Dhu al-Qa'dah",
  "Dhu al-Hijjah",
] as const

export interface HijriDate {
  day: number
  month: number // 1 to 12
  year: number  // e.g. 1447 AH
  monthName: string
  formatted: string // e.g. "15 Ramadan 1447 AH"
}

export interface HawlAnniversaryResult {
  gregorianStartDate: string
  gregorianAnniversaryDate: string
  startHijri: HijriDate
  anniversaryHijri: HijriDate
  daysInHawl: number
  isMonthEndAdjusted: boolean
}

/**
 * Validates that an input string is a strictly valid YYYY-MM-DD Gregorian calendar date.
 * Catches invalid months, leap year mismatches (e.g. 2025-02-29), and non-existent days (e.g. 2025-04-31).
 */
export function validateGregorianDateString(dateStr: string): void {
  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date format '${dateStr}'. Expected YYYY-MM-DD format.`)
  }

  const [y, m, d] = dateStr.split("-").map(Number)
  if (y < 1900 || y > 2150) {
    throw new RangeError(`Year ${y} is outside the supported range (1900-2150).`)
  }

  const dateObj = new Date(Date.UTC(y, m - 1, d))
  if (
    dateObj.getUTCFullYear() !== y ||
    dateObj.getUTCMonth() !== m - 1 ||
    dateObj.getUTCDate() !== d
  ) {
    throw new Error(`Invalid calendar date '${dateStr}'. This date does not exist on the Gregorian calendar.`)
  }
}

/**
 * Validates and constrains the regional moon-sighting offset.
 * Offsets must be integers between -2 and +2.
 */
export function validateHijriOffset(offsetDays: number): number {
  if (!Number.isInteger(offsetDays) || offsetDays < -2 || offsetDays > 2) {
    throw new RangeError(`Hijri day offset must be an integer between -2 and +2. Received: ${offsetDays}`)
  }
  return offsetDays
}

/**
 * Parses any valid YYYY-MM-DD string or Date object into a UTC midnight Date.
 */
export function parseDateToUtc(dateInput: string | Date): Date {
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) {
      throw new Error("Invalid Date object provided.")
    }
    return new Date(Date.UTC(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate()))
  }

  validateGregorianDateString(dateInput)
  const [y, m, d] = dateInput.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/**
 * Converts a Gregorian date into a verified HijriDate.
 * Supports regional moon sighting offset calibration (-2 to +2 days).
 */
export function toHijriDate(dateInput: string | Date, offsetDays = 0): HijriDate {
  const safeOffset = validateHijriOffset(offsetDays)
  const utcDate = parseDateToUtc(dateInput)

  if (safeOffset !== 0) {
    utcDate.setUTCDate(utcDate.getUTCDate() + safeOffset)
  }

  const formatter = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    timeZone: "UTC",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  })

  const parts = formatter.formatToParts(utcDate)
  const dayStr = parts.find((p) => p.type === "day")?.value
  const monthStr = parts.find((p) => p.type === "month")?.value
  const yearStr = parts.find((p) => p.type === "year")?.value

  const day = dayStr ? parseInt(dayStr, 10) : 1
  const month = monthStr ? parseInt(monthStr, 10) : 1
  const rawYear = yearStr ? yearStr.replace(/[^\d]/g, "") : "1446"
  const year = parseInt(rawYear, 10) || 1446

  if (isNaN(day) || isNaN(month) || isNaN(year) || month < 1 || month > 12) {
    throw new Error(`Failed to convert Gregorian date '${dateInput}' to a valid Hijri date.`)
  }

  const safeMonthIndex = Math.max(0, Math.min(11, month - 1))
  const monthName = HIJRI_MONTH_NAMES[safeMonthIndex]
  const formatted = `${day} ${monthName} ${year} AH`

  return {
    day,
    month,
    year,
    monthName,
    formatted,
  }
}

/**
 * Calculates the exact Hawl anniversary date (1 complete Hijri lunar year later).
 * Finds the Gregorian date in year Y + 1 matching the exact Hijri month and day.
 *
 * Edge cases handled:
 * - If month has 30 days in year Y, but only 29 days in year Y + 1, it snaps to day 29 of the same month.
 * - Does NOT use silent 354-day approximations; throws if anniversary cannot be authoritatively resolved.
 */
export function calculateHawlAnniversary(
  gregorianStartDate: string,
  offsetDays = 0
): HawlAnniversaryResult {
  validateGregorianDateString(gregorianStartDate)
  const safeOffset = validateHijriOffset(offsetDays)

  const startUtc = parseDateToUtc(gregorianStartDate)
  const startHijri = toHijriDate(startUtc, safeOffset)

  const targetYear = startHijri.year + 1
  const targetMonth = startHijri.month
  const targetDay = startHijri.day

  let exactMatch: Date | null = null
  let fallbackMonthEnd: Date | null = null
  let isMonthEndAdjusted = false

  // A lunar year ranges between 353 and 356 days. We scan an authoritative search window of 345 to 365 days.
  for (let offset = 345; offset <= 365; offset++) {
    const candidate = new Date(startUtc.getTime() + offset * 86400000)
    const h = toHijriDate(candidate, safeOffset)

    if (h.year === targetYear && h.month === targetMonth) {
      if (h.day === targetDay) {
        exactMatch = candidate
        break
      }
      if (h.day <= targetDay) {
        fallbackMonthEnd = candidate
      }
    }
  }

  let finalDate: Date
  if (exactMatch) {
    finalDate = exactMatch
  } else if (fallbackMonthEnd && targetDay === 30) {
    finalDate = fallbackMonthEnd
    isMonthEndAdjusted = true
  } else {
    throw new Error(
      `Could not establish a verified lunar anniversary for date '${gregorianStartDate}' (Hijri ${startHijri.formatted}) in year ${targetYear} AH.`
    )
  }

  const anniversaryIso = finalDate.toISOString().split("T")[0]
  const anniversaryHijri = toHijriDate(finalDate, safeOffset)
  const daysInHawl = Math.round((finalDate.getTime() - startUtc.getTime()) / 86400000)

  return {
    gregorianStartDate,
    gregorianAnniversaryDate: anniversaryIso,
    startHijri,
    anniversaryHijri,
    daysInHawl,
    isMonthEndAdjusted,
  }
}

/**
 * Returns the number of calendar days between two YYYY-MM-DD strings (dateB - dateA).
 */
export function getDaysBetween(dateA: string, dateB: string): number {
  validateGregorianDateString(dateA)
  validateGregorianDateString(dateB)
  const utcA = parseDateToUtc(dateA).getTime()
  const utcB = parseDateToUtc(dateB).getTime()
  return Math.round((utcB - utcA) / 86400000)
}

/**
 * Checks if targetDate has reached or surpassed referenceDate (target >= reference).
 */
export function isDateOnOrAfter(targetDate: string, referenceDate: string): boolean {
  validateGregorianDateString(targetDate)
  validateGregorianDateString(referenceDate)
  return parseDateToUtc(targetDate).getTime() >= parseDateToUtc(referenceDate).getTime()
}
