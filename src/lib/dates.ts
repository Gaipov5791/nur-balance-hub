export const MONTHS_GEN = [
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
] as const;

export const MONTHS_NOM = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;

export function formatRuDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_GEN[(m ?? 1) - 1]} ${y}`;
}

export function calendarMonth(now = new Date()) {
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    today: now.getDate(),
    monthLabel: `${MONTHS_NOM[now.getMonth()]} ${now.getFullYear()}`,
  };
}
