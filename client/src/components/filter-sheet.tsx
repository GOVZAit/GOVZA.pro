import { useId, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsivePanel } from "@/components/responsive-panel";

import { activeFilterEntries, applyMasterFilters, defaultFilterState, type FilterState, type SortBy } from "@shared/catalog";
import type { Master } from "@shared/schema";

export { applyMasterFilters, defaultFilterState } from "@shared/catalog";
export type { FilterState, SortBy } from "@shared/catalog";

export const sortLabels: Record<SortBy, string> = {
  relevance: "По соответствию запросу", rating: "По рейтингу", reviews: "По числу отзывов",
  price_asc: "Сначала дешевле", price_desc: "Сначала дороже", distance: "По расстоянию в профиле", orders: "По выполненным заказам",
};

interface PanelProps {
  value: FilterState;
  onChange: (value: FilterState) => void;
  districts?: string[];
  directoryType?: "master" | "organization";
}

export function FilterPanel({ value, onChange, districts = [], directoryType }: PanelProps) {
  const id = useId();
  const set = <K extends keyof FilterState>(key: K, next: FilterState[K]) => onChange({ ...value, [key]: next });
  const inputClass = "min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm";
  const invalidPrice = value.minPrice !== null && value.maxPrice !== null && value.minPrice > value.maxPrice;
  const allDistricts = Array.from(new Set([...districts, ...(value.district === "all" ? [] : [value.district])])).sort((a, b) => a.localeCompare(b, "ru"));
  return (
    <div className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-semibold" htmlFor={`${id}-sort`}>Сортировка</label>
        <select id={`${id}-sort`} className={inputClass} value={value.sortBy} onChange={(event) => set("sortBy", event.target.value as SortBy)}>
          {Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      <fieldset className="space-y-1">
        <legend className="mb-2 text-sm font-semibold">Доступность и доверие</legend>
        {([
          ["availableTodayOnly", "Свободен сегодня", "По календарю мастера, не по онлайн-статусу"],
          ["verifiedOnly", "Проверенные", "С отметкой проверки профиля"],
          ["onlineOnly", "Сейчас онлайн", "Онлайн не означает свободное время"],
          ["certifiedOnly", "С сертификатом", "Указаны документы о квалификации"],
          ["topOnly", "Топ-мастера", "С отметкой топ-мастера"],
        ] as const).map(([key, label, description]) => (
          <label key={key} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-1 py-2">
            <input type="checkbox" checked={value[key]} onChange={(event) => set(key, event.target.checked)} className="h-5 w-5 shrink-0 accent-primary" data-testid={`filter-${key}`} />
            <span><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{description}</span></span>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Цена в профиле, ₽</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["minPrice", "maxPrice"] as const).map((key) => (
            <label key={key} className="text-xs text-muted-foreground">
              {key === "minPrice" ? "От" : "До"}
              <input type="number" inputMode="decimal" min={0} max={10000000} step="any" value={value[key] ?? ""}
                placeholder={key === "minPrice" ? "Не важно" : "Без лимита"} className={`${inputClass} mt-1 text-foreground`}
                aria-invalid={invalidPrice} aria-describedby={invalidPrice ? `${id}-price-error` : undefined}
                onChange={(event) => set(key, event.target.value === "" ? null : Math.min(10000000, Math.max(0, Number(event.target.value) || 0)))} />
            </label>
          ))}
        </div>
        {invalidPrice ? <p id={`${id}-price-error`} role="alert" className="mt-2 text-xs text-destructive">Цена «от» не должна превышать цену «до».</p>
          : <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Сравниваем заявленную начальную цену. Итог согласуется с мастером. Неуказанная цена не считается нулевой.</p>}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-semibold">Опыт и отзывы</legend>
        <label className="block text-xs text-muted-foreground">Рейтинг от
          <select className={`${inputClass} mt-1 text-foreground`} value={value.minRating} onChange={(event) => set("minRating", Number(event.target.value))}>
            {Array.from(new Set([0, 4, 4.5, 4.8, value.minRating])).sort((a, b) => a - b).map((rating) => <option key={rating} value={rating}>{rating ? `${rating}+` : "Любой"}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(["minReviews", "minOrders"] as const).map((key) => <label key={key} className="text-xs text-muted-foreground">
            {key === "minReviews" ? "Отзывов от" : "Заказов от"}
            <input type="number" min={0} max={10000000} inputMode="numeric" className={`${inputClass} mt-1 text-foreground`} value={value[key] || ""} placeholder="Любое"
              onChange={(event) => set(key, Math.min(10000000, Math.max(0, Math.floor(Number(event.target.value) || 0))))} />
          </label>)}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-semibold">Исполнитель</legend>
        {!directoryType && <label className="block text-xs text-muted-foreground">Тип профиля
          <select className={`${inputClass} mt-1 text-foreground`} value={value.providerType} onChange={(event) => set("providerType", event.target.value as FilterState["providerType"])}>
            <option value="all">Все</option><option value="master">Мастер</option><option value="organization">Организация</option>
          </select>
        </label>}
        {directoryType !== "organization" && <label className="block text-xs text-muted-foreground">Статус исполнителя
          <select className={`${inputClass} mt-1 text-foreground`} value={value.executorType} onChange={(event) => set("executorType", event.target.value as FilterState["executorType"])}>
            <option value="all">Любой</option><option value="private">Частное лицо</option><option value="self_employed">Самозанятый</option>{!directoryType && <option value="company">Компания</option>}
          </select>
        </label>}
        {allDistricts.length > 0 && <label className="block text-xs text-muted-foreground">Район
          <select className={`${inputClass} mt-1 text-foreground`} value={value.district} onChange={(event) => set("district", event.target.value)}>
            <option value="all">Все районы</option>{allDistricts.map((district) => <option key={district} value={district}>{district}</option>)}
          </select>
        </label>}
      </fieldset>
      {(activeFilterEntries(value).length > 0 || value.sortBy !== defaultFilterState.sortBy) && <Button type="button" variant="outline" className="w-full rounded-xl" onClick={() => onChange({ ...defaultFilterState })}>Сбросить фильтры</Button>}
    </div>
  );
}

interface FilterSheetProps extends PanelProps {
  onClose: () => void;
  masters: Master[];
  availableIds?: ReadonlySet<number>;
  availabilityLoading?: boolean;
}

export default function FilterSheet({ value, onChange, onClose, masters, districts, availableIds, availabilityLoading, directoryType }: FilterSheetProps) {
  const [draft, setDraft] = useState(value);
  const count = applyMasterFilters(masters, draft, availableIds).length;
  const invalidPrice = draft.minPrice !== null && draft.maxPrice !== null && draft.minPrice > draft.maxPrice;
  const checking = draft.availableTodayOnly && availabilityLoading;
  return <ResponsivePanel open onOpenChange={(open) => { if (!open) onClose(); }} title={directoryType === "organization" ? "Фильтры организаций" : "Фильтры специалистов"}
    description="Выберите условия и примените. Город и поиск сохранятся."
    footer={<><button type="button" className="directory-secondary" onClick={() => setDraft({ ...defaultFilterState })}>Сбросить</button>
      <button type="button" className="directory-primary" disabled={invalidPrice || checking} onClick={() => { onChange(draft); onClose(); }} data-testid="button-filter-apply">
        {checking ? "Проверяем…" : `Показать: ${count}`}
      </button></>}>
    <FilterPanel value={draft} onChange={setDraft} districts={districts} directoryType={directoryType} />
    <p className="sr-only" role="status" aria-live="polite">Найдено: {count}</p>
  </ResponsivePanel>;
}
