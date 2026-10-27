import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, useEffect } from "react";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import productFeatures from "@shared/product-features.json";
import PausedAutoPartsPage from "@/pages/paused-auto-parts";

// Keep the main catalog eager for the fastest first paint.
import HomePage from "@/pages/home";

// Route-level code splitting keeps heavier sections out of the initial PWA bundle.
const MasterProfilePage = lazy(() => import("@/pages/master-profile"));
const RequestsPage = lazy(() => import("@/pages/requests"));
const OrdersPage = lazy(() => import("@/pages/orders"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const SavedMastersPage = lazy(() => import("@/pages/saved-masters"));
const CityServicesPage = lazy(() => import("@/pages/city-services"));
const ContactsPage = lazy(() => import("@/pages/contacts"));
const ContactsHubPage = lazy(() => import("@/pages/contacts-hub"));
const MorePage = lazy(() => import("@/pages/more"));
const DoctorsPage = lazy(() => import("@/pages/doctors"));
const AutoPartsPage = lazy(() => import("@/pages/auto-parts"));
const AutoPartsRequestsPage = lazy(() => import("@/pages/auto-parts-requests"));
const AutoPartsRequestDetailPage = lazy(() => import("@/pages/auto-parts-request-detail"));
const LostFoundPage = lazy(() => import("@/pages/lost-found"));
const AuthPage = lazy(() => import("@/pages/auth"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const OrderChatPage = lazy(() => import("@/pages/order-chat"));
const DirectChatsPage = lazy(() => import("@/pages/direct-chats"));
const DirectChatPage = lazy(() => import("@/pages/direct-chat"));
const PreviewWhatsApp = lazy(() => import("@/pages/preview-whatsapp"));
const NotFound = lazy(() => import("@/pages/not-found"));

const MasterDashboardPage = lazy(() => import("@/pages/master/dashboard"));
const MasterOrdersPage = lazy(() => import("@/pages/master/orders"));
const MasterProfileEditPage = lazy(() => import("@/pages/master/profile"));
const MasterOnboardingPage = lazy(() => import("@/pages/master/onboarding"));
const OrganizationOnboardingPage = lazy(() => import("@/pages/organization/onboarding"));
const OrganizationProfilePage = lazy(() => import("@/pages/organization/profile"));
const OrganizationPartsRequestsPage = lazy(() => import("@/pages/organization/parts-requests"));
const AdminDashboardPage = lazy(() => import("@/pages/admin/dashboard"));
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { PwaUpdatePrompt } from "@/components/pwa-update-prompt";
import { NetworkStatusBanner } from "@/components/network-status-banner";
import { RealtimeSync } from "@/components/realtime-sync";
import { AppBootScreen } from "@/components/app-boot-screen";
import { RouteErrorBoundary } from "@/components/route-error-boundary";
import { PullToRefresh } from "@/components/pull-to-refresh";

// Executor-only routes (executor interface)
const MASTER_ROUTES = ["/master", "/master/orders", "/master/profile", "/master/onboarding", "/master/messages"];
const ORGANIZATION_ROUTES = ["/organization", "/organization/orders", "/organization/profile", "/organization/onboarding", "/organization/messages", "/organization/parts-requests"];
const PUBLIC_AUTH_ROUTES = ["/auth", "/forgot-password", "/reset-password"];
const ADMIN_ROUTES = ["/admin"];

function isMasterRoute(path: string) {
  return MASTER_ROUTES.includes(path) || path.startsWith("/master/orders/") || path.startsWith("/master/messages/");
}

function isOrganizationRoute(path: string) {
  return ORGANIZATION_ROUTES.includes(path) || path.startsWith("/organization/orders/") || path.startsWith("/organization/messages/");
}

function isProviderRoute(path: string) {
  return isMasterRoute(path) || isOrganizationRoute(path);
}

function isAdminRoute(path: string) {
  return ADMIN_ROUTES.includes(path) || path.startsWith("/admin/");
}

function RoleGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;

    const onMasterRoute = isMasterRoute(location);
    const onOrganizationRoute = isOrganizationRoute(location);
    const onProviderRoute = onMasterRoute || onOrganizationRoute;
    const onAdminRoute = isAdminRoute(location);

    if (!user && (onProviderRoute || onAdminRoute)) {
      navigate("/auth");
    } else if (user?.role === "admin" && !onAdminRoute && !PUBLIC_AUTH_ROUTES.includes(location)) {
      navigate("/admin");
    } else if (user && user.role !== "admin" && onAdminRoute) {
      if (user.role === "master") {
        navigate("/master");
      } else if (user.role === "organization") {
        navigate("/organization");
      } else {
        navigate("/");
      }
    } else if (user?.role === "master" && !onMasterRoute && !PUBLIC_AUTH_ROUTES.includes(location)) {
      navigate("/master");
    } else if (user?.role === "organization" && !onOrganizationRoute && !PUBLIC_AUTH_ROUTES.includes(location)) {
      navigate("/organization");
    } else if (user?.role === "client" && onProviderRoute) {
      navigate("/");
    } else if (user?.role === "master" && onOrganizationRoute) {
      navigate("/master");
    } else if (user?.role === "organization" && onMasterRoute) {
      navigate("/organization");
    }
  }, [user, isLoading, location, navigate]);

  if (isLoading || (!user && (isProviderRoute(location) || isAdminRoute(location)))) return <AppBootScreen />;
  return <>{children}</>;
}

function Router() {
  const [location] = useLocation();

  return (
    <Suspense fallback={<AppBootScreen />}>
      <RoleGuard>
        <div key={location} className="route-stage">
          <Switch>
        {/* Executor (master) routes — declared first so /master/orders and /master/profile
            are matched before the parameterized /master/:id client route */}
        <Route path="/master" component={MasterDashboardPage} />
        <Route path="/master/orders/:id/chat" component={OrderChatPage} />
        <Route path="/master/orders" component={MasterOrdersPage} />
        <Route path="/master/messages/:id" component={DirectChatPage} />
        <Route path="/master/messages" component={DirectChatsPage} />
        <Route path="/master/profile" component={MasterProfileEditPage} />
        <Route path="/master/onboarding" component={MasterOnboardingPage} />

        {/* Organization routes */}
        <Route path="/organization" component={MasterDashboardPage} />
        <Route path="/organization/orders/:id/chat" component={OrderChatPage} />
        <Route path="/organization/orders" component={MasterOrdersPage} />
        <Route path="/organization/messages/:id" component={DirectChatPage} />
        <Route path="/organization/messages" component={DirectChatsPage} />
        <Route path="/organization/profile" component={OrganizationProfilePage} />
        <Route path="/organization/parts-requests" component={productFeatures.autoParts ? OrganizationPartsRequestsPage : PausedAutoPartsPage} />
        <Route path="/organization/onboarding" component={OrganizationOnboardingPage} />

        {/* Admin routes */}
        <Route path="/admin" component={AdminDashboardPage} />

        {/* Client routes */}
        <Route path="/" component={HomePage} />
        <Route path="/master/:id" component={MasterProfilePage} />
        <Route path="/requests" component={RequestsPage} />
        <Route path="/orders/:id/chat" component={OrderChatPage} />
        <Route path="/orders" component={OrdersPage} />
        <Route path="/messages/:id" component={DirectChatPage} />
        <Route path="/messages" component={DirectChatsPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/saved" component={SavedMastersPage} />
        <Route path="/city" component={CityServicesPage} />
        <Route path="/contacts/services" component={CityServicesPage} />
        <Route path="/contacts/useful" component={ContactsPage} />
        <Route path="/auto-parts/requests/:id" component={productFeatures.autoParts ? AutoPartsRequestDetailPage : PausedAutoPartsPage} />
        <Route path="/auto-parts/requests" component={productFeatures.autoParts ? AutoPartsRequestsPage : PausedAutoPartsPage} />
        <Route path="/auto-parts" component={productFeatures.autoParts ? AutoPartsPage : PausedAutoPartsPage} />
        <Route path="/doctors" component={DoctorsPage} />
        <Route path="/contacts" component={ContactsHubPage} />
        <Route path="/more" component={MorePage} />
        <Route path="/lost-found" component={LostFoundPage} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/preview/whatsapp" component={PreviewWhatsApp} />

          <Route component={NotFound} />
          </Switch>
        </div>
      </RoleGuard>
    </Suspense>
  );
}


function RouteEffects() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    const metadata =
      location === "/" ? {
        title: "GOVZA мастера — мастера рядом",
        description: "Найдите мастера или организацию рядом, сравните услуги, отзывы и отправьте заявку в GOVZA.",
      } :
      location.startsWith("/auto-parts") ? {
        title: productFeatures.autoParts ? "Автозапчасти — GOVZA мастера" : "Раздел временно недоступен — GOVZA",
        description: productFeatures.autoParts ? "Автомагазины и авторазборы: новые и Б/У автозапчасти в GOVZA мастера." : "Раздел запчастей временно скрыт.",
      } :
      location.startsWith("/admin") ? {
        title: "Админ-панель — GOVZA мастера",
        description: "Управление каталогом, справочниками и модерацией GOVZA.",
      } :
      location.startsWith("/doctors") ? {
        title: "Врачи — GOVZA мастера",
        description: "Каталог врачей и медицинских специалистов с контактами и удобным поиском.",
      } :
      location.startsWith("/contacts") || location === "/city" ? {
        title: "Контакты — GOVZA мастера",
        description: "Полезные городские службы, организации, адреса, телефоны и карта в GOVZA.",
      } :
      location.startsWith("/requests") ? {
        title: "Мои заявки — GOVZA мастера",
        description: "Создавайте заявки, получайте предложения исполнителей и выбирайте подходящего мастера.",
      } :
      location === "/saved" ? { title: "Мои мастера — GOVZA", description: "Ваше избранное и история просмотренных мастеров." } :
      location.startsWith("/orders") ? {
        title: "Мои заказы — GOVZA мастера",
        description: "Статусы заказов, чат с исполнителем и отзывы после завершения работы.",
      } :
      location.includes("/messages") ? {
        title: "Сообщения — GOVZA мастера",
        description: "Личные сообщения и переписка с исполнителями и клиентами GOVZA.",
      } :
      location.startsWith("/profile") ? {
        title: "Профиль — GOVZA мастера",
        description: "Настройки профиля, уведомлений и активности аккаунта GOVZA.",
      } :
      /^\/master\/\d+/.test(location) ? {
        title: "Профиль исполнителя — GOVZA мастера",
        description: "Услуги, портфолио, проверенные отзывы и контакты исполнителя в GOVZA.",
      } :
      location.startsWith("/master") ? {
        title: "Кабинет мастера — GOVZA мастера",
        description: "Заявки, заказы, сообщения и управление профилем мастера GOVZA.",
      } :
      location.startsWith("/organization") ? {
        title: "Кабинет организации — GOVZA мастера",
        description: "Заявки, заказы, сообщения и управление профилем организации GOVZA.",
      } :
      location.startsWith("/lost-found") ? {
        title: "Потеряно / Найдено — GOVZA мастера",
        description: "Объявления о потерянных и найденных вещах, документах и животных.",
      } : {
        title: "GOVZA мастера",
        description: "GOVZA — мастера, организации, услуги, заявки и полезные городские контакты рядом.",
      };

    document.title = metadata.title;

    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = metadata.description;

    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = metadata.title;

    const ogDescription = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (ogDescription) ogDescription.content = metadata.description;

    const absoluteUrl = new URL(location || "/", window.location.origin).href;
    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (ogUrl) ogUrl.content = absoluteUrl;

    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = absoluteUrl;
  }, [location]);

  return null;
}

function ThemeInitializer() {
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (savedTheme === "light") {
      document.documentElement.classList.remove("dark");
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.classList.add("dark");
    }

    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const syncThemeColor = () => {
      if (themeMeta) {
        themeMeta.content = document.documentElement.classList.contains("dark") ? "#111827" : "#0B8FB6";
      }
    };

    syncThemeColor();
    const observer = new MutationObserver(syncThemeColor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <ThemeInitializer />
          <RouteEffects />
          <Toaster />
          <RouteErrorBoundary>
            <Router />
          </RouteErrorBoundary>
          <PwaInstallPrompt />
          <PullToRefresh />
          <RealtimeSync />
          <PwaUpdatePrompt />
          <NetworkStatusBanner />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
