export const THEME_STORAGE_KEY = "nur-theme";

export const THEMES = [
  { id: "calm", label: "Спокойная", hint: "Песочный фон и тёмно-зелёный — как сейчас" },
  { id: "warm", label: "Тёплая", hint: "Тёплые абрикосовые и терракотовые оттенки" },
  { id: "dark", label: "Тёмная", hint: "Мягкий контраст для вечера" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export function normalizeTheme(value: string | null | undefined): ThemeId {
  if (value === "warm" || value === "dark" || value === "calm") return value;
  return "calm"; // legacy "light" and unknown values
}

export function readTheme(): ThemeId {
  if (typeof localStorage === "undefined") return "calm";
  try {
    return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "calm";
  }
}

export function applyTheme(theme: ThemeId) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  if (theme === "warm") root.setAttribute("data-theme", "warm");
  else root.removeAttribute("data-theme");
}

export function saveTheme(theme: ThemeId) {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}
