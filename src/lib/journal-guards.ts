import { daysBetween, MAX_RECORD_SECONDS } from "@/lib/economy";

export function assertOwnedStoragePath(userId: string, path: string | null) {
  if (path && !path.startsWith(`${userId}/`)) {
    throw new Error("Недопустимый путь файла");
  }
}

export function assertNearbyEntryDate(entryDate: string, serverToday: string) {
  if (Math.abs(daysBetween(serverToday, entryDate)) > 1) {
    throw new Error("Некорректная дата записи");
  }
}

export function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

export function isAllowedJournalDuration(seconds: number) {
  return Number.isInteger(seconds) && seconds >= 1 && seconds <= MAX_RECORD_SECONDS + 5;
}
