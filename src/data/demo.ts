export type MoodKey = "calm" | "joy" | "anxiety" | "sadness" | "tired";

export const moods: Record<MoodKey, { label: string; emoji: string; tint: string }> = {
  calm: { label: "Спокойствие", emoji: "🌿", tint: "bg-primary-soft text-foreground" },
  joy: { label: "Радость", emoji: "☀️", tint: "bg-coin/40 text-foreground" },
  anxiety: { label: "Тревога", emoji: "🌀", tint: "bg-accent/25 text-foreground" },
  sadness: { label: "Грусть", emoji: "🌧️", tint: "bg-chart-4/25 text-foreground" },
  tired: { label: "Усталость", emoji: "🌙", tint: "bg-muted text-foreground" },
};

export const moodKeys = Object.keys(moods) as MoodKey[];

export type JournalEntry = {
  id: string;
  day: number;
  date: string;
  mood: MoodKey;
  level: number;
  duration: string;
  note: string;
};

export const journalEntries: JournalEntry[] = [
  { id: "e1", day: 1, date: "1 сентября", mood: "anxiety", level: 2, duration: "2:14", note: "Первый день после отпуска, много задач." },
  { id: "e2", day: 2, date: "2 сентября", mood: "tired", level: 2, duration: "1:48", note: "Плохо спала, но проговорила это вслух." },
  { id: "e3", day: 3, date: "3 сентября", mood: "calm", level: 4, duration: "2:52", note: "Дыхательная практика перед сном помогла." },
  { id: "e4", day: 4, date: "4 сентября", mood: "calm", level: 4, duration: "1:30", note: "Спокойный день, гуляла в парке." },
  { id: "e5", day: 5, date: "5 сентября", mood: "joy", level: 5, duration: "3:00", note: "Хорошие новости на работе." },
  { id: "e6", day: 6, date: "6 сентября", mood: "sadness", level: 2, duration: "2:05", note: "Скучаю по родным." },
  { id: "e7", day: 7, date: "7 сентября", mood: "calm", level: 4, duration: "2:41", note: "Неделя подряд — серия держится." },
];

export const lifeStatuses = [
  { id: "parent", label: "Мама в декрете / Родитель", emoji: "🍼" },
  { id: "student", label: "Студент / Выпускник", emoji: "🎓" },
  { id: "founder", label: "Предприниматель / Фрилансер", emoji: "💼" },
  { id: "career", label: "Смена профессии / В поиске работы", emoji: "🧭" },
  { id: "burnout", label: "Выгорание / Высокий стресс", emoji: "🔥" },
  { id: "other", label: "Другое / Универсальный статус", emoji: "✨" },
];

export const goals = [
  { id: "anxiety", label: "Уменьшить тревогу" },
  { id: "sleep", label: "Улучшить сон" },
  { id: "support", label: "Найти поддержку" },
];

export const buddies = [
  { id: "b1", name: "Айнура", status: "burnout", online: true, bio: "Работаю в найме, восстанавливаюсь после выгорания." },
  { id: "b2", name: "Дина", status: "parent", online: true, bio: "Мама двоих, ищу спокойные разговоры по вечерам." },
  { id: "b3", name: "Мээрим", status: "career", online: false, bio: "Меняю профессию, учусь на аналитика." },
];

export const chatMessages = [
  { id: "m1", from: "buddy" as const, text: "Привет! Как прошёл твой день?", time: "20:41" },
  { id: "m2", from: "me" as const, text: "Привет 🌿 Тяжеловато, но записала дневник — стало легче.", time: "20:44" },
  { id: "m3", from: "buddy" as const, text: "Это уже много. Я вчера тоже была на нуле, помогло дыхание 4-7-8.", time: "20:46" },
  { id: "m4", from: "me" as const, text: "Спасибо, попробую сегодня перед сном.", time: "20:47" },
];

export const careCategories = [
  {
    id: "anxiety",
    title: "Тревога",
    emoji: "🌀",
    summary: "Заземление и возвращение в тело за 3 минуты",
    steps: [
      "Назовите 5 предметов, которые видите вокруг",
      "4 звука, которые слышите прямо сейчас",
      "3 ощущения кожи: одежда, воздух, опора",
      "2 запаха и 1 вкус",
      "Сделайте медленный выдох длиннее вдоха",
    ],
    audio: [
      { id: "a1", title: "Дыхание 4-7-8", duration: "4:10" },
      { id: "a2", title: "Мягкое сканирование тела", duration: "7:25" },
    ],
  },
  {
    id: "panic",
    title: "Паника",
    emoji: "⚡",
    summary: "Быстрая помощь при накатывающей панике",
    steps: [
      "Сядьте и упритесь стопами в пол",
      "Вдох на 4 счёта, выдох на 8",
      "Скажите вслух: это волна, она пройдёт",
      "Умойтесь прохладной водой",
    ],
    audio: [{ id: "a3", title: "Голос-опора при панике", duration: "5:00" }],
  },
  {
    id: "insomnia",
    title: "Бессонница",
    emoji: "🌙",
    summary: "Ритуал засыпания без экрана",
    steps: [
      "Приглушите свет за 40 минут до сна",
      "Выпишите тревоги на бумагу",
      "Расслабление мышц снизу вверх",
      "Дыхание с длинным выдохом",
    ],
    audio: [{ id: "a4", title: "Медитация перед сном", duration: "12:00" }],
  },
  {
    id: "burnout",
    title: "Апатия / Выгорание",
    emoji: "🔥",
    summary: "Минимальные шаги, когда нет сил",
    steps: [
      "Выберите одно дело на 5 минут",
      "Вода и еда — базовая забота",
      "Выйдите на 10 минут на воздух",
      "Отметьте, что уже сделано сегодня",
    ],
    audio: [{ id: "a5", title: "Практика бережности к себе", duration: "8:30" }],
  },
];

export const therapists = [
  { id: "t1", name: "Асель Т.", spec: "КПТ, тревожные состояния", exp: "8 лет практики", price: "3 500 сом / сессия", initials: "АТ" },
  { id: "t2", name: "Нургуль С.", spec: "Выгорание, работа со стрессом", exp: "6 лет практики", price: "3 000 сом / сессия", initials: "НС" },
  { id: "t3", name: "Элина К.", spec: "Материнство, семейные отношения", exp: "11 лет практики", price: "4 200 сом / сессия", initials: "ЭК" },
];

export const rewards = [
  { id: "r1", title: "Заморозка серии", desc: "Сохраняет серию при одном пропущенном дне", cost: 120, emoji: "🧊" },
  { id: "r2", title: "Эксклюзивные аудио-практики", desc: "Доступ к закрытой библиотеке медитаций", cost: 200, emoji: "🎧" },
  { id: "r3", title: "Тема «Рассвет»", desc: "Тёплое оформление интерфейса", cost: 150, emoji: "🌅" },
  { id: "r4", title: "Тема «Полночь»", desc: "Тёмная тема с мягким контрастом", cost: 150, emoji: "🌌" },
];

export const profile = {
  name: "Айпери",
  coins: 245,
  streak: 12,
  goal: "Уменьшить тревогу",
  status: "burnout",
};
