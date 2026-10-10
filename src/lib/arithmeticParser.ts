/**
 * Safe arithmetic expression parser for delivery amount entries.
 * Evaluates addition expressions (e.g., "10+350+10" -> 370) without using eval() or Function().
 */

export interface ExpressionParseResult {
  isValid: boolean
  isIncomplete: boolean
  value: number | null
  normalizedExpression: string
  errorMessage?: string
}

export function parseArithmeticExpression(rawInput: string | null | undefined): ExpressionParseResult {
  if (rawInput === null || rawInput === undefined) {
    return {
      isValid: false,
      isIncomplete: false,
      value: null,
      normalizedExpression: "",
      errorMessage: "Input is empty"
    }
  }

  const trimmed = rawInput.trim()
  if (!trimmed) {
    return {
      isValid: false,
      isIncomplete: false,
      value: null,
      normalizedExpression: "",
      errorMessage: "Input is empty"
    }
  }

  // Check for trailing operator indicating user is still typing (e.g. "10+")
  if (trimmed.endsWith("+")) {
    return {
      isValid: false,
      isIncomplete: true,
      value: null,
      normalizedExpression: trimmed,
      errorMessage: "Incomplete expression (ends with '+')"
    }
  }

  // Disallow invalid characters (only digits, dot, plus, and spaces are supported)
  if (!/^[\d\s.+]+$/.test(trimmed)) {
    return {
      isValid: false,
      isIncomplete: false,
      value: null,
      normalizedExpression: trimmed,
      errorMessage: "Invalid characters in expression. Only numbers and '+' are allowed."
    }
  }

  // Split by '+'
  const rawParts = trimmed.split("+")
  const normalizedTerms: string[] = []
  let sumCents = 0

  for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i].trim()
    if (!part) {
      // Empty part (e.g. "10++20" or leading "+20")
      return {
        isValid: false,
        isIncomplete: false,
        value: null,
        normalizedExpression: trimmed,
        errorMessage: "Invalid operator syntax"
      }
    }

    // Must be valid non-negative float/int
    if (!/^\d+(\.\d+)?$/.test(part)) {
      return {
        isValid: false,
        isIncomplete: false,
        value: null,
        normalizedExpression: trimmed,
        errorMessage: `Invalid number: "${part}"`
      }
    }

    const num = parseFloat(part)
    if (!Number.isFinite(num) || isNaN(num) || num < 0) {
      return {
        isValid: false,
        isIncomplete: false,
        value: null,
        normalizedExpression: trimmed,
        errorMessage: `Invalid number value: "${part}"`
      }
    }

    // Normalizing term representation (preserve decimals if present)
    normalizedTerms.push(part)
    // Add in cents to prevent JavaScript floating point inaccuracies (e.g. 0.1 + 0.2)
    sumCents += Math.round(num * 100)
  }

  const totalValue = sumCents / 100
  const normalizedExpression = normalizedTerms.join(" + ")

  return {
    isValid: true,
    isIncomplete: false,
    value: totalValue,
    normalizedExpression
  }
}

/**
 * Formats expression and total for display in table cell.
 * E.g. "10 + 350 + 10 = ₹370.00" or "₹120.00"
 */
export function formatExpressionDisplay(
  expression: string | null | undefined,
  amount: number | null | undefined,
  currencyFormatter: (val: number) => string = (v) => `₹${v.toFixed(2)}`
): string {
  const numericAmount = typeof amount === "number" ? amount : null

  if (expression && expression.includes("+")) {
    const parsed = parseArithmeticExpression(expression)
    const displayVal = numericAmount !== null ? numericAmount : parsed.value
    if (displayVal !== null) {
      return `${parsed.normalizedExpression || expression} = ${currencyFormatter(displayVal)}`
    }
    return expression
  }

  if (numericAmount !== null && numericAmount > 0) {
    return currencyFormatter(numericAmount)
  }

  return "—"
}
