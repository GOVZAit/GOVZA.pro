import { BadgeCheck, Heart, MapPin, Star, ArrowUpRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Master } from "@shared/schema";
import type { AvailabilityWindow } from "@shared/service-time";
import { Link } from "wouter";

interface MasterCardProps {
  master: Master;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  favoritePending?: boolean;
  availableToday?: AvailabilityWindow;
  comparison?: { selected: boolean; disabled: boolean; onToggle: () => void };
}

export function MasterCard({ master, isFavorite, onToggleFavorite, favoritePending, availableToday, comparison }: MasterCardProps) {
  return <article data-testid={`master-card-${master.id}`} className="directory-card directory-card-master relative">
    <div className="directory-card-header">
      <Avatar className="directory-avatar"><AvatarImage src={master.avatar} alt="" className="object-cover" />
        <AvatarFallback className="bg-transparent font-semibold">{master.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</AvatarFallback>
      </Avatar>
      <div className="directory-person">
        {master.companyName && <p className="directory-company">{master.companyName}</p>}
        <h3 data-testid={`text-name-${master.id}`}>{master.name}{master.verified && <BadgeCheck size={16} aria-label="Профиль проверен" />}</h3>
        <p>{master.category}</p>
      </div>
      <button type="button" onClick={onToggleFavorite} disabled={favoritePending} aria-pressed={isFavorite}
        data-testid={`favorite-master-${master.id}`} className="directory-icon-button relative z-10 -mr-2 -mt-2 disabled:opacity-50"
        aria-label={isFavorite ? "Убрать из избранного" : "Добавить в избранное"}>
        <Heart size={20} className={isFavorite ? "fill-primary text-primary" : ""} />
      </button>
    </div>
    <div className="directory-rating-row">
      {master.reviews > 0 ? <><span className="directory-rating"><Star size={14} aria-hidden="true" />{master.rating.toFixed(1)}</span><span className="directory-metadata">Отзывов: {master.reviews}</span></> : <span className="directory-metadata">Пока нет отзывов</span>}
      {master.isOnline && <span className="directory-tag directory-available ml-auto">Онлайн</span>}
    </div>
    {master.services.length > 0 && <p className="directory-service-list">{master.services.slice(0, 2).map((service) => service.name).join(" · ")}</p>}
    {availableToday && <p className="directory-tag directory-available mt-3" data-testid={`available-today-${master.id}`}>Свободен сегодня · {availableToday.fromTime}–{availableToday.toTime}</p>}
    <div className="directory-location"><MapPin size={15} aria-hidden="true" /><p className="directory-metadata">{[master.city, master.district].filter(Boolean).join(" · ") || "Город не указан"}</p></div>
    <div className="directory-card-bottom">
      <div className="min-w-0"><span className="directory-price">{master.showPrices !== false ? master.price || "По договорённости" : "По договорённости"}</span></div>
      <Link href={`/master/${master.id}`} aria-label={`Профиль: ${master.name}`} className="directory-secondary after:absolute after:inset-0 after:rounded-[20px] after:content-['']">Профиль<ArrowUpRight size={16} aria-hidden="true" /></Link>
    </div>
    {comparison && <button type="button" aria-pressed={comparison.selected} disabled={comparison.disabled}
      aria-label={`${comparison.selected ? "Убрать из сравнения" : "Добавить к сравнению"}: ${master.name}`}
      data-testid={`compare-master-${master.id}`} onClick={comparison.onToggle}
      className="directory-secondary relative z-10 mt-3 w-full disabled:opacity-50">
      {comparison.selected ? "Выбран для сравнения" : "Добавить к сравнению"}
    </button>}
  </article>;
}
