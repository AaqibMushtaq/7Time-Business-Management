import { describe, it, expect } from "vitest";
import { getPreviousMonth, getNextMonth, formatMonthDisplay, formatDateRow, generateMonthDates } from "./dateUtils";

describe("dateUtils", () => {
  describe("getPreviousMonth", () => {
    it("navigates back one month within the same year", () => {
      expect(getPreviousMonth("2024-05")).toBe("2024-04");
    });
    
    it("navigates from January to December of the previous year", () => {
      expect(getPreviousMonth("2024-01")).toBe("2023-12");
    });
    
    it("navigates across leap years safely (Feb)", () => {
      expect(getPreviousMonth("2024-03")).toBe("2024-02");
    });
  });

  describe("getNextMonth", () => {
    it("navigates forward one month within the same year", () => {
      expect(getNextMonth("2024-05")).toBe("2024-06");
    });

    it("navigates from December to January of the following year", () => {
      expect(getNextMonth("2024-12")).toBe("2025-01");
    });

    it("navigates across leap years safely (Feb)", () => {
      expect(getNextMonth("2024-01")).toBe("2024-02");
      expect(getNextMonth("2024-02")).toBe("2024-03");
    });
  });

  describe("formatMonthDisplay", () => {
    it("formats YYYY-MM to Long Month and Year", () => {
      const display = formatMonthDisplay("2026-10");
      expect(display).toContain("October");
      expect(display).toContain("2026");
    });
  });

  describe("formatDateRow", () => {
    it("formats date row correctly", () => {
      const row = formatDateRow("2026-10-12");
      expect(row.day).toBe("12");
      expect(row.month).toBe("Oct");
      expect(row.weekday).toBe("Mon");
      expect(row.display).toBe("12 Oct, Mon");
    });
  });

  describe("generateMonthDates", () => {
    it("generates correct number of days for October (31)", () => {
      const dates = generateMonthDates("2026-10");
      expect(dates.length).toBe(31);
      expect(dates[0]).toBe("2026-10-01");
      expect(dates[30]).toBe("2026-10-31");
    });

    it("generates correct number of days for February in a leap year (2024 = 29)", () => {
      const dates = generateMonthDates("2024-02");
      expect(dates.length).toBe(29);
      expect(dates[28]).toBe("2024-02-29");
    });
  });
});
