import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Phone, MapPin, Clock, Star, Baby, Home as HomeIcon, ChevronLeft, Send, MessageCircle, Stethoscope, HeartPulse, Brain, Eye, Ear, Smile, Flower2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { clinicLocationKey } from "@shared/provider-directory";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DirectoryFrame, DirectorySearch, DirectoryChip, DirectoryResults } from "@/components/directory-layout";
import { ResponsivePanel } from "@/components/responsive-panel";
import { MapView } from "@/components/map-view";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { doctors as seededDoctors, doctorSpecialties, type Doctor, type DoctorLocation } from "@/lib/doctors-data";
import type { ChatMessage } from "@shared/schema";

type DoctorSort = "rating" | "price" | "experience";
type Filters = { sortBy: DoctorSort; city: string | null; children: boolean; homeVisits: boolean };
const defaults: Filters = { sortBy: "rating", city: null, children: false, homeVisits: false };
const sortOptions: { key: DoctorSort; label: string }[] = [{ key: "rating", label: "По рейтингу" }, { key: "price", label: "Сначала дешевле" }, { key: "experience", label: "По стажу" }];
const specialtyIcons: Record<string, typeof Stethoscope> = { therapist: Stethoscope, pediatrician: Baby, dentist: Smile, cardiologist: HeartPulse, neurologist: Brain, gynecologist: Flower2, ophthalmologist: Eye, ent: Ear };
const doctorChatId = (id: number) => 1000 + id;
const extractPrice = (price: string) => Number(price.replace(/\D/g, "")) || Infinity;
function selectDoctors(doctors: Doctor[], query: string, specialty: string | null, filters: Filters) {
  const q = query.trim().toLocaleLowerCase("ru-RU");
  return doctors.filter((d) => (!specialty || d.specialtyId === specialty)
    && (!filters.city || d.locations.some((l) => l.city === filters.city))
    && (!filters.children || d.acceptsChildren) && (!filters.homeVisits || d.homeVisits)
    && (!q || [d.name, d.specialty, ...d.locations.flatMap((l) => [l.clinic, l.city])].some((text) => text.toLocaleLowerCase("ru-RU").includes(q))))
    .sort((a, b) => filters.sortBy === "price" ? extractPrice(a.price) - extractPrice(b.price) : filters.sortBy === "experience" ? b.experienceYears - a.experienceYears : b.rating - a.rating);
}
function ClinicLocation({ location }: { location: DoctorLocation }) {
  return <div className="directory-location"><MapPin size={16} aria-hidden="true" /><div className="min-w-0">
    <p>{location.clinic}</p><p className="directory-metadata">{location.city}, {location.address}</p>
    {location.schedule && <p className="directory-metadata flex items-start gap-1 mt-1"><Clock size={13} aria-hidden="true" />{location.schedule}</p>}
  </div></div>;
}

