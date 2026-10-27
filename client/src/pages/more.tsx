import { Building2, CarFront, Stethoscope, ChevronRight, ClipboardList, Download, Heart, Landmark, MessageCircle, PackageSearch, ReceiptText } from "lucide-react";
import { Link } from "wouter";
import { DirectoryFrame } from "@/components/directory-layout";
import productFeatures from "@shared/product-features.json";
const personal = [
  { href: "/orders", icon: ReceiptText, title: "Мои заказы", description: "Статусы, переписка и завершённые работы" },
  { href: "/requests", icon: ClipboardList, title: "Мои заявки", description: "Предложения исполнителей по вашим задачам" },
  { href: "/messages", icon: MessageCircle, title: "Сообщения", description: "Диалоги с мастерами и организациями" },
  { href: "/saved", icon: Heart, title: "Избранное", description: "Сохранённые и просмотренные специалисты" },
];
const services = [
  { href: "/organizations", icon: Building2, title: "Организации", description: "Компании, бригады, клиники и сервисные центры" },
  { href: "/auto-parts", icon: CarFront, title: "Запчасти", description: "Магазины и авторазборы" },
  { href: "/doctors", icon: Stethoscope, title: "Врачи", description: "Специалисты и клиники" },
  { href: "/contacts", icon: Landmark, title: "Город и контакты", description: "Службы, организации, телефоны и адреса" },
  { href: "/lost-found", icon: PackageSearch, title: "Потеряно / Найдено", description: "Вещи, документы и животные" },
  { href: "/auto-parts/requests", icon: PackageSearch, title: "Запросы запчастей", description: "Предложения магазинов и авторазборов" },
];
export default function MorePage() {
  return <DirectoryFrame title="Ещё" description="Ваши дела и полезные сервисы.">
    <main className="directory-container directory-menu mt-3">
      {[personal, services.filter(item => productFeatures.autoParts || !item.href.startsWith("/auto-parts"))].map((items, i) => <section key={i}>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground">{i === 0 ? "Ваши дела" : "Сервисы"}</h2>
        <div className="directory-menu-group">{items.map(({ href, icon: Icon, title, description }) => <Link key={href} href={href}>
          <Icon size={21} /><span className="min-w-0 flex-1"><strong className="text-[15px] font-semibold">{title}</strong><small>{description}</small></span><ChevronRight size={16} />
        </Link>)}{i === 1 && <button type="button" onClick={() => window.dispatchEvent(new Event("govza:install"))}>
          <Download size={21} /><span className="min-w-0 flex-1"><strong className="text-[15px] font-semibold">Установить GOVZA</strong><small>Быстрый доступ с экрана телефона</small></span><ChevronRight size={16} />
        </button>}</div>
      </section>)}
    </main>
  </DirectoryFrame>;
}
