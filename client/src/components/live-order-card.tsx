import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MapPin, MessageCircle, ChevronRight } from "lucide-react";
import type { Master, Order } from "@shared/schema";
import { providerDisplayName } from "@shared/provider-directory";

function stage(order: Order) {
  if (order.status === "pending") return 1;
  if (order.travelStatus === "arrived") return 4;
  if (order.travelStatus === "en_route") return 3;
  return 2;
}

function headline(order: Order, name: string) {
  if (order.status === "pending") return "Ждём подтверждения мастера";
  if (order.travelStatus === "en_route") return `${name} в пути`;
  if (order.travelStatus === "arrived") return `${name} на месте`;
  return `${name} принял заказ`;
}

/** The client's current order, pinned to the top of the home screen like a live activity. */
export function LiveOrderCard({ clientId, masters }: { clientId: number; masters: Master[] }) {
  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders", clientId],
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/orders", { signal, credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Не удалось загрузить заказы");
      return response.json();
    },
    refetchInterval: 15_000,
  });
  const order = orders.find((item) => item.status === "in_progress") ?? orders.find((item) => item.status === "pending");
  if (!order) return null;
  const master = masters.find((item) => item.id === order.masterId);
  const name = master ? providerDisplayName(master).split(/\s+/)[0] : "Мастер";
  const initials = master ? providerDisplayName(master).split(/\s+/).map((part) => part[0]).join("").slice(0, 2) : "";
  const done = stage(order);

  return <section className="live-order" aria-label="Текущий заказ" data-testid={`live-order-${order.id}`}>
    <div className="live-order-row">
      <div className="live-order-avatar" aria-hidden="true">{master?.avatar ? <img src={master.avatar} alt="" /> : initials}</div>
      <div className="min-w-0 flex-1">
        <small>{order.title} · {order.date}</small>
        <strong role="status" aria-live="polite">{headline(order, name)}</strong>
      </div>
      <Link href="/orders" aria-label="Все заказы" className="flex h-11 w-11 shrink-0 items-center justify-center"><ChevronRight size={20} aria-hidden="true" /></Link>
    </div>
    <div className="live-order-steps" role="img" aria-label={`Этап ${done} из 4`}>
      {[1, 2, 3, 4].map((step) => <span key={step} className={step <= done ? "is-done" : undefined} />)}
    </div>
    <div className="live-order-actions">
      <Link href={`/orders/${order.id}/chat`}><MessageCircle size={17} aria-hidden="true" />Чат</Link>
      {order.liveLocationUrl
        ? <a href={order.liveLocationUrl} target="_blank" rel="noopener noreferrer"><MapPin size={17} aria-hidden="true" />Где мастер</a>
        : <Link href="/orders">Детали</Link>}
    </div>
  </section>;
}
