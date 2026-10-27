import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import HomePage from "./home";
import { DirectoryFrame, DirectorySearch, DirectoryResults } from "@/components/directory-layout";
import { ResponsivePanel } from "@/components/responsive-panel";
import { ClinicPlaces } from "@/components/clinic-places";
import { MasterCard } from "@/components/master-card";
import { useFavorites } from "@/hooks/use-favorites";
import { collectClinicPlaces, isOrganizationProfile } from "@shared/provider-directory";
import { normalizeSearch } from "@shared/catalog";
import type { Master } from "@shared/schema";
import type { Doctor } from "@/lib/doctors-data";

export default function OrganizationsPage() {
  const search = useSearch();
  return new URLSearchParams(search).get("kind") === "medical" ? <ClinicsDirectory /> : <HomePage directory="organizations" />;
}
function ClinicsDirectory() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const doctors = useQuery<Doctor[]>({ queryKey: ["/api/directory/doctors"] });
  const profiles = useQuery<Master[]>({ queryKey: ["/api/masters"] });
  const favorites = useFavorites();
  const places = useMemo(() => collectClinicPlaces(doctors.data ?? []), [doctors.data]);
  const medical = (profiles.data ?? []).filter(master => isOrganizationProfile(master) && master.organizationKind === "medical");
  const cities = [...new Set([...places.map(place => place.city), ...medical.map(master => master.city ?? "")].filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
  const text = normalizeSearch(query);
  const matches = (parts: string[]) => !text || normalizeSearch(parts.join(" ")).includes(text);
  const shownPlaces = places.filter(place => (!city || place.city === city) && matches([place.clinic, place.city, place.address]));
  const shownProfiles = medical.filter(master => (!city || master.city === city) && matches([master.name, master.companyName ?? "", master.city ?? "", master.description]));
  return <DirectoryFrame title="Клиники и медцентры" serviceSection="organizations" description="Организации и места приёма из анкет врачей." city={city || "Все города"} onCityClick={() => setCityOpen(true)}>
    <DirectorySearch value={query} onChange={setQuery} placeholder="Клиника, город или адрес" onFilters={() => setCityOpen(true)} filterCount={city ? 1 : 0} filtersOpen={cityOpen} testId="input-clinic-search" filterTestId="button-clinic-filter" />
    <main className="directory-container">
      <nav className="directory-rail" aria-label="Виды организаций"><Link href="/organizations" className="directory-chip">Все организации</Link><Link href="/organizations?kind=medical" className="directory-chip is-selected" aria-current="page">Клиники и медцентры</Link><Link href="/doctors" className="directory-chip">Найти врача</Link></nav>
      <DirectoryResults count={shownProfiles.length} label="Профили организаций" loading={profiles.isPending} />
      {profiles.isError ? <div role="alert" className="directory-empty"><p>Не удалось загрузить организации.</p><button type="button" className="directory-secondary" onClick={() => void profiles.refetch()}>Повторить</button></div>
        : profiles.isPending ? <p role="status">Загружаем организации…</p> : shownProfiles.length ? <div className="directory-grid">{shownProfiles.map(master => <MasterCard key={master.id} master={master} isFavorite={favorites.favorites.includes(master.id)} favoritePending={favorites.isPending(master.id)} onToggleFavorite={event => favorites.toggle(master.id, event)} />)}</div>
          : <p className="directory-metadata py-3">Подходящих профилей организаций пока нет. Места приёма из анкет врачей приведены ниже.</p>}
      {doctors.isError ? <div role="alert" className="directory-empty"><p>Не удалось загрузить места приёма.</p><button type="button" className="directory-secondary" onClick={() => void doctors.refetch()}>Повторить</button></div>
        : doctors.isPending ? <p role="status">Загружаем места приёма…</p> : <ClinicPlaces places={shownPlaces} />}
    </main>
    <ResponsivePanel open={cityOpen} onOpenChange={setCityOpen} title="Выберите город"><div className="space-y-2">{["", ...cities].map(value => <button type="button" key={value} className="directory-secondary w-full" aria-pressed={city === value} onClick={() => { setCity(value); setCityOpen(false); }}>{value || "Все города"}</button>)}</div></ResponsivePanel>
  </DirectoryFrame>;
}
