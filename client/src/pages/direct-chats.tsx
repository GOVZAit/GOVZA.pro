import { useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/auth-context";
import MasterBottomNavigation from "@/components/master-bottom-navigation";
import OrganizationBottomNavigation from "@/components/organization-bottom-navigation";
import { BottomNavigation } from "@/components/bottom-navigation";
import type { DirectConversationView } from "@shared/direct-chat-schema";

function formatWhen(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat("ru-RU", sameDay
    ? { hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short" }).format(date);
}

export default function DirectChatsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const { data: conversations = [], isLoading } = useQuery<DirectConversationView[]>({
    queryKey: ["/api/direct-chats"],
    enabled: !!user,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const backPath = user?.role === "organization"
    ? "/organization"
    : user?.role === "master"
      ? "/master"
      : "/more";

  const chatBase = user?.role === "organization"
    ? "/organization/messages"
    : user?.role === "master"
      ? "/master/messages"
      : "/messages";

  const title = user?.role === "client" ? "Чаты" : "Сообщения клиентов";
  const description = user?.role === "client"
    ? "Диалоги с мастерами и организациями GOVZA"
    : "Прямые обращения клиентов до и вне заказа";

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "")),
    [conversations],
  );

  return (
    <div className="app-page bg-background">
      <header className="app-header-shell safe-area-pt">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-2xl" onClick={() => navigate(backPath)} aria-label="Назад">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-extrabold tracking-[-0.04em]">{title}</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 px-4 py-5">
        {user?.role === "client" && <Link href="/orders" className="directory-secondary w-full justify-between">Переписка по заказам<ChevronRight size={18} aria-hidden="true" /></Link>}
        {isLoading ? (
          <>
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </>
        ) : sorted.length === 0 ? (
          <div className="premium-card py-14 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MessageCircle className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-extrabold">Диалогов пока нет</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {user?.role === "client"
                ? "Откройте профиль исполнителя и нажмите «Написать»."
                : "Новые обращения клиентов появятся здесь."}
            </p>
          </div>
        ) : (
          sorted.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => navigate(`${chatBase}/${conversation.id}`)}
              className="premium-card pressable flex w-full items-center gap-3 p-3.5 text-left"
            >
              <Avatar className="h-12 w-12 rounded-2xl">
                {conversation.counterpartAvatar ? (
                  <AvatarImage src={conversation.counterpartAvatar} alt={conversation.counterpartName} className="object-cover" />
                ) : null}
                <AvatarFallback className="rounded-2xl bg-primary/10 font-bold text-primary">
                  {conversation.counterpartName.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-sm font-extrabold">{conversation.counterpartName}</h2>
                  {conversation.lastMessageAt && (
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                      {formatWhen(conversation.lastMessageAt)}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <p className="truncate text-xs text-muted-foreground">
                    {conversation.lastMessage || "Диалог создан"}
                  </p>
                  {conversation.unreadCount > 0 && (
                    <span className="ml-auto inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                      {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))
        )}
      </main>

      {user?.role === "master" && <MasterBottomNavigation />}
      {user?.role === "organization" && <OrganizationBottomNavigation />}
      {user?.role === "client" && <BottomNavigation />}
    </div>
  );
}
