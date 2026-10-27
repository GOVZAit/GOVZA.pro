import { useEffect, useMemo, useState, type SetStateAction } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Car, Check, ChevronRight, Droplets, GraduationCap, Hammer, Palette, PlugZap, Search, Sparkles, Truck, X, Zap, Heart, CalendarCheck, BadgeCheck, Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DirectoryFrame, DirectorySearch, DirectoryChip, DirectoryResults } from "@/components/directory-layout";
import { ResponsivePanel } from "@/components/responsive-panel";
import { MapView } from "@/components/map-view";
import { MasterCard } from "@/components/master-card";
import FilterSheet, { applyMasterFilters, type FilterState, defaultFilterState } from "@/components/filter-sheet";
import { BroadcastModal } from "@/components/broadcast-modal";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuth } from "@/contexts/auth-context";
import { useFavorites } from "@/hooks/use-favorites";
import { useRecentMasters, useTodayAvailability } from "@/hooks/use-master-memory";
import { useCatalogState } from "@/hooks/use-catalog-state";
import { activeFilterEntries, normalizeSearch, searchMasters, sortMasters } from "@shared/catalog";
import { cities, type Category, type Master } from "@shared/schema";
import { clearRequestDraft, readRequestDraft } from "@/lib/request-draft";
import productFeatures from "@shared/product-features.json";
import { MasterComparison } from "@/components/master-comparison";
import { isOrganizationProfile, providerDisplayName, type ProviderDirectory } from "@shared/provider-directory";

