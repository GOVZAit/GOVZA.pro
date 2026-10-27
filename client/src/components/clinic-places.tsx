import { Link } from "wouter";
import type { ClinicPlace } from "@shared/provider-directory";

export function ClinicPlaces({ places }: { places: ClinicPlace[] }) {
  return <section className="mt-8" aria-label="Места приёма врачей">
    <h2 className="text-lg font-semibold">Клиники и места приёма</h2>
    <p className="directory-description mb-4 clinic-source-note">Адреса из анкет врачей. Выберите место, чтобы посмотреть принимающих здесь специалистов.</p>
    {places.length ? <div className="directory-grid">{places.map((place, index) => <article key={place.key} className="directory-card" data-testid={`clinic-place-${index}`}>
      <span className="directory-tag">Место приёма</span><h3 className="mt-3 font-semibold text-lg">{place.clinic}</h3>
      <p className="directory-metadata mt-2">{[place.city, place.address].filter(Boolean).join(", ") || "Адрес не указан"}</p>
      <Link className="directory-secondary mt-4" href={`/doctors?clinic=${encodeURIComponent(place.key)}`}>Врачи здесь: {place.doctorIds.length}</Link>
    </article>)}</div> : <div className="directory-empty"><h3>Места приёма не найдены</h3><p>Измените город или поисковый запрос.</p></div>}
  </section>;
}
