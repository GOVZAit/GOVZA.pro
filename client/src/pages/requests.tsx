import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck, CheckCircle2, ChevronDown, ChevronUp, Clock,
  MapPin, MessageCircle, Plus, Search, Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNavigation } from "@/components/bottom-navigation";
import { BroadcastModal } from "@/components/broadcast-modal";
import { EmptyState } from "@/components/empty-state";
import { AppBrandHeader } from "@/components/app-brand-header";
import { OrdersSwitch } from "@/components/orders-switch";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { RequestResponseView, ServiceRequestView } from "@shared/request-schema";

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Рейтинг ${rating}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={cn("text-xs", star <= Math.round(rating) ? "text-amber-400" : "text-muted-foreground/25")}>★</span>
      ))}
      <span className="ml-1 text-[11px] font-bold text-muted-foreground">{rating.toFixed(1)}</span>
    </div>
  );
}

function RequestStatus({ status }: { status: ServiceRequestView["status"] }) {
  const content = status === "matched"
    ? { label: "Мастер выбран", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" }
    : status === "cancelled"
      ? { label: "Закрыта", className: "bg-muted text-muted-foreground" }
      : { label: "Ищем мастера", className: "bg-primary/10 text-primary" };

  return <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", content.className)}>{content.label}</span>;
}

function RequestCard({ request }: { request: ServiceRequestView }) {
  const [expanded, setExpanded] = useState(false);
  const [showResponses, setShowResponses] = useState(request.status === "matched");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const responsesQuery = useQuery<RequestResponseView[]>({
    queryKey: ["/api/requests", request.id, "responses"],
    enabled: showResponses && request.responses > 0,
  });

  const selectMutation = useMutation({
    mutationFn: (responseId: number) => apiRequest("POST", `/api/requests/${request.id}/responses/${responseId}/select`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/requests"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/requests", request.id, "responses"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] }),
      ]);
      toast({ title: "Мастер выбран", description: "Заказ создан. Мастер увидит его в своём кабинете." });
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось выбрать мастера",
        description: error.message.includes("409") ? "Для этой заявки мастер уже выбран." : "Обновите страницу и попробуйте ещё раз.",
        variant: "destructive",
      });
    },
  });

  const responses = responsesQuery.data ?? [];

  return (
    <article className="premium-card overflow-hidden" data-testid={`card-request-${request.id}`}>
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{request.category}</span>
              <RequestStatus status={request.status} />
            </div>
            <h2 className="text-lg font-extrabold tracking-[-0.03em]">{request.title}</h2>
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground">{request.postedAt}</span>
        </div>

        <p className={cn("text-sm leading-relaxed text-muted-foreground", !expanded && "line-clamp-2")}>{request.description}</p>
        {request.description.length > 120 && (
          <button type="button" onClick={() => setExpanded((value) => !value)} className="flex min-h-8 items-center gap-1 text-xs font-bold text-primary">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? "Свернуть" : "Показать полностью"}
          </button>
        )}

        <div className="grid gap-2 rounded-2xl bg-muted/55 p-3 text-xs text-muted-foreground sm:grid-cols-2">
          <span className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-primary" />{request.budget}</span>
          <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary" />{request.location}</span>
        </div>

        <button
          type="button"
          onClick={() => setShowResponses((value) => !value)}
          disabled={request.responses === 0}
          className={cn(
            "flex min-h-12 w-full items-center justify-between rounded-2xl border px-3 text-sm font-bold",
            request.responses > 0 ? "border-primary/20 bg-primary/[0.03] text-primary" : "border-border/70 text-muted-foreground",
          )}
        >
          <span className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            {request.responses === 0 ? "Откликов пока нет" : `${request.responses} отклик${request.responses === 1 ? "" : "а"}`}
          </span>
          {request.responses > 0 && (showResponses ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
        </button>
      </div>

      {showResponses && request.responses > 0 && (
        <div className="border-t border-border/60 bg-muted/20">
          {responsesQuery.isLoading ? (
            <div className="space-y-3 p-4">{[1, 2].map((item) => <Skeleton key={item} className="h-28 rounded-2xl" />)}</div>
          ) : responses.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Отклики обновляются…</p>
          ) : (
            <div className="divide-y divide-border/60">
              {responses.map((response) => {
                const selected = request.selectedResponseId === response.id || response.status === "selected";
                return (
                  <div key={response.id} className="space-y-3 p-4">
                    <div className="flex items-center gap-3">
                      {response.avatar ? (
                        <img src={response.avatar} alt="" className="h-12 w-12 rounded-2xl object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 font-extrabold text-primary">
                          {response.masterName.slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-extrabold">{response.masterName}</p>
                          <p className="shrink-0 font-extrabold text-primary">{response.price}</p>
                        </div>
                        <StarRow rating={response.rating} />
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{response.text}</p>
                    {selected ? (
                      <div className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-500/10 px-3 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        <BadgeCheck className="h-4 w-4" /> Этот мастер выбран
                      </div>
                    ) : request.status === "open" ? (
                      <button
                        type="button"
                        disabled={selectMutation.isPending}
                        onClick={() => selectMutation.mutate(response.id)}
                        className="accent-gradient min-h-12 w-full rounded-2xl px-4 text-sm font-bold text-white disabled:opacity-50"
                      >
                        Выбрать мастера за {response.price}
                      </button>
                    ) : (
                      <p className="text-xs text-muted-foreground">Для заявки уже выбран другой исполнитель</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function RequestsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const [showCreate, setShowCreate] = useState(() => new URLSearchParams(search).get("new") === "1");
  // The "+" in the bottom navigation links here with ?new=1, including when this page is already open.
  useEffect(() => {
    if (new URLSearchParams(search).get("new") !== "1") return;
    setShowCreate(true);
    navigate("/requests", { replace: true });
  }, [search]);

  const { data: requests = [], isLoading, isError } = useQuery<ServiceRequestView[]>({
    queryKey: ["/api/requests"],
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="app-page bg-background">
        <main className="mx-auto max-w-lg px-4 py-20">
          <EmptyState
            icon={<Search className="h-10 w-10" />}
            title="Войдите, чтобы видеть заявки"
            description="После входа здесь будут храниться ваши заявки и отклики мастеров."
            action={<Button onClick={() => navigate("/auth")} className="rounded-2xl">Войти</Button>}
          />
        </main>
        {showCreate && <BroadcastModal onClose={() => setShowCreate(false)} />}
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="app-page bg-background">
      <header className="app-header-shell sticky top-0 z-40 safe-area-pt">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <AppBrandHeader compact />
          <div className="mt-6 flex items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold tracking-[-0.04em]">Заказы</h1>
              <OrdersSwitch current="requests" />
            </div>
            <Button size="icon" aria-label="Создать заявку" onClick={() => setShowCreate(true)} className="h-12 w-12 rounded-2xl shadow-sm">
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-5">
        {isLoading ? (
          <div className="grid gap-4 lg:grid-cols-2">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-56 rounded-[1.5rem]" />)}</div>
        ) : isError ? (
          <EmptyState icon={<Clock className="h-10 w-10" />} title="Не удалось загрузить заявки" description="Проверьте соединение и обновите страницу." />
        ) : requests.length > 0 ? (
          <div className="grid items-start gap-4 lg:grid-cols-2">{requests.map((request) => <RequestCard key={request.id} request={request} />)}</div>
        ) : (
          <EmptyState
            icon={<Search className="h-10 w-10" />}
            title="У вас пока нет заявок"
            description="Опишите задачу один раз — подходящие мастера смогут предложить цену и написать комментарий."
            action={<Button onClick={() => setShowCreate(true)} className="rounded-2xl"><Plus className="mr-2 h-4 w-4" /> Создать заявку</Button>}
          />
        )}
      </main>

      {showCreate && <BroadcastModal onClose={() => setShowCreate(false)} />}
      <BottomNavigation />
    </div>
  );
}
