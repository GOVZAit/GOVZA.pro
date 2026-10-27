import type { Category } from "@shared/schema";

/**
 * Rule-based reading of a free-text task ("течёт кран сегодня вечером").
 * It only suggests: nothing is applied until the person taps a suggestion,
 * so a search by a provider's name keeps working exactly as before.
 */
const categoryKeywords: Record<string, string[]> = {
  Wrench: ["сантех", "кран", "смесител", "засор", "труб", "унитаз", "бойлер", "водопровод", "канализ", "протека", "течёт", "течет", "раковин"],
  Zap: ["электр", "розетк", "проводк", "выключател", "люстр", "автомат", "щиток", "свет"],
  Sparkles: ["уборк", "клининг", "помыть", "мойка окон", "химчистк", "генеральн"],
  Hammer: ["ремонт", "плитк", "обои", "штукатур", "ламинат", "отделк", "сборка мебели", "двер"],
  Palette: ["маникюр", "педикюр", "стрижк", "парикмах", "макияж", "бров", "ресниц", "красот"],
  Car: ["авто", "машин", "эвакуатор", "шиномонтаж", "двигател", "тормоз", "аккумулятор"],
  Package: ["переезд", "грузчик", "перевез", "перевоз", "доставк", "газел"],
  BookOpen: ["репетитор", "урок", "обучен", "курсы", "английск", "математик", "подготовк к егэ", "огэ", "егэ"],
};

const todayWords = ["сегодня", "сейчас", "срочно", "вечером", "утром", "днём", "днем", "немедленно"];

export interface QueryIntent {
  category?: Category;
  today: boolean;
}

export function readQueryIntent(query: string, categories: Category[]): QueryIntent {
  const text = query.toLocaleLowerCase("ru-RU").replace(/\s+/g, " ").trim();
  if (text.length < 3) return { today: false };
  const byName = categories.find((category) => text.includes(category.name.toLocaleLowerCase("ru-RU")));
  const byKeyword = byName ?? categories.find((category) =>
    (categoryKeywords[category.iconName] ?? []).some((word) => text.includes(word)));
  return { category: byKeyword, today: todayWords.some((word) => text.includes(word)) };
}

/** Example tasks shown under the empty search field. */
export const intentExamples = ["Течёт кран", "Маникюр на дом", "Не работает розетка", "Генеральная уборка", "Эвакуатор", "Репетитор по математике"];
