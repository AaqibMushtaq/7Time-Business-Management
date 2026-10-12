export function getPreviousMonth(selectedMonth: string): string {
  const [y, m] = selectedMonth.split("-").map(Number);
  const prev = new Date(y, m - 2, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

export function getNextMonth(selectedMonth: string): string {
  const [y, m] = selectedMonth.split("-").map(Number);
  const next = new Date(y, m, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthDisplay(monthStr: string, locale = "en-IN"): string {
  const [y, m] = monthStr.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
}

export function formatDateRow(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const dayStr = String(day).padStart(2, "0");
  const monthStr = d.toLocaleDateString("en-GB", { month: "short" });
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  return { day: dayStr, month: monthStr, weekday, display: `${dayStr} ${monthStr}, ${weekday}` };
}

export function generateMonthDates(monthStr: string): string[] {
  const [year, month] = monthStr.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let i = 1; i <= lastDay; i++) {
    const day = String(i).padStart(2, "0");
    dates.push(`${year}-${String(month).padStart(2, "0")}-${day}`);
  }
  return dates;
}
