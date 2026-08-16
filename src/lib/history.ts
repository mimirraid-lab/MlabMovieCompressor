/** Newest-first, distinct display of the latest four actual requests. */
export function recentSizes(values: number[]): number[] {
  const result: number[] = [];
  for (const value of values.slice(-4).reverse()) {
    if (!result.includes(value)) result.push(value);
  }
  return result;
}

export function formatSizeInput(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}