const categoryIcons: Record<string, typeof PlugZap> = { Wrench: Droplets, Zap: PlugZap, Sparkles, Hammer, Palette, Car, Package: Truck, BookOpen: GraduationCap };
function MasterCardSkeleton() {
  return <div className="directory-card space-y-4" aria-hidden="true">
    <div className="flex gap-3"><Skeleton className="h-14 w-14 rounded-2xl" /><div className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-24" /></div></div>
    <Skeleton className="h-4 w-40" /><Skeleton className="h-4 w-full" /><Skeleton className="h-12 w-full rounded-xl" />
  </div>;
}
const DEFAULT_CITY: string = cities[0];
export default function HomePage({ directory = "specialists" }: { directory?: ProviderDirectory }) {
  const organizations = directory === "organizations";
  const { user, isLoading: authLoading } = useAuth();
  const [catalog, setCatalog] = useCatalogState(user?.id, !authLoading, directory);
  const { query: searchQuery, category: selectedCategory, city, view: viewMode } = catalog;
  // The selected catalog owns profile type; stale legacy filters cannot hide its contents.
  const filterState = useMemo(() => ({ ...catalog.filters, providerType: "all" as const, executorType: organizations ? "all" as const : catalog.filters.executorType === "company" ? "all" as const : catalog.filters.executorType }), [catalog.filters, organizations]);
  useEffect(() => {
    if (catalog.filters.providerType !== filterState.providerType || catalog.filters.executorType !== filterState.executorType) {
      setCatalog(current => ({ ...current, filters: { ...current.filters, providerType: filterState.providerType, executorType: filterState.executorType } }));
    }
  }, [catalog.filters.providerType, catalog.filters.executorType, filterState.providerType, filterState.executorType]);
  const setSearchQuery = (query: string) => setCatalog((current) => ({ ...current, query }));
  const setSelectedCategory = (next: SetStateAction<number | null>) => setCatalog((current) => ({
    ...current, category: typeof next === "function" ? next(current.category) : next,
  }));
  const setFilterState = (filters: FilterState) => setCatalog((current) => ({ ...current, filters }));
  const setCity = (city: string) => setCatalog((current) => ({ ...current, city, filters: { ...current.filters, district: "all" } }));
  const setViewMode = (view: "list" | "map") => setCatalog((current) => ({ ...current, view }));
  const [showFilter, setShowFilter] = useState(false);
  const [resumedDraft, setResumedDraft] = useState(() => new URLSearchParams(window.location.search).get("compose") === "request" ? readRequestDraft() : null);
  const [showBroadcast, setShowBroadcast] = useState(Boolean(resumedDraft));
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("compose") !== "request") return;
    clearRequestDraft();
    const url = new URL(window.location.href);
    url.searchParams.delete("compose");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  const [broadcastCategory, setBroadcastCategory] = useState<string | undefined>();
  const [showLocation, setShowLocation] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [comparisonIds, setComparisonIds] = useState<number[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [, navigate] = useLocation();

  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });
  const { data: allMasters = [], isLoading: mastersLoading, isError: mastersError, refetch: reloadMasters } = useQuery<Master[]>({
    queryKey: ["/api/masters"], staleTime: 30_000, refetchOnWindowFocus: true,
  });

  const { favorites, toggle: toggleFavorite, isPending: favoritePending } = useFavorites();
  const comparedMasters = allMasters.filter(master => comparisonIds.includes(master.id));
  const toggleComparison = (id: number) => setComparisonIds(ids => ids.includes(id) ? ids.filter(value => value !== id) : ids.length < 3 ? [...ids, id] : ids);
  const recent = useRecentMasters();
  const recentInDirectory = recent.data.filter(item => isOrganizationProfile(item.master) === organizations);
  const availability = useTodayAvailability();
  const { availableIds } = availability;

  const contextMasters = useMemo(() => allMasters.filter((master) =>
    isOrganizationProfile(master) === organizations &&
    (city === DEFAULT_CITY || master.city === city) &&
    (!selectedCategory || (master.categoryIds ?? [master.categoryId]).includes(selectedCategory)),
  ), [allMasters, city, selectedCategory, organizations]);
  const baseMasters = useMemo(() => searchMasters(contextMasters, debouncedSearch), [contextMasters, debouncedSearch]);
  const filteredMasters = useMemo(() => sortMasters(
    applyMasterFilters(baseMasters, filterState, availableIds), filterState.sortBy, Boolean(normalizeSearch(debouncedSearch)),
  ), [baseMasters, filterState, availableIds, debouncedSearch]);
  const districts = useMemo(() => Array.from(new Set(contextMasters.flatMap((master) => master.district ? [master.district] : []))), [contextMasters]);
  const suggestions = useMemo(() => {
    const query = normalizeSearch(debouncedSearch);
    if (query.length < 2) return [];
    return Array.from(new Set(baseMasters.flatMap((master) => [master.name, master.category, ...master.services.map((service) => service.name)])))
      .filter((label) => normalizeSearch(label).includes(query)).slice(0, 6);
  }, [baseMasters, debouncedSearch]);

  const selectedCategoryName = selectedCategory
    ? categories.find((category) => category.id === selectedCategory)?.name
    : null;

  const activeFilters = activeFilterEntries(filterState);
  const hasActiveFilters = activeFilters.length > 0 || filterState.sortBy !== defaultFilterState.sortBy;
  const clearFilters = () => setCatalog((current) => ({ ...current, category: null, filters: { ...defaultFilterState } }));

  return (
    <DirectoryFrame title={organizations ? "Организации" : "Специалисты"} description={organizations ? "Компании, бригады и сервисные центры." : "Частные специалисты и самозанятые."} serviceSection={directory} city={city} onCityClick={() => setShowLocation(true)}>
      <DirectorySearch value={searchQuery} onChange={setSearchQuery} placeholder={organizations ? "Услуга или организация" : "Услуга или мастер"}
        onFilters={() => setShowFilter(true)} filtersOpen={showFilter}
        filterCount={activeFilters.length + (filterState.sortBy !== defaultFilterState.sortBy ? 1 : 0)}
        testId="input-search" filterTestId="button-filter" suggestions={suggestions} />
      <main className="directory-container">
        <nav className="directory-services" aria-label="Другие услуги">
          {productFeatures.autoParts && <Link href="/auto-parts"><Car size={18} aria-hidden="true" />Запчасти</Link>}
          <Link href="/more">Все сервисы<ChevronRight size={16} aria-hidden="true" /></Link>
        </nav>
        {organizations && <nav className="directory-rail" aria-label="Виды организаций"><Link href="/organizations" className="directory-chip is-selected" aria-current="page">Все организации</Link><Link href="/organizations?kind=medical" className="directory-chip">Клиники и медцентры</Link></nav>}
        <div className="directory-rail" aria-label="Категории услуг">
          <DirectoryChip active={selectedCategory === null} onClick={() => setSelectedCategory(null)}>Все услуги</DirectoryChip>
          {categoriesLoading ? <Skeleton className="h-11 w-64" /> : categories.map((category) => {
            const Icon = categoryIcons[category.iconName] ?? Zap;
            return <DirectoryChip key={category.id} active={selectedCategory === category.id}
              onClick={() => setSelectedCategory((current) => current === category.id ? null : category.id)} testId={`category-chip-${category.id}`}>
              <Icon aria-hidden="true" />{category.name}
            </DirectoryChip>;
          })}
        </div>
        <button type="button" className="directory-request-link" data-testid="button-broadcast"
          onClick={() => { setBroadcastCategory(selectedCategoryName ?? undefined); setShowBroadcast(true); }}>
          <Send size={20} aria-hidden="true" /><span><strong>Создать заявку</strong><small>Опишите задачу — получите предложения</small></span><ChevronRight size={18} aria-hidden="true" />
        </button>
        <div className="directory-quick-actions directory-quick-filters" aria-label="Быстрые фильтры">
          <DirectoryChip active={filterState.availableTodayOnly} onClick={() => setFilterState({ ...filterState, availableTodayOnly: !filterState.availableTodayOnly })}><CalendarCheck aria-hidden="true" />Свободен сегодня</DirectoryChip>
          <DirectoryChip active={filterState.verifiedOnly} onClick={() => setFilterState({ ...filterState, verifiedOnly: !filterState.verifiedOnly })}><BadgeCheck aria-hidden="true" />Проверенные</DirectoryChip>
          {user?.role === "client" && <Link href="/saved" className="directory-clear flex items-center gap-1.5"><Heart size={16} />Избранное</Link>}
        </div>
        {activeFilters.filter(([key]) => key !== "availableTodayOnly" && key !== "verifiedOnly").length > 0 && <div className="directory-quick-actions" aria-label="Выбранные фильтры">
          {activeFilters.filter(([key]) => key !== "availableTodayOnly" && key !== "verifiedOnly").map(([key, label]) => <DirectoryChip key={key} active onClick={() => setFilterState({ ...filterState, [key]: defaultFilterState[key] })}>{label}<X size={14} /></DirectoryChip>)}
        </div>}
        <DirectoryResults label={selectedCategoryName || (organizations ? "Организации" : "Специалисты")} count={filteredMasters.length} loading={mastersLoading} view={viewMode} onView={setViewMode}>
          {!compareMode && viewMode === "list" && contextMasters.length > 1 && <button type="button" className="directory-clear" onClick={() => setCompareMode(true)}>{organizations ? "Сравнить организации" : "Сравнить мастеров"}</button>}
        </DirectoryResults>
        {compareMode && <div className="master-comparison-tools">
          <p role="status">Выбрано: {comparedMasters.length} из 3. Выберите от 2 до 3 профилей.</p>
          <div><button type="button" className="directory-primary" disabled={comparedMasters.length < 2} onClick={() => setShowComparison(true)}>Открыть сравнение ({comparedMasters.length})</button>
            <button type="button" className="directory-secondary" onClick={() => { setCompareMode(false); setComparisonIds([]); }}>Отмена сравнения</button></div>
        </div>}
        {mastersError || (filterState.availableTodayOnly && availability.isError) ? <div className="directory-empty" role="alert">
          <Search size={28} /><h3>Не удалось обновить данные</h3><p>Проверьте соединение. Ваши фильтры сохранены.</p>
          <button type="button" className="directory-secondary" onClick={() => { void reloadMasters(); void availability.refetch(); }}>Повторить</button>
        </div> : mastersLoading || (filterState.availableTodayOnly && availability.isPending) ? <div className="directory-grid" aria-label="Загрузка мастеров">
          {Array.from({ length: 6 }).map((_, index) => <MasterCardSkeleton key={index} />)}
        </div> : filteredMasters.length > 0 ? (viewMode === "map" ? <div className="directory-map">
          <MapView organizations={filteredMasters.map((master) => ({ id: master.id, name: master.name, subcategory: master.category,
            address: [master.city, master.district].filter(Boolean).join(", "), phone: master.phone,
            hours: `${master.workingHours.from}–${master.workingHours.to}`, lat: master.lat, lng: master.lng }))}
            onSelect={(point) => navigate(`/master/${point.id}`)} />
        </div> : <div className="directory-grid">
          {filteredMasters.map((master) => <MasterCard key={master.id} master={master} isFavorite={favorites.includes(master.id)}
            favoritePending={favoritePending(master.id)} availableToday={availableIds.has(master.id) ? availability.data?.providers[master.id] : undefined}
            comparison={compareMode ? { selected: comparisonIds.includes(master.id), disabled: comparisonIds.length >= 3 && !comparisonIds.includes(master.id), onToggle: () => toggleComparison(master.id) } : undefined}
            onToggleFavorite={(event) => toggleFavorite(master.id, event)} />)}
        </div>) : <div className="directory-empty">
          <Search size={28} /><h3>{organizations ? "Подходящих организаций пока нет" : "Подходящих специалистов пока нет"}</h3><p>Измените запрос или условия поиска.</p>
          <button type="button" className="directory-secondary" onClick={() => { clearFilters(); setSearchQuery(""); }}>Сбросить поиск и фильтры</button>
        </div>}
        {(hasActiveFilters || selectedCategory) && <button type="button" className="directory-clear mt-3" onClick={clearFilters}>Сбросить фильтры</button>}
        {user?.role === "client" && recentInDirectory.length > 0 && !searchQuery && <section className="mt-8" aria-label={organizations ? "Недавно просмотренные организации" : "Недавно просмотренные специалисты"}>
          <div className="flex items-center justify-between"><h2 className="text-base font-semibold">Вы смотрели</h2><Link href="/saved?tab=recent" className="directory-clear">Вся история</Link></div>
          <div className="directory-rail">{recentInDirectory.slice(0, 6).map(({ master }) => <Link key={master.id} href={`/master/${master.id}`} className="directory-secondary shrink-0">{providerDisplayName(master)}</Link>)}</div>
        </section>}
      </main>
      {showFilter && <FilterSheet value={filterState} onChange={setFilterState} onClose={() => setShowFilter(false)} masters={baseMasters} directoryType={organizations ? "organization" : "master"}
        districts={districts} availableIds={availableIds} availabilityLoading={availability.isPending} />}
      {showComparison && <MasterComparison masters={comparedMasters} directory={directory} onRemove={id => setComparisonIds(ids => ids.filter(value => value !== id))} onClose={() => setShowComparison(false)} />}
      {showBroadcast && <BroadcastModal initialCategory={broadcastCategory} initialDescription={searchQuery} initialDraft={resumedDraft ?? undefined}
        onClose={() => { setShowBroadcast(false); setBroadcastCategory(undefined); setResumedDraft(null); }} />}
      <ResponsivePanel open={showLocation} onOpenChange={setShowLocation} title="Выберите город" description="Каталог будет показывать специалистов в выбранном городе.">
        <div className="space-y-2">{cities.map((item) => <button type="button" key={item} onClick={() => { setCity(item); setShowLocation(false); }}
          aria-pressed={city === item} className="directory-secondary w-full justify-between">{item}{city === item && <Check size={18} />}</button>)}</div>
      </ResponsivePanel>
    </DirectoryFrame>
  );
}
