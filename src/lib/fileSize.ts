/** UI calls this unit MB, but all calculations use binary mebibytes. */
export const BYTES_PER_MIB = 1_048_576;

export function targetMbToBytes(targetMb: number): number {
  return targetMb * BYTES_PER_MIB;
}

export function formatBytes(bytes: number): string {
  const sizeMb = bytes / BYTES_PER_MIB;
  return `${sizeMb.toFixed(bytes < 10 * BYTES_PER_MIB ? 1 : 0)} MB`;
}
