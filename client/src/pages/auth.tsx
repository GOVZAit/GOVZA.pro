import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, AtSign, Briefcase, Building2, Check, Eye, EyeOff, Lock,
  ShieldCheck, User, UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/contexts/auth-context";
import { registerSchema, loginSchema, type UserRole } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const registerFormSchema = registerSchema
  .extend({ confirmPassword: z.string().min(1, "Повторите пароль") })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });

type Tab = "login" | "register";

const roles: Array<{
  key: UserRole;
  icon: typeof UserRound;
  title: string;
  subtitle: string;
}> = [
  { key: "client", icon: UserRound, title: "Клиент", subtitle: "Ищу мастера" },
  { key: "master", icon: Briefcase, title: "Мастер", subtitle: "Выполняю заказы" },
  { key: "organization", icon: Building2, title: "Организация", subtitle: "Компания или бригада" },
];

export default function AuthPage() {
  const search = useSearch();
  const initialTab: Tab = search.includes("tab=register") ? "register" : "login";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [, navigate] = useLocation();
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("client");
  const [accepted, setAccepted] = useState(true);

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const registerForm = useForm({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { name: "", identifier: "", password: "", confirmPassword: "", role: "client" as const },
  });

  const onLogin = async (values: { identifier: string; password: string }) => {
    setError("");
    try {
      const loggedUser = await login(values.identifier, values.password);
      navigate(loggedUser.role === "master" ? "/master" : loggedUser.role === "organization" ? "/organization" : "/profile");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const onRegister = async (values: { name: string; identifier: string; password: string }) => {
    if (!accepted) {
      setError("Подтвердите согласие с условиями использования");
      return;
    }
    setError("");
    try {
      const result = await register(values.name, values.identifier, values.password, selectedRole);
      const description = result.emailDelivery === "queued"
        ? "Письмо с логином отправляется на указанную почту."
        : result.emailDelivery === "unavailable_for_phone"
          ? "Аккаунт создан по номеру телефона."
          : "Аккаунт создан.";
      toast({ title: "Добро пожаловать в GOVZA pro", description });
      navigate(result.user.role === "master"
        ? "/master/onboarding"
        : result.user.role === "organization"
          ? "/organization/onboarding"
          : "/profile");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const fieldShell = "h-14 rounded-2xl border-border/70 bg-card pl-11 pr-12 shadow-sm";

  return (
    <div className="min-h-[100dvh] bg-background safe-area-pt">
      <div className="mx-auto max-w-lg px-4 pb-10 pt-5">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="pressable flex min-h-11 items-center gap-2 rounded-xl text-sm font-medium text-muted-foreground"
        >
          <ArrowLeft className="h-5 w-5" /> На главную
        </button>

        <div className="hero-gradient relative mt-5 overflow-hidden rounded-[1.75rem] border border-primary/10 p-5">
          <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-cyan-300/30 blur-2xl" />
          <div className="relative">
            <div className="flex items-baseline gap-2 text-[2rem]">
              <span className="display-face font-bold text-[#07132f] dark:text-white">GOVZA</span>
              <span className="font-extrabold tracking-[-0.05em] text-primary">pro</span>
            </div>
            <p className="mt-1 text-sm font-medium text-muted-foreground">Надёжные специалисты рядом</p>
          </div>
          <div className="relative mt-5 grid grid-cols-2 rounded-2xl bg-background/70 p-1 shadow-sm">
            {(["login", "register"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => { setTab(item); setError(""); }}
                className={cn(
                  "min-h-12 rounded-xl text-sm font-bold transition-all",
                  tab === item ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                )}
              >
                {item === "login" ? "Вход" : "Регистрация"}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
            {error}
          </div>
        )}

        {tab === "login" ? (
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="mt-6 space-y-4">
              <div>
                <h1 className="text-2xl font-extrabold tracking-[-0.04em]">Войдите в аккаунт</h1>
                <p className="mt-1 text-sm text-muted-foreground">Все заявки, заказы и сообщения останутся под рукой.</p>
              </div>

              <FormField
                control={loginForm.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Телефон или email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <AtSign className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input {...field} className={fieldShell} autoComplete="username" placeholder="+7 999 000-00-00 или name@mail.ru" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Пароль</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input {...field} type={showPassword ? "text" : "password"} className={fieldShell} autoComplete="current-password" placeholder="Введите пароль" />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-muted-foreground"
                          aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <button type="button" onClick={() => navigate("/forgot-password")} className="ml-auto flex min-h-11 items-center text-sm font-semibold text-primary">
                Забыли пароль?
              </button>

              <Button type="submit" className="accent-gradient h-13 w-full rounded-2xl text-base font-bold" disabled={loginForm.formState.isSubmitting}>
                {loginForm.formState.isSubmitting ? "Входим…" : "Войти"}
              </Button>
            </form>
          </Form>
        ) : (
          <Form {...registerForm}>
            <form onSubmit={registerForm.handleSubmit(onRegister)} className="mt-6 space-y-4">
              <div>
                <h1 className="text-2xl font-extrabold tracking-[-0.04em]">Я регистрируюсь как</h1>
                <p className="mt-1 text-sm text-muted-foreground">Выберите роль — интерфейс будет настроен под ваши задачи.</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {roles.map(({ key, icon: Icon, title, subtitle }) => {
                  const active = selectedRole === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedRole(key)}
                      className={cn(
                        "pressable relative min-h-[128px] rounded-[1.4rem] border p-3 text-center transition-all",
                        active
                          ? "border-primary bg-primary/[0.07] shadow-sm"
                          : "border-border/70 bg-card"
                      )}
                    >
                      {active && (
                        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <div className={cn("mx-auto flex h-11 w-11 items-center justify-center rounded-2xl", active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className={cn("mt-2 text-sm font-extrabold", active && "text-primary")}>{title}</p>
                      <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{subtitle}</p>
                    </button>
                  );
                })}
              </div>

              <FormField
                control={registerForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{selectedRole === "organization" ? "Название организации" : "Имя"}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input {...field} className={fieldShell} autoComplete="name" placeholder={selectedRole === "organization" ? "Название компании" : "Ваше имя"} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Телефон или email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <AtSign className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input {...field} className={fieldShell} autoComplete="username" placeholder="+7 999 000-00-00 или name@mail.ru" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Пароль</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input {...field} type={showPassword ? "text" : "password"} className={fieldShell} autoComplete="new-password" placeholder="Минимум 6 символов" />
                        <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-muted-foreground">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Повторите пароль</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input {...field} type={showConfirm ? "text" : "password"} className={fieldShell} autoComplete="new-password" placeholder="Повторите пароль" />
                        <button type="button" onClick={() => setShowConfirm((value) => !value)} className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-muted-foreground">
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <button type="button" onClick={() => setAccepted((value) => !value)} className="flex min-h-11 items-start gap-3 text-left">
                <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border", accepted ? "border-primary bg-primary text-white" : "border-border bg-card")}>
                  {accepted && <Check className="h-4 w-4" />}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  Я согласен с условиями использования и политикой конфиденциальности.
                </span>
              </button>

              <Button type="submit" className="accent-gradient h-13 w-full rounded-2xl text-base font-bold" disabled={registerForm.formState.isSubmitting || !accepted}>
                {registerForm.formState.isSubmitting ? "Создаём аккаунт…" : "Создать аккаунт"}
              </Button>

              <div className="flex items-center gap-3 rounded-2xl bg-primary/[0.055] p-3">
                <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-bold">Безопасно и надёжно</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Ваши данные защищены и не передаются третьим лицам.</p>
                </div>
              </div>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
