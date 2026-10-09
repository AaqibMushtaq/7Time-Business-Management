import { describe, it, expect } from "vitest";
import { getPreviousMonth, getNextMonth } from "./dateUtils";

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
});
