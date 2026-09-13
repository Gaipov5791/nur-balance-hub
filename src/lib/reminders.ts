export const DEFAULT_REMINDER_TIME = "21:00";
export const DEFAULT_REMINDER_TIMEZONE = "Asia/Almaty";
export const REMINDER_WINDOW_MINUTES = 15;

export const REMINDER_KIND = "journal_reminder";
export const REMINDER_TITLE = "Как прошёл день?";
export const REMINDER_BODY = "Запишите видео";
export const REMINDER_SUBJECT = "Как прошёл день? Запишите видео";

export type ReminderCandidate = {
  reminder_enabled: boolean;
  reminder_time: string;
  reminder_timezone: string;
  last_entry_date: string | null;
  last_reminder_sent_on: string | null;
};

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_REMINDER_TIMEZONE;
  } catch {
    return DEFAULT_REMINDER_TIMEZONE;
  }
}

export function safeTimeZone(timeZone: string | null | undefined): string {
  const value = timeZone?.trim() || DEFAULT_REMINDER_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return DEFAULT_REMINDER_TIMEZONE;
  }
}

export function normalizeReminderTime(value: string | null | undefined): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(value?.trim() ?? "");
  if (!match) return DEFAULT_REMINDER_TIME;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) {
    return DEFAULT_REMINDER_TIME;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseTimeToMinutes(value: string | null | undefined): number {
  const [hours, minutes] = normalizeReminderTime(value).split(":").map(Number);
  return hours * 60 + minutes;
}

export function localDateInZone(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function localMinutesInZone(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: safeTimeZone(timeZone),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function isInReminderWindow(
  now: Date,
  reminderTime: string,
  timeZone: string,
  windowMinutes = REMINDER_WINDOW_MINUTES,
): boolean {
  const current = localMinutesInZone(now, timeZone);
  const start = parseTimeToMinutes(reminderTime);
  const end = start + windowMinutes;
  if (end <= 24 * 60) return current >= start && current < end;
  return current >= start || current < end - 24 * 60;
}

export function shouldSendReminder(profile: ReminderCandidate, now: Date): boolean {
  if (!profile.reminder_enabled) return false;
  const timeZone = safeTimeZone(profile.reminder_timezone);
  const localDate = localDateInZone(now, timeZone);
  if (profile.last_entry_date === localDate) return false;
  if (profile.last_reminder_sent_on === localDate) return false;
  return isInReminderWindow(now, profile.reminder_time, timeZone);
}

export function appPublicUrl(): string {
  const raw =
    (typeof process !== "undefined" &&
      (process.env["APP_URL"] || process.env["VITE_APP_URL"])) ||
    "https://nur-balance-hub.lovable.app";
  return raw.replace(/\/$/, "");
}