export default function DoctorsPage() {
  const search = useSearch();
  const clinic = new URLSearchParams(search).get("clinic");
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(defaults);
  const [draft, setDraft] = useState<Filters>(defaults);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const [chatDoctor, setChatDoctor] = useState<Doctor | null>(null);
  const { data: doctors = seededDoctors, isError, refetch } = useQuery<Doctor[]>({ queryKey: ["/api/directory/doctors"], initialData: seededDoctors });
  const scopedDoctors = useMemo(() => clinic ? doctors.map(doctor => ({ ...doctor, locations: doctor.locations.filter(location => clinicLocationKey(location) === clinic) })).filter(doctor => doctor.locations.length > 0) : doctors, [doctors, clinic]);
  const selectedClinic = doctors.flatMap(doctor => doctor.locations).find(location => clinicLocationKey(location) === clinic);
  const doctorCities = useMemo(() => Array.from(new Set(scopedDoctors.flatMap((d) => d.locations.map((l) => l.city)))), [scopedDoctors]);
  const filtered = useMemo(() => selectDoctors(scopedDoctors, query, specialty, filters), [scopedDoctors, query, specialty, filters]);
  const previewCount = useMemo(() => selectDoctors(scopedDoctors, query, specialty, draft).length, [scopedDoctors, query, specialty, draft]);
  const filterCount = [filters.city !== null, filters.children, filters.homeVisits, filters.sortBy !== "rating"].filter(Boolean).length;
  const openFilters = () => { setDraft({ ...filters }); setShowFilters(true); };
  if (chatDoctor) return <DoctorChat doctor={chatDoctor} onBack={() => setChatDoctor(null)} />;

  return <DirectoryFrame title="Врачи" serviceSection="doctors" description="Специальности, места приёма и контакты." city={filters.city ?? "Все города"} onCityClick={openFilters}>
    <DirectorySearch value={query} onChange={setQuery} placeholder="Врач или специальность" onFilters={openFilters} filtersOpen={showFilters}
      filterCount={filterCount} testId="input-doctor-search" filterTestId="button-doctor-filters" />
    <main className="directory-container">
      <nav className="directory-services" aria-label="Медицинские каталоги"><Link href="/organizations?kind=medical">Клиники и медцентры</Link>{clinic && <Link href="/doctors">Все врачи</Link>}</nav>
      {clinic && <p className="request-draft-note clinic-source-note" role="status">Место приёма: {selectedClinic ? [selectedClinic.clinic, selectedClinic.city, selectedClinic.address].filter(Boolean).join(", ") : "по выбранной ссылке"}</p>}
      <div className="directory-rail" aria-label="Специальности врачей">
        <DirectoryChip active={!specialty} onClick={() => setSpecialty(null)}>Все специальности</DirectoryChip>
        {doctorSpecialties.map((s) => { const Icon = specialtyIcons[s.id] ?? Stethoscope; return <DirectoryChip key={s.id} active={specialty === s.id}
          onClick={() => setSpecialty((prev) => prev === s.id ? null : s.id)} testId={`specialty-chip-${s.id}`}><Icon aria-hidden="true" />{s.label}</DirectoryChip>; })}
      </div>
      <DirectoryResults label="Специалисты" count={filtered.length} view={view} onView={setView} />
      {isError && <p role="status" className="directory-metadata mb-3">Не удалось обновить каталог. Показаны ранее загруженные данные. <button type="button" className="directory-clear" onClick={() => void refetch()}>Повторить</button></p>}
      {filtered.length === 0 ? <div className="directory-empty"><Search size={28} /><h3>Подходящих врачей пока нет</h3><p>Попробуйте другую специальность или измените условия поиска.</p>
        <button type="button" className="directory-secondary" onClick={() => { setFilters(defaults); setSpecialty(null); setQuery(""); }}>Сбросить поиск и фильтры</button>
      </div> : view === "map" ? <div className="directory-map"><MapView organizations={filtered.flatMap((doc) => doc.locations.filter((l) => !filters.city || l.city === filters.city).map((l, i) => ({ id: `${doc.id}-${i}`, name: doc.name, subcategory: `${doc.specialty} · ${l.clinic}`, address: `${l.city}, ${l.address}`, phone: doc.phone, hours: l.schedule, lat: l.lat, lng: l.lng })))} /></div>
      : <div className="directory-grid">{filtered.map((doc) => {
        const locations = doc.locations.filter((l) => (!filters.city || l.city === filters.city) && (!clinic || clinicLocationKey(l) === clinic));
        return <article key={doc.id} className="directory-card" data-testid={`doctor-card-${doc.id}`}>
          <div className="directory-card-header"><Avatar className="directory-avatar"><AvatarImage src={doc.avatar} alt="" className="object-cover" /><AvatarFallback className="bg-transparent font-semibold">{doc.name.split(/\s+/).map((n) => n[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>
            <div className="directory-person"><h3>{doc.name}</h3><p>{doc.specialty}</p></div>
          </div>
          <div className="directory-rating-row"><span className="directory-rating"><Star size={14} aria-hidden="true" />{doc.rating.toFixed(1)}</span><span className="directory-metadata">Отзывов: {doc.reviews}</span><span className="directory-metadata">Стаж: {doc.experienceYears} лет</span></div>
          <p className="directory-price">{doc.price}</p>
          {locations[0] && <ClinicLocation location={locations[0]} />}
          {locations.length > 1 && <details><summary>Ещё мест приёма: {locations.length - 1}</summary>{locations.slice(1).map((location, i) => <ClinicLocation key={i} location={location} />)}</details>}
          {(doc.homeVisits || doc.acceptsChildren) && <div className="directory-tags">{doc.acceptsChildren && <span className="directory-tag"><Baby size={13} />Принимает детей</span>}{doc.homeVisits && <span className="directory-tag"><HomeIcon size={13} />Приём на дому</span>}</div>}
          <div className="directory-card-actions">
            {doc.phone && <a href={`tel:${doc.phone.replace(/[^+\d]/g, "")}`} data-testid={`doctor-call-${doc.id}`} className="directory-primary"><Phone size={16} aria-hidden="true" />Позвонить</a>}
            <button type="button" onClick={() => setChatDoctor(doc)} data-testid={`doctor-message-${doc.id}`} className="directory-secondary"><MessageCircle size={16} aria-hidden="true" />Написать</button>
          </div>
        </article>;
      })}</div>}
      {filterCount > 0 && <button type="button" className="directory-clear mt-3" onClick={() => setFilters(defaults)}>Сбросить фильтры</button>}
    </main>
    <ResponsivePanel open={showFilters} onOpenChange={setShowFilters} title="Фильтры врачей" description="Изменения вступят в силу после применения."
      footer={<><button type="button" className="directory-secondary" onClick={() => setDraft({ ...defaults })}>Сбросить</button><button type="button" className="directory-primary" onClick={() => { setFilters(draft); setShowFilters(false); }} data-testid="doctor-filter-apply">Показать: {previewCount}</button></>}>
      <fieldset className="govza-options"><legend>Сортировка</legend><div>{sortOptions.map((o) => <DirectoryChip key={o.key} active={draft.sortBy === o.key} onClick={() => setDraft({ ...draft, sortBy: o.key })} testId={`doctor-sort-${o.key}`}>{o.label}</DirectoryChip>)}</div></fieldset>
      <label className="govza-field"><span>Город</span><select value={draft.city ?? ""} onChange={(event) => setDraft({ ...draft, city: event.target.value || null })}><option value="">Все города</option>{doctorCities.map((city) => <option key={city}>{city}</option>)}</select></label>
      <fieldset className="govza-options"><legend>Особенности приёма</legend><div>
        <DirectoryChip active={draft.children} onClick={() => setDraft({ ...draft, children: !draft.children })} testId="doctor-filter-children"><Baby />Принимает детей</DirectoryChip>
        <DirectoryChip active={draft.homeVisits} onClick={() => setDraft({ ...draft, homeVisits: !draft.homeVisits })} testId="doctor-filter-home-visits"><HomeIcon />Приём на дому</DirectoryChip>
      </div></fieldset>
    </ResponsivePanel>
  </DirectoryFrame>;
}

function DoctorChat({ doctor, onBack }: { doctor: Doctor; onBack: () => void }) {
  const [text, setText] = useState("");
  const queryClient = useQueryClient();
  const chatId = doctorChatId(doctor.id);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: [`/api/messages/${chatId}`],
  });

  const sendMutation = useMutation({
    mutationFn: (msgText: string) =>
      apiRequest("POST", `/api/messages/${chatId}`, { text: msgText, sender: "user" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/messages/${chatId}`] });
      setText("");
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  };

  return (
    <div className="h-[100dvh] bg-background flex flex-col max-w-3xl mx-auto">
      <header className="sticky top-0 z-40 bg-background/92 backdrop-blur-2xl border-b border-border/70 px-3 py-2.5 flex items-center gap-2">
        <button
          onClick={onBack}
          aria-label="Назад к списку врачей"
          data-testid="chat-back"
          className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-muted"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <Avatar className="w-10 h-10 rounded-xl">
          <AvatarImage src={doctor.avatar} alt={doctor.name} className="object-cover" />
          <AvatarFallback className="rounded-xl">{doctor.name[0]}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm truncate">{doctor.name}</p>
          <p className="text-xs text-primary">{doctor.specialty} · {doctor.locations[0]?.clinic}</p>
        </div>
        <a
          href={`tel:${doctor.phone.replace(/[^+\d]/g, "")}`}
          aria-label="Позвонить врачу"
          className="w-11 h-11 rounded-full flex items-center justify-center bg-primary/10 text-primary hover:bg-emerald-600/20"
        >
          <Phone className="w-4 h-4" />
        </a>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground bg-muted/50 rounded-2xl px-4 py-3 max-w-xs mx-auto">
            Напишите сообщение. Ответ появится здесь, когда собеседник его отправит.
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex", m.sender === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                m.sender === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted rounded-bl-md"
              )}
            >
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
              <p className={cn("text-[10px] mt-1", m.sender === "user" ? "text-white/70" : "text-muted-foreground")}>
                {m.time}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {sendMutation.isError && <p role="alert" className="p-3 text-sm text-destructive">Сообщение не отправлено. Текст сохранён — попробуйте ещё раз.</p>}
      <div className="sticky bottom-0 bg-background border-t border-border/60 px-3 py-2.5 flex items-center gap-2 safe-area-pb">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Сообщение врачу…"
          className="flex-1 bg-muted/60 border-0 rounded-2xl"
          style={{ height: "46px" }}
          data-testid="chat-input"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sendMutation.isPending}
          aria-label="Отправить"
          data-testid="chat-send"
          className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
