import { describe, it, expect } from "vitest"
import { parseArithmeticExpression, formatExpressionDisplay } from "./arithmeticParser"

describe("arithmeticParser", () => {
  it("parses multi-term addition expressions accurately", () => {
    // Required examples from prompt:
    const res1 = parseArithmeticExpression("10+350+10")
    expect(res1.isValid).toBe(true)
    expect(res1.value).toBe(370)
    expect(res1.normalizedExpression).toBe("10 + 350 + 10")

    const res2 = parseArithmeticExpression("10+100+30+300")
    expect(res2.isValid).toBe(true)
    expect(res2.value).toBe(440)
    expect(res2.normalizedExpression).toBe("10 + 100 + 30 + 300")

    const res3 = parseArithmeticExpression("50+25")
    expect(res3.isValid).toBe(true)
    expect(res3.value).toBe(75)

    const res4 = parseArithmeticExpression("120")
    expect(res4.isValid).toBe(true)
    expect(res4.value).toBe(120)

    const res5 = parseArithmeticExpression("0+45+5")
    expect(res5.isValid).toBe(true)
    expect(res5.value).toBe(50)
  })

  it("handles whitespace around operators and numbers", () => {
    const res = parseArithmeticExpression(" 10 +  350 + 10 ")
    expect(res.isValid).toBe(true)
    expect(res.value).toBe(370)
    expect(res.normalizedExpression).toBe("10 + 350 + 10")
  })

  it("supports decimal amounts", () => {
    const res = parseArithmeticExpression("12.50+30.25+7.25")
    expect(res.isValid).toBe(true)
    expect(res.value).toBe(50)
    expect(res.normalizedExpression).toBe("12.50 + 30.25 + 7.25")
  })

  it("identifies incomplete expressions (trailing plus)", () => {
    const res = parseArithmeticExpression("10+")
    expect(res.isValid).toBe(false)
    expect(res.isIncomplete).toBe(true)
    expect(res.value).toBe(null)

    const res2 = parseArithmeticExpression("10 + 350 + ")
    expect(res2.isValid).toBe(false)
    expect(res2.isIncomplete).toBe(true)
  })

  it("rejects invalid characters, operators, and syntax", () => {
    expect(parseArithmeticExpression("10-5").isValid).toBe(false)
    expect(parseArithmeticExpression("10*5").isValid).toBe(false)
    expect(parseArithmeticExpression("10++20").isValid).toBe(false)
    expect(parseArithmeticExpression("+20").isValid).toBe(false)
    expect(parseArithmeticExpression("abc+10").isValid).toBe(false)
    expect(parseArithmeticExpression("").isValid).toBe(false)
  })

  it("formats expression and total for saved table cell display", () => {
    const display1 = formatExpressionDisplay("10+350+10", 370, (v) => `₹${v.toFixed(2)}`)
    expect(display1).toBe("10 + 350 + 10 = ₹370.00")

    const display2 = formatExpressionDisplay("120", 120, (v) => `₹${v.toFixed(2)}`)
    expect(display2).toBe("₹120.00")

    const display3 = formatExpressionDisplay(null, null)
    expect(display3).toBe("—")
  })
})
