import { useAuth } from "@/contexts/auth-context";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { ShoppingBag } from "lucide-react";
import { OrderCard } from "@/components/order-card";
import { ReviewModal } from "@/components/review-modal";
import { BookingModal } from "@/components/booking-modal";
import { BottomNavigation } from "@/components/bottom-navigation";
import { OrdersSwitch } from "@/components/orders-switch";
import { AppBrandHeader } from "@/components/app-brand-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import type { Order, Master } from "@shared/schema";

function OrderSkeleton() {
  return (
    <div className="premium-card space-y-3 p-4 animate-pulse">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-9 w-full rounded-xl" />
    </div>
  );
}

export default function OrdersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const ownerId = user?.role === "client" ? user.id : null;
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [repeatOrder, setRepeatOrder] = useState<Order | null>(null);
  const [, navigate] = useLocation();

  const { data: orders = [], isLoading: ordersLoading, isError, refetch } = useQuery<Order[]>({
    queryKey: ["/api/orders", ownerId], enabled: ownerId !== null,
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/orders", { signal, credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Не удалось загрузить заказы");
      return response.json();
    },
    refetchInterval: 15_000,
  });
  const { data: masters = [], isError: mastersError, isLoading: mastersLoading } = useQuery<Master[]>({ queryKey: ["/api/masters"], enabled: ownerId !== null, staleTime: 30_000, refetchOnWindowFocus: true });
  const { data: reviewed = { orderIds: [] } } = useQuery<{ orderIds: number[] }>({ queryKey: ["/api/order-reviews/mine", ownerId], enabled: ownerId !== null, queryFn: async ({ signal }) => {
    const response = await fetch("/api/order-reviews/mine", { signal, credentials: "include", cache: "no-store" });
    if (!response.ok) throw new Error("Не удалось проверить отзывы");
    return response.json();
  } });

  return (
    <div className="app-page bg-background">
      <header className="app-header-shell sticky top-0 z-40 safe-area-pt">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <AppBrandHeader compact />
          <div className="mt-6">
            <h1 className="text-3xl font-extrabold tracking-[-0.04em]">Заказы</h1>
            <OrdersSwitch current="orders" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-5">
        {!authLoading && ownerId === null ? (
          <EmptyState icon={<ShoppingBag className="h-10 w-10" />} title="Войдите, чтобы увидеть заказы" description="Заказы и повторная запись доступны в вашем аккаунте." action={<Button onClick={() => navigate("/auth")}>Войти</Button>} />
        ) : isError ? (
          <EmptyState icon={<ShoppingBag className="h-10 w-10" />} title="Не удалось загрузить заказы" description="Проверьте соединение. Ваши заказы не потеряны." action={<Button onClick={() => void refetch()}>Повторить</Button>} />
        ) : authLoading || ordersLoading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => <OrderSkeleton key={index} />)}
          </div>
        ) : orders.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {orders.map((order) => {
              const master = masters.find((item) => item.id === order.masterId && item.isVisible !== false);
              return (
                <div key={order.id}><OrderCard
                  order={order}
                  master={master}
                  onLeaveReview={order.status === "completed" && !reviewed.orderIds.includes(order.id) ? () => setReviewOrder(order) : undefined}
                  onOpenChat={() => navigate(`/orders/${order.id}/chat`)}
                  onRepeatOrder={order.status === "completed" && master ? () => setRepeatOrder(order) : undefined}
                />
                {order.status === "completed" && !master && !mastersLoading && <p className="px-4 pb-4 text-sm text-muted-foreground">{mastersError ? "Не удалось загрузить данные мастера для повторной записи." : "Профиль этого мастера больше недоступен."} <button className="min-h-11 text-primary underline" onClick={() => navigate("/")}>Найти мастера</button></p>}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<ShoppingBag className="h-10 w-10" />}
            title="Нет заказов"
            description="Вы ещё не делали заказов. Найдите нужного мастера и оформите первый заказ."
            action={<Button className="rounded-2xl" onClick={() => navigate("/")}>Найти мастера</Button>}
          />
        )}
      </main>

      {reviewOrder && <ReviewModal order={reviewOrder} onClose={() => setReviewOrder(null)} />}
      {repeatOrder && (() => {
        const master = masters.find((item) => item.id === repeatOrder.masterId);
        return master ? (
          <BookingModal
            master={master}
            initialService={repeatOrder.title}
            initialAddress={repeatOrder.address ?? ""}
            initialComment={repeatOrder.comment ?? ""}
            heading="Повторить заказ"
            onClose={() => setRepeatOrder(null)}
          />
        ) : null;
      })()}
      <BottomNavigation />
    </div>
  );
}
