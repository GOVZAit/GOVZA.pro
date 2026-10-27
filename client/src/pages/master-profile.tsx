import { useFavorites } from "@/hooks/use-favorites";
import { useRecordMasterView, useServiceClock } from "@/hooks/use-master-memory";
import { isAvailableToday, serviceNow } from "@shared/service-time";
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Heart, MapPin, Clock, BadgeCheck, Shield,
  MessageCircle, Phone, PhoneOff, Star, Building2, Award, Share2, Send,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { RatingStars } from "@/components/ui/rating-stars";
import { BookingModal } from "@/components/booking-modal";
import { PortfolioLightbox } from "@/components/portfolio-lightbox";
import { InviteProviderModal } from "@/components/invite-provider-modal";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { executorTypeLabels } from "@shared/schema";
import { isOrganizationProfile, providerDisplayName } from "@shared/provider-directory";
import type { Master } from "@shared/schema";
import type { MasterReviewSummary } from "@shared/order-review-schema";
import type { AvailabilityDayView } from "@shared/provider-engagement-schema";

// ── Call availability logic ───────────────────────────────────────────────────

type CallState =
  | { status: 'active'; phone: string }
  | { status: 'offline'; note: string }
  | { status: 'outside_hours'; note: string }
  | { status: 'disabled' };

function getCallState(master: Master): CallState {
  if (master.callMode === 'disabled') return { status: 'disabled' };

  if (master.callMode === 'always') {
    return { status: 'active', phone: master.phone ?? '' };
  }

  if (master.callMode === 'online_only') {
    if (master.isOnline) return { status: 'active', phone: master.phone ?? '' };
    return { status: 'offline', note: 'Мастер сейчас офлайн' };
  }

  // schedule
  const now = new Date();
  const [fH, fM] = (master.workingHours?.from ?? '09:00').split(':').map(Number);
  const [tH, tM] = (master.workingHours?.to ?? '18:00').split(':').map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const fromMin = fH * 60 + fM;
  const toMin = tH * 60 + tM;
  if (nowMin >= fromMin && nowMin < toMin) {
    return { status: 'active', phone: master.phone ?? '' };
  }
  return {
    status: 'outside_hours',
    note: `Принимает звонки ${master.workingHours?.from ?? '09:00'}–${master.workingHours?.to ?? '18:00'}`,
  };
}

// ── Reviews ───────────────────────────────────────────────────────────────────

type DisplayReview = {
  name: string;
  avatar: string;
  rating: number;
  text: string;
  date: string;
  service: string;
  providerReply?: string;
};

