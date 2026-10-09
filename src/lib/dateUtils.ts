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
