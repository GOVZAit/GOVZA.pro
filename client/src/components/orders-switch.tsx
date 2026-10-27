import { Link } from "wouter";

/** One "Заказы" destination: booked orders and open requests live side by side. */
export function OrdersSwitch({ current }: { current: "orders" | "requests" }) {
  return <nav className="orders-switch" aria-label="Заказы и заявки">
    <Link href="/orders" aria-current={current === "orders" ? "page" : undefined}>Заказы</Link>
    <Link href="/requests" aria-current={current === "requests" ? "page" : undefined}>Заявки</Link>
  </nav>;
}
