import { useId, useRef, type ReactNode } from "react";
import { Link } from "wouter";
import { ChevronDown, MapPin, Search, SlidersHorizontal, X, List, Map } from "lucide-react";
import { AppBrandHeader } from "@/components/app-brand-header";
import { BottomNavigation, PrimaryNavLinks } from "@/components/bottom-navigation";
import { cn } from "@/lib/utils";

export function DirectoryTopbar() {
  return <div className="directory-topbar">
    <div className="directory-container directory-topbar-inner">
      <Link href="/" className="directory-wordmark" aria-label="GOVZA — главная">GOVZA<span aria-hidden="true">.</span></Link>
      <nav className="directory-desktop-nav" aria-label="Разделы сайта"><PrimaryNavLinks desktop /></nav>
      <AppBrandHeader compact hideLocation />
    </div>
  </div>;
}

interface FrameProps {
  title: string;
  description?: string;
  city?: string;
  onCityClick?: () => void;
  action?: ReactNode;
  serviceSection?: "specialists" | "doctors" | "organizations";
  /** Large display headline for the main "what needs doing?" screen. */
  hero?: boolean;
  children: ReactNode;
}
export function DirectoryFrame({ title, description, city, onCityClick, action, serviceSection, hero, children }: FrameProps) {
  return <div className="app-page directory-page">
    <DirectoryTopbar />
    {serviceSection && <div className="directory-container"><nav className="service-directory-nav" aria-label="Каталоги услуг">
      {([{ id: "specialists", href: "/", label: "Специалисты" }, { id: "doctors", href: "/doctors", label: "Врачи" }, { id: "organizations", href: "/organizations", label: "Организации" }] as const).map(item => <Link key={item.id} href={item.href} aria-current={serviceSection === item.id ? "page" : undefined}>{item.label}</Link>)}
    </nav></div>}
    <header className={cn("directory-container directory-intro", hero && "directory-intro-hero")}>
      <div className="directory-title-row">
        <h1>{title}</h1>
        {city && (onCityClick ? <button className="directory-city" type="button" onClick={(event) => { event.currentTarget.focus(); onCityClick(); }} aria-label={`Выбрать город: ${city}`}>
          <MapPin size={16} aria-hidden="true" /><span>{city}</span><ChevronDown size={14} aria-hidden="true" />
        </button> : <span className="directory-city"><MapPin size={16} aria-hidden="true" /><span>{city}</span></span>)}
      </div>
      {description && <p className="directory-description">{description}</p>}
      {action && <div className="directory-intro-action">{action}</div>}
    </header>
    {children}
    <BottomNavigation desktopHidden />
  </div>;
}

interface SearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onFilters: () => void;
  filterCount: number;
  filtersOpen?: boolean;
  testId: string;
  filterTestId: string;
  suggestions?: string[];
}
export function DirectorySearch({ value, onChange, placeholder, onFilters, filterCount, filtersOpen, testId, filterTestId, suggestions = [] }: SearchProps) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  return <div className="directory-search-sticky">
    <div className="directory-container directory-search-row">
      <form role="search" className="directory-search" onSubmit={(event) => { event.preventDefault(); input.current?.blur(); }}>
        <Search size={20} aria-hidden="true" />
        <input ref={input} type="search" enterKeyHint="search" autoComplete="off" maxLength={120}
          aria-label={placeholder} placeholder={placeholder} value={value} list={suggestions.length ? id : undefined}
          onChange={(event) => onChange(event.target.value)} data-testid={testId} />
        {value && <button type="button" onClick={() => { onChange(""); input.current?.focus(); }} aria-label="Очистить поиск"><X size={18} aria-hidden="true" /></button>}
        {suggestions.length > 0 && <datalist id={id}>{suggestions.map((label) => <option key={label} value={label} />)}</datalist>}
      </form>
      <button className={cn("directory-filter-button", filterCount > 0 && "has-filters")} type="button" onClick={(event) => { event.currentTarget.focus(); onFilters(); }}
        aria-label={filterCount ? `Фильтры: выбрано ${filterCount}` : "Фильтры"} aria-haspopup="dialog" aria-expanded={filtersOpen}
        data-testid={filterTestId}>
        <SlidersHorizontal size={20} aria-hidden="true" /><span className="filter-word">Фильтры</span>
        {filterCount > 0 && <span className="directory-counter">{filterCount}</span>}
      </button>
    </div>
  </div>;
}

export function DirectoryChip({ children, active, onClick, testId }: { children: ReactNode; active: boolean; onClick: () => void; testId?: string }) {
  return <button type="button" onClick={onClick} aria-pressed={active} data-testid={testId}
    className={cn("directory-chip", active && "is-selected")}>{children}</button>;
}

export function DirectoryResults({ count, label, loading, view, onView, children }: {
  count: number; label: string; loading?: boolean; view?: "list" | "map"; onView?: (view: "list" | "map") => void; children?: ReactNode;
}) {
  return <div className="directory-results-bar">
    <h2 tabIndex={-1}><span>{label}</span><span className="directory-result-count" role="status" aria-live="polite">{loading ? "…" : count}</span></h2>
    {onView && <div className="directory-view-switch" aria-label="Вид каталога">
      <button type="button" aria-pressed={view === "list"} onClick={() => onView("list")} aria-label="Показать списком"><List size={17} aria-hidden="true" /><span>Список</span></button>
      <button type="button" aria-pressed={view === "map"} onClick={() => onView("map")} aria-label="Показать на карте"><Map size={17} aria-hidden="true" /><span>Карта</span></button>
    </div>}
    {children}
  </div>;
}
