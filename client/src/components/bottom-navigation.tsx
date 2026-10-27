import { Home, ClipboardList, MessageCircle, User, Plus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useUnreadCounts } from "@/hooks/use-unread-counts";

const tabs = [
  { id: "home", path: "/", icon: Home, label: "Главная" },
  { id: "orders", path: "/orders", icon: ClipboardList, label: "Заказы" },
  { id: "messages", path: "/messages", icon: MessageCircle, label: "Чаты" },
  { id: "profile", path: "/profile", icon: User, label: "Профиль" },
] as const;

/** Opens the request composer on the orders/requests screen. */
export const NEW_REQUEST_PATH = "/requests?new=1";

function NavTab({ id, path, icon: Icon, label, active, count, desktop }: {
  id: string; path: string; icon: typeof Home; label: string; active: boolean; count: number; desktop: boolean;
}) {
  return <Link href={path}
    className={cn("primary-nav-link", active && "is-active")} aria-current={active ? "page" : undefined}
    data-testid={`${desktop ? "desktop-" : ""}nav-${id}`}>
    <span className="primary-nav-icon"><Icon size={22} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
      {count > 0 && <span className="primary-nav-count" aria-label={`${count} непрочитанных`}>{count > 99 ? "99+" : count}</span>}
    </span><span>{label}</span>
  </Link>;
}

export function PrimaryNavLinks({ desktop = false }: { desktop?: boolean }) {
  const [location] = useLocation();
  const { totalCount } = useUnreadCounts();
  const active = (id: string) => {
    if (id === "home") return ["/", "/organizations", "/auto-parts", "/doctors", "/contacts", "/city", "/lost-found", "/more"].includes(location) || /^\/master\/\d+/.test(location) || location.startsWith("/auto-parts/");
    if (id === "orders") return location === "/requests" || location === "/orders";
    if (id === "messages") return location.startsWith("/messages") || /^\/orders\/\d+\/chat/.test(location);
    if (id === "profile") return location.startsWith("/profile") || location.startsWith("/saved");
    return false;
  };
  const visible = tabs.filter((tab) => !desktop || tab.id !== "profile");
  const create = <Link key="create" href={NEW_REQUEST_PATH} className="primary-nav-create" data-testid={`${desktop ? "desktop-" : ""}nav-create`}>
    <Plus size={desktop ? 18 : 26} strokeWidth={2.4} aria-hidden="true" /><span className={desktop ? "create-word" : "sr-only"}>Новая заявка</span>
  </Link>;
  const items = visible.map((tab) => <NavTab key={tab.id} {...tab} active={active(tab.id)} count={tab.id === "messages" ? totalCount : 0} desktop={desktop} />);
  // Mobile: the action sits in the thumb's centre; desktop: it trails the links.
  if (desktop) return <>{items}{create}</>;
  return <>{items.slice(0, 2)}{create}{items.slice(2)}</>;
}

export function BottomNavigation({ desktopHidden = false }: { desktopHidden?: boolean }) {
  return <nav className={cn("primary-bottom-nav", desktopHidden && "primary-bottom-nav-mobile")} aria-label="Основные разделы">
    <div className="primary-bottom-nav-inner"><PrimaryNavLinks /></div>
  </nav>;
}
