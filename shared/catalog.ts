import type { ExecutorType, Master } from "./schema";
import { isOrganizationProfile } from "./provider-directory";

export type SortBy = "relevance" | "rating" | "reviews" | "price_asc" | "price_desc" | "distance" | "orders";
export interface FilterState {
  sortBy: SortBy;
  verifiedOnly: boolean;
  onlineOnly: boolean;
  certifiedOnly: boolean;
  availableTodayOnly: boolean;
  topOnly: boolean;
  executorType: ExecutorType | "all";
  providerType: "all" | "master" | "organization";
  district: string;
  minRating: number;
  minReviews: number;
  minOrders: number;
  minPrice: number | null;
  maxPrice: number | null;
}

export const defaultFilterState: FilterState = {
  sortBy: "relevance", verifiedOnly: false, onlineOnly: false, certifiedOnly: false,
  availableTodayOnly: false, topOnly: false, executorType: "all", providerType: "all",
  district: "all", minRating: 0, minReviews: 0, minOrders: 0, minPrice: null, maxPrice: null,
};

export function normalizeSearch(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

const synonymGroups = [
  ["сантехник", "сантехника"], ["электрик", "электрика", "электромонтаж"],
  ["клининг", "уборка", "клинер"], ["репетитор", "репетиторы", "обучение"],
  ["автосервис", "автомеханик", "авторемонт"], ["парикмахер", "стрижка"],
];

function alternatives(token: string): string[] {
  return synonymGroups.find((group) => group.includes(token)) ?? [token];
}

/** One edit (including a swapped adjacent pair). Short words and numbers stay exact. */
function oneTypo(a: string, b: string): boolean {
  if (a.length < 5 || b.length < 4 || /\d/.test(a + b) || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const positions = Array.from(a).flatMap((letter, i) => letter !== b[i] ? [i] : []);
    return positions.length === 1 || (positions.length === 2 && positions[1] === positions[0] + 1 &&
      a[positions[0]] === b[positions[1]] && a[positions[1]] === b[positions[0]]);
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < short.length && short[i] === long[i]) i++;
  return short.slice(i) === long.slice(i + 1);
}

function tokenScore(token: string, word: string): number {
  if (token === word) return 1;
  if (token.length >= 3 && word.startsWith(token)) return 0.85;
  if (alternatives(token).some((item) => item === word || (item.length >= 4 && word.startsWith(item)))) return 0.75;
  return (oneTypo(token, word) || alternatives(word).some((variant) => oneTypo(token, variant))) ? 0.4 : 0;
}

export function masterSearchScore(master: Master, rawQuery: string): number {
  const query = normalizeSearch(rawQuery.slice(0, 120));
  if (!query) return 1;
  const tokens = query.split(" ").slice(0, 8);
  const fields: [string, number][] = [
    [master.name, 10], [master.companyName ?? "", 10], [master.category, 8],
    [(master.services ?? []).map((service) => service.name).join(" "), 9],
    [master.city ?? "", 5], [master.district ?? "", 5], [master.description?.slice(0, 3000) ?? "", 2],
  ];
  const indexed = fields.map(([text, weight]) => ({ text: normalizeSearch(text), weight }));
  let score = 0;
  for (const token of tokens) {
    let best = 0;
    for (const field of indexed) {
      for (const word of field.text.split(" ")) best = Math.max(best, field.weight * tokenScore(token, word));
    }
    if (best === 0) return 0; // AND: every word must match; never silently broaden a query.
    score += best;
  }
  return score + Math.max(0, ...indexed.map((field) => field.text.includes(query) ? field.weight * 2 : 0));
}

export function searchMasters(masters: Master[], query: string): Master[] {
  if (!normalizeSearch(query)) return [...masters];
  return masters.map((master) => ({ master, score: masterSearchScore(master, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || (b.master.reviews > 0 ? b.master.rating : 0) - (a.master.reviews > 0 ? a.master.rating : 0) || a.master.id - b.master.id)
    .map(({ master }) => master);
}

/** Read the first monetary amount, preserving thousands and decimal separators. Unknown is not zero. */
export function priceValue(value: string): number | null {
  const match = value.normalize("NFKC").match(/\d+(?:[\s\u00a0\u202f]\d{3})*(?:[.,]\d{1,2})?/);
  if (!match) return null;
  const amount = Number(match[0].replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
  return Number.isFinite(amount) ? amount : null;
}

export function masterPrice(master: Master): number | null {
  return master.showPrices === false ? null : priceValue(master.price);
}

function distanceValue(value: string): number | null {
  const match = value.toLowerCase().trim().match(/^(\d+(?:[.,]\d+)?)\s*(км|м|km|m)\b/u);
  if (!match) {
    // Cyrillic units have no JS ASCII word boundary at the end.
    const fallback = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(км|м)$/);
    return fallback ? Number(fallback[1].replace(",", ".")) / (fallback[2] === "м" ? 1000 : 1) : null;
  }
  return Number(match[1].replace(",", ".")) / (["м", "m"].includes(match[2]) ? 1000 : 1);
}

function compareNullable(a: number | null, b: number | null, descending = false): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return descending ? b - a : a - b;
}

export function applyMasterFilters(masters: Master[], state: FilterState, availableIds: ReadonlySet<number> = new Set()): Master[] {
  return masters.filter((master) => {
    if (state.verifiedOnly && !master.verified) return false;
    if (state.onlineOnly && !master.isOnline) return false;
    if (state.certifiedOnly && !master.hasCertificate) return false;
    if (state.availableTodayOnly && !availableIds.has(master.id)) return false;
    if (state.topOnly && !master.topMaster) return false;
    if (state.executorType !== "all" && (master.executorType ?? "private") !== state.executorType) return false;
    if (state.providerType !== "all" && (isOrganizationProfile(master) ? "organization" : "master") !== state.providerType) return false;
    if (state.district !== "all" && master.district !== state.district) return false;
    if (state.minRating > 0 && (master.reviews < 1 || master.rating < state.minRating)) return false;
    if (master.reviews < state.minReviews || master.completedOrders < state.minOrders) return false;
    const price = masterPrice(master);
    if (state.minPrice !== null && (price === null || price < state.minPrice)) return false;
    if (state.maxPrice !== null && (price === null || price > state.maxPrice)) return false;
    return true;
  });
}

/** Relevance preserves search order; without a query it falls back to rating. */
export function sortMasters(masters: Master[], sort: SortBy, hasQuery = false): Master[] {
  if (sort === "relevance" && hasQuery) return [...masters];
  return [...masters].sort((a, b) => {
    let difference = 0;
    switch (sort) {
      case "price_asc": difference = compareNullable(masterPrice(a), masterPrice(b)); break;
      case "price_desc": difference = compareNullable(masterPrice(a), masterPrice(b), true); break;
      case "distance": difference = compareNullable(distanceValue(a.distance), distanceValue(b.distance)); break;
      case "reviews": difference = b.reviews - a.reviews; break;
      case "orders": difference = b.completedOrders - a.completedOrders; break;
      default: difference = (b.reviews > 0 ? b.rating : 0) - (a.reviews > 0 ? a.rating : 0);
    }
    return difference || b.reviews - a.reviews || a.id - b.id;
  });
}

export function activeFilterEntries(state: FilterState): [keyof FilterState, string][] {
  const result: [keyof FilterState, string][] = [];
  const toggles = { availableTodayOnly: "Свободен сегодня", verifiedOnly: "Проверенные", onlineOnly: "Онлайн",
    certifiedOnly: "С сертификатом", topOnly: "Топ-мастера" } as const;
  for (const [key, label] of Object.entries(toggles)) if (state[key as keyof typeof toggles]) result.push([key as keyof FilterState, label]);
  if (state.minRating) result.push(["minRating", `Рейтинг от ${state.minRating}`]);
  if (state.minReviews) result.push(["minReviews", `Отзывов от ${state.minReviews}`]);
  if (state.minOrders) result.push(["minOrders", `Заказов от ${state.minOrders}`]);
  if (state.minPrice !== null) result.push(["minPrice", `От ${state.minPrice.toLocaleString("ru-RU")} ₽`]);
  if (state.maxPrice !== null) result.push(["maxPrice", `До ${state.maxPrice.toLocaleString("ru-RU")} ₽`]);
  if (state.district !== "all") result.push(["district", state.district]);
  if (state.providerType !== "all") result.push(["providerType", state.providerType === "master" ? "Мастера" : "Организации"]);
  if (state.executorType !== "all") result.push(["executorType", { private: "Частное лицо", self_employed: "Самозанятый", company: "Компания" }[state.executorType]]);
  return result;
}

export interface CatalogState { query: string; city: string; category: number | null; view: "list" | "map"; filters: FilterState }
export const defaultCatalogState: CatalogState = { query: "", city: "Все города", category: null, view: "list", filters: defaultFilterState };

export function readCatalogState(params: URLSearchParams): CatalogState {
  const filters = { ...defaultFilterState };
  for (const key of ["verifiedOnly", "onlineOnly", "certifiedOnly", "availableTodayOnly", "topOnly"] as const) filters[key] = params.get(key) === "1";
  for (const key of ["minRating", "minReviews", "minOrders", "minPrice", "maxPrice"] as const) {
    const raw = params.get(key);
    if (raw !== null && /^\d+(?:\.\d+)?$/.test(raw)) {
      const value = Number(raw);
      if (Number.isFinite(value) && value >= 0 && value <= (key === "minRating" ? 5 : 10_000_000)) filters[key] = value;
    }
  }
  const sort = params.get("sortBy");
  if (["relevance", "rating", "reviews", "price_asc", "price_desc", "distance", "orders"].includes(sort ?? "")) filters.sortBy = sort as SortBy;
  const executor = params.get("executorType");
  if (["private", "self_employed", "company"].includes(executor ?? "")) filters.executorType = executor as ExecutorType;
  const provider = params.get("providerType");
  if (provider === "master" || provider === "organization") filters.providerType = provider;
  filters.district = params.get("district")?.trim().slice(0, 80) || "all";
  const category = Number(params.get("category"));
  return {
    query: (params.get("q") ?? "").slice(0, 120), city: params.get("city")?.trim().slice(0, 80) || "Все города",
    category: Number.isSafeInteger(category) && category > 0 ? category : null,
    view: params.get("view") === "map" ? "map" : "list", filters,
  };
}

export function writeCatalogState(state: CatalogState): string {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query.slice(0, 120));
  if (state.city !== "Все города") params.set("city", state.city);
  if (state.category) params.set("category", String(state.category));
  if (state.view !== "list") params.set("view", state.view);
  for (const key of Object.keys(defaultFilterState) as (keyof FilterState)[]) {
    const value = state.filters[key];
    if (value !== defaultFilterState[key] && value !== null) params.set(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  }
  return params.toString();
}
