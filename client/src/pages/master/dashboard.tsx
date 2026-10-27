import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/queryClient";
import MasterBottomNavigation from "@/components/master-bottom-navigation";
import OrganizationBottomNavigation from "@/components/organization-bottom-navigation";
import { AppBrandHeader } from "@/components/app-brand-header";
import {
  ChevronRight, ClipboardCheck, Clock, MapPin, MessageCircle, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Master, Order } from "@shared/schema";
import type { DirectConversationView } from "@shared/direct-chat-schema";

function priceNumber(value: string) {
  return Number(value.replace(/\D/g, "")) || 0;
}

export default function MasterDashboardPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const masterId = user?.masterId;
  const isOrganization = user?.role === "organization";
  const ordersPath = isOrganization ? "/organization/orders" : "/master/orders";
  const profilePath = isOrganization ? "/organization/profile" : "/master/profile";
  const messagesPath = isOrganization ? "/organization/messages" : "/master/messages";

  const { data: master } = useQuery<Master>({
    queryKey: [`/api/masters/${masterId}`],
    enabled: !!masterId,
  });
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: !!user,
  });
  const { data: conversations = [] } = useQuery<DirectConversationView[]>({
    queryKey: ["/api/direct-chats"],
    enabled: !!user,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const onlineMutation = useMutation({
    mutationFn: (isOnline: boolean) => apiRequest("PATCH", `/api/masters/${masterId}`, { isOnline }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/masters/${masterId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/masters"] });
    },
  });

  const pending = orders.filter((order) => order.status === "pending");
  const active = orders.filter((order) => order.status === "in_progress");
  const completed = orders.filter((order) => order.status === "completed");
  const earnings = completed.reduce((sum, order) => sum + priceNumber(order.price), 0);
  const isOnline = master?.isOnline ?? false;

  const next = active[0] ?? pending[0];
  const today = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const stats = [
    { label: "новых", value: pending.length },
    { label: "в работе", value: active.length },
    { label: "заработано", value: `${earnings.toLocaleString("ru-RU")} ₽` },
  ];

  return (
    <div className="app-page bg-background">
      <header className="app-header-shell safe-area-pt">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <AppBrandHeader compact />
          <div className="mt-6">
            <p className="text-sm font-semibold capitalize text-muted-foreground">{today}</p>
            <h1 className="display-face mt-1 text-3xl font-semibold">
              {user?.name ? `Сегодня, ${user.name.split(/\s+/)[0]}` : "Сегодня"}
            </h1>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {isOrganization ? "Кабинет организации" : "Кабинет мастера"}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-5">
        <button
          type="button"
          onClick={() => onlineMutation.mutate(!isOnline)}
          disabled={onlineMutation.isPending || !master}
          aria-pressed={isOnline}
          className={cn("pro-online pressable", isOnline && "is-on")}
          data-testid="button-online-toggle"
        >
          <span className="min-w-0 flex-1">
            <b>{isOnline ? "Вы на линии" : "Вы не на линии"}</b>
            <small>{isOnline ? "Клиенты видят «Свободен сейчас» и могут сразу записаться" : "Профиль доступен, но в «Свободны сейчас» вас не видно"}</small>
          </span>
          <span className="pro-switch" aria-hidden="true" />
        </button>

        <section className="grid grid-cols-3 gap-2" aria-label="Сводка">
          {stats.map(({ label, value }) => (
            <div key={label} className="pro-stat">
              <b>{isLoading ? "—" : value}</b>
              <span>{label}</span>
            </div>
          ))}
        </section>

        {next && (
          <section aria-label="Следующий заказ">
            <h2 className="section-title mb-3">{next.status === "in_progress" ? "Сейчас в работе" : "Ждёт вашего решения"}</h2>
            <div className="pro-next" data-testid={`dashboard-next-${next.id}`}>
              <div className="flex items-center justify-between gap-3">
                <time>{next.date}</time>
                <span className="shrink-0 text-base font-extrabold">{next.price}</span>
              </div>
              <div className="mt-2 text-base font-extrabold">{next.title}</div>
              {next.address && <p className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{next.address}</p>}
              <div className="pro-next-actions">
                <button type="button" onClick={() => navigate(ordersPath)}>
                  {next.status === "in_progress" ? "Открыть заказ" : "Принять или отклонить"}
                </button>
                <button type="button" onClick={() => navigate(`${ordersPath}/${next.id}/chat`)} aria-label="Чат с клиентом">
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">Новые заказы</h2>
              <p className="mt-1 text-xs text-muted-foreground">Заявки клиентов, которые ждут решения</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(ordersPath)}
              className="flex min-h-11 items-center gap-1 text-sm font-bold text-primary"
            >
              Все <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {pending.length === 0 ? (
            <div className="premium-card py-12 text-center">
              <ClipboardCheck className="mx-auto h-8 w-8 text-primary/60" />
              <p className="mt-3 text-sm font-bold">Новых заказов пока нет</p>
              <p className="mt-1 text-xs text-muted-foreground">Они появятся здесь после выбора вашего предложения.</p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {pending.slice(0, 4).map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => navigate(ordersPath)}
                  className="premium-card pressable w-full p-4 text-left"
                  data-testid={`dashboard-order-${order.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-extrabold">{order.title}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 text-primary" /> {order.date}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-extrabold text-primary">{order.price}</span>
                  </div>
                  {order.address && (
                    <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-muted/55 p-2.5 text-xs text-muted-foreground">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      {order.address}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">Сообщения клиентов</h2>
              <p className="mt-1 text-xs text-muted-foreground">Прямые обращения вне конкретного заказа</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(messagesPath)}
              className="flex min-h-11 items-center gap-1 text-sm font-bold text-primary"
            >
              Все <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {conversations.length === 0 ? (
            <div className="premium-card py-10 text-center">
              <MessageCircle className="mx-auto h-8 w-8 text-primary/60" />
              <p className="mt-3 text-sm font-bold">Сообщений пока нет</p>
              <p className="mt-1 text-xs text-muted-foreground">Клиенты могут написать из вашего публичного профиля.</p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {conversations.slice(0, 4).map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => navigate(`${messagesPath}/${conversation.id}`)}
                  className="premium-card pressable w-full p-4 text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <MessageCircle className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-extrabold">{conversation.counterpartName}</h3>
                        {conversation.unreadCount > 0 && (
                          <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {conversation.lastMessage || "Новый диалог"}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={() => navigate(profilePath)}
          className="hero-gradient flex w-full items-center justify-between gap-4 rounded-[1.5rem] border border-primary/15 p-4 text-left shadow-sm"
        >
          <div>
            <p className="text-sm font-extrabold">Управление профилем</p>
            <p className="mt-1 text-xs text-muted-foreground">Услуги, расписание, документы, уведомления и видимость</p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Settings className="h-5 w-5" />
          </div>
        </button>
      </main>

      {isOrganization ? <OrganizationBottomNavigation /> : <MasterBottomNavigation />}
    </div>
  );
}