const reviewsByMasterId: Record<number, DisplayReview[]> = {
  1: [
    { name: "Рамзан Д.", avatar: "https://images.unsplash.com/photo-1599566150163-29194dcabd36?w=60&h=60&fit=crop&crop=face", rating: 5, text: "Умар пришёл в срок, работу сделал быстро и чисто. Кран больше не течёт! Буду обращаться ещё.", date: "10 апр 2026", service: "Замена смесителя" },
    { name: "Зара Э.", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop&crop=face", rating: 5, text: "Отличный специалист. Прочистил засор за 20 минут, объяснил причину и дал советы по профилактике.", date: "5 апр 2026", service: "Прочистка засора" },
    { name: "Аслан М.", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face", rating: 4, text: "Хорошая работа, немного задержался, но предупредил заранее. Результатом доволен.", date: "28 мар 2026", service: "Установка унитаза" },
  ],
  2: [
    { name: "Лейла Г.", avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=60&h=60&fit=crop&crop=face", rating: 5, text: "Зулейха — настоящий профессионал! Квартира блестит, всё сделала аккуратно и быстро.", date: "9 апр 2026", service: "Генеральная уборка" },
    { name: "Малика В.", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop&crop=face", rating: 5, text: "Второй раз пользуюсь услугами — всегда на высоте. Рекомендую всем!", date: "1 апр 2026", service: "Уборка 2-комн." },
  ],
  3: [
    { name: "Ибрагим Ч.", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop&crop=face", rating: 5, text: "Ислам разобрался со сложной проводкой, которую другие не брались делать. Настоящий профи.", date: "8 апр 2026", service: "Разводка проводки" },
    { name: "Хасан Э.", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=60&h=60&fit=crop&crop=face", rating: 4, text: "Быстро и качественно заменил розетки. Цена соответствует работе.", date: "2 апр 2026", service: "Замена розетки" },
    { name: "Аиша Б.", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=60&h=60&fit=crop&crop=face", rating: 5, text: "Отлично установил щиток, гарантия 2 года — это подкупает. Звоните смело!", date: "20 мар 2026", service: "Установка щитка" },
  ],
};

const defaultReviews: DisplayReview[] = [
  { name: "Клиент", avatar: "", rating: 5, text: "Отличная работа, всё сделано профессионально!", date: "Апрель 2026", service: "" },
];

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`w-3.5 h-3.5 ${s <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MasterProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showBooking, setShowBooking] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [revealPhone, setRevealPhone] = useState(false);
  const [portfolioIndex, setPortfolioIndex] = useState<number | null>(null);
  const [reviewSort, setReviewSort] = useState<"newest" | "high" | "low">("newest");

  const masterId = Number(id);

  const { data: master, isLoading: masterLoading } = useQuery<Master>({
    queryKey: [`/api/masters/${masterId}`], staleTime: 30_000, refetchOnWindowFocus: true,
  });

  const { data: reviewSummary } = useQuery<MasterReviewSummary>({
    queryKey: [`/api/masters/${masterId}/reviews`],
    enabled: Number.isInteger(masterId) && masterId > 0,
  });

  useRecordMasterView(master);
  const now = useServiceClock();
  const todayKey = serviceNow(now).date;

  const { data: availabilityRows = [], isError: availabilityError } = useQuery<AvailabilityDayView[]>({
    queryKey: ["/api/providers", masterId, "availability", todayKey],
    staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true,
    enabled: Number.isInteger(masterId) && masterId > 0,
    queryFn: async () => {
      const response = await fetch(`/api/providers/${masterId}/availability?from=${todayKey}&days=14`);
      if (!response.ok) throw new Error("Не удалось проверить расписание");
      return response.json();
    },
  });

  const availability = availabilityError ? [] : availabilityRows;

  const { favorites, toggle, isPending: favoritePending } = useFavorites();
  const isFavorite = favorites.includes(masterId);
  const toggleFavorite = () => toggle(masterId);

  const directChatMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/providers/${masterId}/direct-chat`);
      return response.json() as Promise<{ id: number }>;
    },
    onSuccess: (conversation) => {
      navigate(`/messages/${conversation.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Чат пока недоступен",
        description: error.message.includes("409")
          ? "Этот исполнитель ещё не подключил личный чат GOVZA."
          : "Не удалось открыть диалог. Попробуйте ещё раз.",
        variant: "destructive",
      });
    },
  });

  const openDirectChat = () => {
    if (user?.role !== "client") {
      navigate("/auth");
      return;
    }
    directChatMutation.mutate();
  };

  const shareProfile = async () => {
    if (!master) return;
    const url = new URL(`/master/${masterId}`, window.location.origin).href;
    const title = `${providerDisplayName(master)} — GOVZA мастера`;

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: `${master.name}: ${master.category}`,
          url,
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      toast({ title: "Ссылка на профиль скопирована" });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({ title: "Не удалось поделиться профилем", variant: "destructive" });
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (masterLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/92 backdrop-blur-2xl border-b border-border/70 px-4 py-3 safe-area-pt">
          <div className="flex items-center gap-4 max-w-lg mx-auto">
            <Button variant="ghost" size="icon" className="w-11 h-11" aria-label="Назад" onClick={() => navigate('/')}>
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <span className="font-semibold">Профиль исполнителя</span>
          </div>
        </header>
        <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
          <div className="premium-card p-6 space-y-4 animate-pulse">
            <div className="flex gap-4">
              <Skeleton className="w-20 h-20 rounded-[1.4rem] shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-36" />
              </div>
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          </div>
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!master) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Мастер не найден</p>
      </div>
    );
  }

  const isOrganization = isOrganizationProfile(master);
  const displayName = providerDisplayName(master);
  const verifiedReviews = reviewSummary?.reviews.map((review) => ({
    name: review.clientName,
    avatar: "",
    rating: review.rating,
    text: review.comment || "Оценка оставлена после завершённого заказа GOVZA.",
    date: new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(review.createdAt)),
    service: review.service,
    ...(review.providerReply ? { providerReply: review.providerReply } : {}),
  })) ?? [];
  const reviews: DisplayReview[] = verifiedReviews.length > 0 ? verifiedReviews : (reviewsByMasterId[masterId] ?? defaultReviews);
  const sortedReviews = [...reviews].sort((left, right) => {
    if (reviewSort === "high") return right.rating - left.rating;
    if (reviewSort === "low") return left.rating - right.rating;
    return 0;
  });
  const displayRating = reviewSummary && reviewSummary.count > 0 ? reviewSummary.average : master.rating;
  const displayReviewCount = reviewSummary && reviewSummary.count > 0 ? reviewSummary.count : master.reviews;
  const callState = getCallState(master);
  const todayAvailability = availability.find((day) => isAvailableToday(day, now));
  const nextAvailable = availability.find((day) => day.status === "available" && day.date > todayKey);
  const portfolioVisible = master.showPortfolio !== false && master.portfolio.length > 0;
  const reviewsVisible = master.showReviews !== false;
  const pricesVisible = master.showPrices !== false && master.services.length > 0;
  const tabCount = (pricesVisible ? 1 : 0) + (portfolioVisible ? 1 : 0) + (reviewsVisible ? 1 : 0);
  const defaultTab = pricesVisible ? "services" : portfolioVisible ? "portfolio" : "reviews";
  const tabGridClass = tabCount === 3 ? "grid-cols-3" : tabCount === 2 ? "grid-cols-2" : "grid-cols-1";

  // ── Profile view ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-24">
      {showBooking && (
        <BookingModal master={master} onClose={() => setShowBooking(false)} />
      )}
      {showInvite && (
        <InviteProviderModal master={master} onClose={() => setShowInvite(false)} />
      )}
      <PortfolioLightbox images={master.portfolio} index={portfolioIndex} onIndexChange={setPortfolioIndex} />

      <header className="sticky top-0 z-40 bg-background/92 backdrop-blur-2xl border-b border-border/70 px-4 py-3 safe-area-pt">
        <div className="flex items-center gap-4 max-w-lg mx-auto">
          <Button variant="ghost" size="icon" className="w-11 h-11" aria-label="Назад" onClick={() => navigate(isOrganization ? '/organizations' : '/')} data-testid="button-back">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <span className="font-semibold">{isOrganization ? "Профиль организации" : "Профиль мастера"}</span>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="w-11 h-11" aria-label="Поделиться профилем" onClick={() => void shareProfile()} data-testid="button-share-profile">
              <Share2 className="w-5 h-5 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" className="w-11 h-11" aria-label={isFavorite ? "Убрать из избранного" : "В избранное"} aria-pressed={isFavorite} onClick={toggleFavorite} disabled={favoritePending(masterId)} data-testid="button-favorite-profile">
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-rose-500 text-rose-500' : 'text-muted-foreground'}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-5 pb-44 max-w-lg mx-auto">
        {/* Profile card */}
        <div className="premium-card p-5 mb-4">
          <div className="flex gap-4 mb-4">
            <Avatar className="w-20 h-20 rounded-[1.4rem] shrink-0">
              <AvatarImage src={master.avatar} alt={master.name} className="object-cover" />
              <AvatarFallback className="rounded-[1.4rem] text-2xl">{master.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-2xl font-extrabold tracking-[-0.04em] break-words" data-testid="text-master-name">{displayName}</h1>
                {master.verified && <Shield className="w-4 h-4 text-green-500 shrink-0" />}
              </div>
              <p className="text-muted-foreground text-sm mb-2">{master.category}</p>
              {master.companyName && !isOrganization && (
                <div
                  className="inline-flex items-center gap-1 max-w-full bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium mb-2"
                  data-testid="text-master-company"
                  title={master.companyName}
                >
                  <Building2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">{master.companyName}</span>
                </div>
              )}
              <RatingStars rating={displayRating} reviews={displayReviewCount} />
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <MapPin className="w-3 h-3" />
                <span>{master.distance}</span>
                <span className="mx-1">·</span>
                <Clock className="w-3 h-3" />
                <span>{master.responseTime}</span>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed mb-4">{master.description}</p>

          {/* Executor type & certificate */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {master.executorType && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-muted text-muted-foreground rounded-full px-2.5 py-1" data-testid="badge-executor-type">
                {executorTypeLabels[master.executorType]}
              </span>
            )}
            {master.showCertificates !== false && master.hasCertificate && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-full px-2.5 py-1" data-testid="badge-certificate">
                <Award className="w-3 h-3" />
                Есть сертификат
              </span>
            )}
            {todayAvailability?.status === "available" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                Свободен сегодня {todayAvailability.fromTime}–{todayAvailability.toTime}
              </span>
            )}
            {todayAvailability?.status !== "available" && nextAvailable && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                Ближайшее окно: {new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(`${nextAvailable.date}T12:00:00`))}
              </span>
            )}
          </div>

          {/* Certificates & diplomas */}
          {master.showCertificates !== false && (master.certificates?.length ?? 0) > 0 && (
            <div className="mb-4" data-testid="section-certificates">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Сертификаты и дипломы
              </p>
              <div className="space-y-2">
                {master.certificates!.map((cert) => (
                  <div
                    key={cert.id}
                    className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/40 p-2.5"
                    data-testid={`certificate-${cert.id}`}
                  >
                    {cert.image ? (
                      <a href={cert.image} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <img
                          src={cert.image}
                          alt={cert.title}
                          className="w-14 h-14 rounded-lg object-cover bg-muted"
                          loading="lazy"
                        />
                      </a>
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
                        <Award className="w-6 h-6 text-blue-500" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">{cert.title}</p>
                      {(cert.issuer || cert.year) && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {[cert.issuer, cert.year].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Portfolio preview strip — visible immediately, full grid in the tab below */}
          {portfolioVisible && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Примеры работ
                </p>
                <span className="text-xs text-muted-foreground" data-testid="text-portfolio-count">
                  {master.portfolio.length} фото
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {master.portfolio.slice(0, 3).map((img, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => setPortfolioIndex(idx)}
                    className="aspect-square overflow-hidden rounded-xl bg-muted"
                    data-testid={`portfolio-preview-${idx}`}
                    aria-label={`Открыть работу ${idx + 1}`}
                  >
                    <img
                      src={img}
                      alt={`Работа ${idx + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={cn("grid gap-3 text-center", master.showPrices !== false ? "grid-cols-3" : "grid-cols-2")}>
            <div className="bg-primary/10 rounded-xl py-3 px-2">
              <p className="text-xl font-bold text-primary">{master.completedOrders}</p>
              <p className="text-xs text-muted-foreground">заказов</p>
            </div>
            <div className="bg-green-500/10 rounded-xl py-3 px-2">
              <p className="text-xl font-bold text-emerald-600 dark:text-green-400">{displayRating}</p>
              <p className="text-xs text-muted-foreground">рейтинг</p>
            </div>
            {master.showPrices !== false && (
              <div className="bg-amber-500/10 rounded-xl py-3 px-2">
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{master.price}</p>
                <p className="text-xs text-muted-foreground">цена</p>
              </div>
            )}
          </div>

          {master.verified && (
            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded-2xl px-3 py-2">
              <BadgeCheck className="w-4 h-4 shrink-0" />
              <span>{isOrganization ? "Данные организации проверены командой GOVZA" : "Личность и профессиональные навыки проверены командой GOVZA"}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        {tabCount > 0 && (
        <Tabs defaultValue={defaultTab} className="mb-6">
          <TabsList className={`w-full grid ${tabGridClass}`}>
            {pricesVisible && <TabsTrigger value="services" data-testid="tab-services">Услуги</TabsTrigger>}
            {portfolioVisible && <TabsTrigger value="portfolio" data-testid="tab-portfolio">Портфолио</TabsTrigger>}
            {reviewsVisible && <TabsTrigger value="reviews" data-testid="tab-reviews">Отзывы ({reviews.length})</TabsTrigger>}
          </TabsList>

          {pricesVisible && (
          <TabsContent value="services" className="mt-4 space-y-2">
            {master.services.map((service, idx) => (
              <div
                key={idx}
                className="premium-card p-4 flex items-center justify-between"
              >
                <span className="font-medium text-sm">{service.name}</span>
                <span className="font-bold text-primary text-sm">{service.price}</span>
              </div>
            ))}
          </TabsContent>
          )}

          {portfolioVisible && (
          <TabsContent value="portfolio" className="mt-4">
            <div className="grid grid-cols-2 gap-3">
              {master.portfolio.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPortfolioIndex(idx)}
                  className="overflow-hidden rounded-xl"
                  aria-label={`Открыть работу ${idx + 1}`}
                >
                  <img
                    src={img}
                    alt={`Работа ${idx + 1}`}
                    className="w-full aspect-[4/3] object-cover"
                    data-testid={`portfolio-image-${idx}`}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </TabsContent>
          )}

          {reviewsVisible && (
          <TabsContent value="reviews" className="mt-4 space-y-3">
            <div className="rounded-[1.4rem] bg-muted/60 p-4 flex items-center gap-4">
              <div className="text-center">
                <p className="text-4xl font-bold">{displayRating}</p>
                <StarRow rating={Math.round(displayRating)} />
                <p className="text-xs text-muted-foreground mt-1">{displayReviewCount} отзывов</p>
              </div>
              <div className="flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = reviews.filter((r) => r.rating === stars).length;
                  const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                  return (
                    <div key={stars} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-3">{stars}</span>
                      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {reviewSummary && reviewSummary.count > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Качество", reviewSummary.quality],
                  ["Сроки", reviewSummary.punctuality],
                  ["Цена", reviewSummary.priceMatch],
                  ["Вежливость", reviewSummary.courtesy],
                ].map(([label, value]) => (
                  <div key={String(label)} className="premium-card p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 font-bold">{value} / 5</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2" aria-label="Сортировка отзывов">
              {([
                ["newest", "Свежие"],
                ["high", "Высокие"],
                ["low", "Низкие"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setReviewSort(value)}
                  className={cn(
                    "min-h-9 rounded-full px-3 text-xs font-bold transition",
                    reviewSort === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {sortedReviews.map((review, idx) => (
              <div key={idx} data-testid={`review-${idx}`} className="premium-card p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <Avatar className="w-9 h-9">
                    {review.avatar ? (
                      <AvatarImage src={review.avatar} alt={review.name} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="text-xs font-bold">{review.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{review.name}</p>
                      <p className="text-xs text-muted-foreground">{review.date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRow rating={review.rating} />
                      {review.service && <span className="text-xs text-muted-foreground">· {review.service}</span>}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">«{review.text}»</p>
                {review.providerReply && (
                  <div className="rounded-2xl bg-primary/[0.06] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
                      Ответ исполнителя
                    </p>
                    <p className="mt-1 text-sm leading-relaxed">{review.providerReply}</p>
                  </div>
                )}
              </div>
            ))}
          </TabsContent>
          )}
        </Tabs>
        )}
      </main>

      {/* ── Action bar ──────────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/70 bg-background/92 p-4 safe-area-pb shadow-[0_-18px_50px_-34px_hsl(var(--foreground)/0.34)] backdrop-blur-2xl">
        <div className="max-w-lg mx-auto space-y-2">
          {/* Call state banner */}
          {callState.status !== 'active' && callState.status !== 'disabled' && (
            <div className="text-center text-xs text-muted-foreground bg-muted rounded-2xl px-3 py-2">
              {callState.status === 'offline' && `📵 ${callState.note}`}
              {callState.status === 'outside_hours' && `🕐 ${callState.note}`}
            </div>
          )}

          {(user?.role === "client" || !user) && (
            <Button
              variant="outline"
              className="h-11 w-full rounded-2xl border-primary/30 font-bold text-primary"
              onClick={() => {
                if (user?.role !== "client") {
                  navigate("/auth");
                  return;
                }
                setShowInvite(true);
              }}
              data-testid="button-invite-provider"
            >
              <Send className="mr-2 h-4 w-4" />
              Предложить заказ этому исполнителю
            </Button>
          )}

          {/* Primary CTA — full width */}
          <Button
            className="w-full rounded-2xl h-12 text-base font-semibold"
            onClick={() => setShowBooking(true)}
            data-testid="button-book"
          >
            {isOrganization ? "Заказать услугу" : "Записаться"}
          </Button>

          {/* Secondary actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-2xl"
              onClick={openDirectChat}
              disabled={directChatMutation.isPending}
              data-testid="button-chat"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Написать
            </Button>

            {callState.status === 'active' ? (
              revealPhone ? (
                <a
                  href={`tel:${callState.phone}`}
                  data-testid="link-call"
                  className="flex-1 min-w-0 flex items-center justify-center gap-2 rounded-2xl border border-emerald-600 text-emerald-600 text-sm font-semibold px-2"
                >
                  <Phone className="w-4 h-4 shrink-0" />
                  <span className="truncate">{callState.phone}</span>
                </a>
              ) : (
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl border-green-600 text-emerald-600 hover:bg-emerald-600/10"
                  onClick={() => setRevealPhone(true)}
                  data-testid="button-call"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Позвонить
                </Button>
              )
            ) : callState.status === 'disabled' ? (
              <Button
                variant="outline"
                disabled
                className="flex-1 rounded-xl opacity-50"
                data-testid="button-call-disabled"
              >
                <PhoneOff className="w-4 h-4 mr-2" />
                Звонки откл.
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled
                className="flex-1 rounded-xl opacity-60"
                data-testid="button-call-unavailable"
              >
                <Phone className="w-4 h-4 mr-2" />
                Недоступен
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
