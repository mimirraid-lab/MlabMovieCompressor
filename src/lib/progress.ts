import type { Progress } from "../types";

export function progressTitle(progress: Pick<Progress, "pass">): string {
  return `圧縮しています… ${progress.pass}/2`;
}

export function progressPercent(progress: Pick<Progress, "percent">): number {
  return Math.min(100, Math.max(0, progress.percent));
}
