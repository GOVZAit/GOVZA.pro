import { useLocation, Link } from "wouter";
import { Home, ClipboardList, Building2, MessageCircle, PackageSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadCounts } from "@/hooks/use-unread-counts";
import productFeatures from "@shared/product-features.json";

const tabs = [
  { href: "/organization", label: "Главная", icon: Home },
  { href: "/organization/orders", label: "Заявки", icon: ClipboardList },
  { href: "/organization/parts-requests", label: "Запчасти", icon: PackageSearch },
  { href: "/organization/messages", label: "Сообщения", icon: MessageCircle },
  { href: "/organization/profile", label: "Организация", icon: Building2 },
];

export default function OrganizationBottomNavigation() {
  const [location] = useLocation();
  const { directCount, orderCount } = useUnreadCounts();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/70 bg-background/92 backdrop-blur-2xl safe-area-bottom shadow-[0_-18px_50px_-34px_hsl(var(--foreground)/0.34)] lg:bottom-5 lg:left-1/2 lg:right-auto lg:w-auto lg:-translate-x-1/2 lg:rounded-full lg:border">
      <div className="flex items-center justify-around px-2 py-1.5 max-w-lg mx-auto">
        {tabs.filter(tab => productFeatures.autoParts || tab.href !== "/organization/parts-requests").map(({ href, label, icon: Icon }) => {
          const active = location === href || (href !== "/organization" && location.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "pressable min-w-[68px] min-h-[52px] flex flex-col items-center justify-center gap-0.5 px-4 py-1.5 rounded-2xl transition-all lg:flex-row",
                active ? "nav-active-pill text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="relative">
                <Icon className={cn("w-6 h-6", active && "scale-110")} />
                {((href === "/organization/messages" ? directCount : href === "/organization/orders" ? orderCount : 0) > 0) && (
                  <span className="absolute -right-2.5 -top-2 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[9px] font-bold leading-none text-primary-foreground">
                    {(href === "/organization/messages" ? directCount : orderCount) > 99 ? "99+" : (href === "/organization/messages" ? directCount : orderCount)}
                  </span>
                )}
              </span>
              <span className={cn("text-[10px] font-medium", active && "font-semibold")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
