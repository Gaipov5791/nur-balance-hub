// Pure helpers for Telegram notifications to therapists (no secrets, safe anywhere).

export const APP_URL = "https://nur-balance-hub.lovable.app";

/** Kazakhstan uses a single UTC+5 offset since March 2024. */
export const ASTANA_OFFSET_HOURS = 5;

const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** "28 октября, 15:00" in Astana time. */
export function formatAstana(iso: string): string {
  const d = new Date(new Date(iso).getTime() + ASTANA_OFFSET_HOURS * 3600_000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "15:00" in Astana time. */
export function formatAstanaTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + ASTANA_OFFSET_HOURS * 3600_000);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function shorten(value: string, max = 200): string {
  const v = value.trim();
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
}

export const TG_STATUS_LABEL: Record<string, string> = {
  new: "ожидает подтверждения",
  in_progress: "в работе",
  scheduled: "подтверждена",
  done: "завершена",
  cancelled: "отменена",
};

export type OutboxKind = "new_request" | "status_changed" | "reminder_24h" | "reminder_1h" | "test";

export type RequestInfo = {
  client_name: string;
  preferred_time: string;
  topic: string;
  status: string;
  duration_minutes: number;
  scheduled_at: string | null;
};

export type TgMessage = {
  text: string;
  button?: { text: string; url: string };
};

function whenLine(r: RequestInfo): string {
  if (r.scheduled_at) return `${formatAstana(r.scheduled_at)} (время Астаны)`;
  return r.preferred_time?.trim() || "не указано";
}

function clientName(r: RequestInfo): string {
  return escapeHtml(shorten(r.client_name || "Клиент", 60));
}

/**
 * Builds the message for an outbox row. Returns null when the message is no
 * longer relevant (e.g. a reminder for a consultation that was cancelled).
 */
export function buildTelegramMessage(
  kind: OutboxKind,
  r: RequestInfo | null,
  payload: Record<string, unknown> = {},
  chatUrl?: string | null,
): TgMessage | null {
  const desk = { text: "Открыть кабинет", url: `${APP_URL}/therapist-desk` };

  if (kind === "test") {
    return {
      text: "✅ <b>Nur Balance</b>\nТестовое сообщение: уведомления о записях приходят сюда.",
      button: desk,
    };
  }
  if (!r) return null;

  if (kind === "new_request") {
    const lines = [
      "🆕 <b>Новая заявка на консультацию</b>",
      `Клиент: ${clientName(r)}`,
      `Длительность: ${r.duration_minutes} мин`,
      `Время: ${escapeHtml(whenLine(r))}`,
    ];
    if (r.topic?.trim()) lines.push(`Тема: ${escapeHtml(shorten(r.topic))}`);
    lines.push("", "Подтверди или отклони заявку в кабинете специалиста.");
    return { text: lines.join("\n"), button: desk };
  }

  if (kind === "status_changed") {
    const to = String(payload.to ?? r.status);
    const byClient = payload.by_client === true;
    const title =
      to === "cancelled" && byClient
        ? "❌ <b>Клиент отменил заявку</b>"
        : `ℹ️ <b>Статус заявки: ${escapeHtml(TG_STATUS_LABEL[to] ?? to)}</b>`;
    return {
      text: [title, `Клиент: ${clientName(r)}`, `Время: ${escapeHtml(whenLine(r))}`].join("\n"),
      button: desk,
    };
  }

  // Reminders only make sense for a confirmed consultation with a fixed time.
  if (r.status !== "scheduled" || !r.scheduled_at) return null;

  if (kind === "reminder_24h") {
    return {
      text: [
        "⏰ <b>Напоминание о консультации</b>",
        `Когда: ${escapeHtml(whenLine(r))}`,
        `Клиент: ${clientName(r)}`,
        `Длительность: ${r.duration_minutes} мин`,
      ].join("\n"),
      button: desk,
    };
  }

  return {
    text: [
      `⏳ <b>Консультация в ${formatAstanaTime(r.scheduled_at)}</b> (время Астаны)`,
      `Клиент: ${clientName(r)}`,
      `Длительность: ${r.duration_minutes} мин`,
      "",
      "Чат с клиентом — в приложении.",
    ].join("\n"),
    button: chatUrl ? { text: "Открыть чат", url: chatUrl } : desk,
  };
}
