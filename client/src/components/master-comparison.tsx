import { Link } from "wouter";
import { ResponsivePanel } from "@/components/responsive-panel";
import type { Master } from "@shared/schema";
import { providerDisplayName, type ProviderDirectory } from "@shared/provider-directory";

export function MasterComparison({ masters, onRemove, onClose, directory = "specialists" }: {
  masters: Master[]; onRemove: (id: number) => void; onClose: () => void; directory?: ProviderDirectory;
}) {
  return <ResponsivePanel open onOpenChange={open => { if (!open) onClose(); }} title={directory === "organizations" ? "Сравнение организаций" : "Сравнение мастеров"}
    description="Сравните услуги и цены из профилей. Итоговую стоимость согласуйте с исполнителем."
    footer={<button type="button" className="directory-primary" onClick={onClose}>Продолжить выбор</button>}>
    {masters.length < 2 && <p role="status" className="request-draft-note">Для сравнения выберите ещё одного специалиста в каталоге.</p>}
    <div className="master-comparison-list">{masters.map(master => <section key={master.id} aria-label={`Сравнение: ${providerDisplayName(master)}`} data-testid={`comparison-row-${master.id}`}>
      <div className="flex items-start justify-between gap-3"><h3 className="font-semibold text-base break-words">{providerDisplayName(master)}</h3>
        <button type="button" className="directory-clear shrink-0" aria-label={`Убрать из сравнения: ${providerDisplayName(master)}`} onClick={() => onRemove(master.id)}>Убрать</button></div>
      <dl className="master-comparison-facts">
        <div><dt>Цена</dt><dd className="font-semibold">{master.showPrices === false ? "По договорённости" : master.price || "По договорённости"}</dd></div>
        <div><dt>Услуга</dt><dd>{master.category}</dd></div>
        <div><dt>Город</dt><dd>{[master.city, master.district].filter(Boolean).join(" · ") || "Не указан"}</dd></div>
        <div><dt>Работы</dt><dd>{master.services.slice(0, 3).map(service => service.name).join(" · ") || "Уточните у исполнителя"}</dd></div>
      </dl>
      <Link href={`/master/${master.id}`} className="directory-secondary" onClick={onClose}>Профиль: {providerDisplayName(master)}</Link>
    </section>)}</div>
  </ResponsivePanel>;
}
