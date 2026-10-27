import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";
import { DirectoryChip } from "@/components/directory-layout";
import { ResponsivePanel } from "@/components/responsive-panel";
import { categories as seededCategories, type Category, type InsertRequest } from "@shared/schema";
import { clearRequestDraft, saveRequestDraft, type RequestDraft } from "@/lib/request-draft";

const budgets = ["до 1 000 ₽", "1 000 — 3 000 ₽", "3 000 — 7 000 ₽", "7 000 — 15 000 ₽", "от 15 000 ₽", "Обсудим с мастером"];
interface Props { initialCategory?: string; initialDescription?: string; initialDraft?: RequestDraft; onClose: () => void }
type Step = "category" | "details" | "location" | "done";
export function BroadcastModal({ initialCategory, initialDescription = "", initialDraft, onClose }: Props) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [draftError, setDraftError] = useState("");
  const client = useQueryClient();
  const { data: categories = seededCategories } = useQuery<Category[]>({ queryKey: ["/api/categories"], initialData: seededCategories });
  const [step, setStep] = useState<Step>(initialDraft || initialCategory ? "details" : "category");
  const [category, setCategory] = useState(initialDraft?.category ?? initialCategory ?? "");
  const [description, setDescription] = useState(initialDraft?.description ?? initialDescription.slice(0, 300));
  const [budget, setBudget] = useState(initialDraft?.budget ?? "Обсудим с мастером");
  const [location, setLocation] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const request = useMutation({
    mutationFn: (data: InsertRequest) => apiRequest("POST", "/api/requests", data),
    onSuccess: () => { clearRequestDraft(); void client.invalidateQueries({ queryKey: ["/api/requests"] }); setStep("done"); },
  });
  const dirty = category !== (initialCategory ?? "") || description !== initialDescription.slice(0, 300) || Boolean(location) || budget !== "Обсудим с мастером";
  const close = (open: boolean) => {
    if (open || request.isPending) return;
    if (step !== "done" && dirty) setConfirmClose(true); else onClose();
  };
  const next = () => {
    if (step === "category") setStep("details");
    else if (step === "details") {
      if (!user) {
        if (!saveRequestDraft({ category, description, budget })) {
          setDraftError("Браузер не разрешил сохранить черновик. Разрешите хранилище для сайта и повторите — данные пока остаются в этой форме.");
          return;
        }
        navigate("/auth?next=request");
      } else setStep("location");
    }
    else if (step === "location" && user?.role === "client") request.mutate({
      title: `${category}: ${description.trim().slice(0, 40)}`, category, description: description.trim(), budget, location: location.trim(),
    });
  };
  const invalid = step === "category" ? !category : step === "details" ? description.trim().length < 5 : location.trim().length < 3;
  const stepNumber = step === "category" ? 1 : step === "details" ? 2 : 3;
  if (user && user.role !== "client") return <ResponsivePanel open onOpenChange={() => onClose()} title="Заявка мастерам" description="Предложения и переписка сохраняются в клиентском аккаунте."
    footer={<button type="button" className="directory-secondary" onClick={onClose}>Понятно</button>}>
    <p className="text-sm leading-relaxed text-muted-foreground">Создание заявки доступно из клиентского аккаунта.</p>
  </ResponsivePanel>;
  if (confirmClose) return <ResponsivePanel open onOpenChange={() => setConfirmClose(false)} title="Закрыть заявку?" description="Введённые данные ещё не отправлены."
    footer={<><button type="button" className="directory-secondary" onClick={() => { clearRequestDraft(); onClose(); }}>Не сохранять</button><button type="button" className="directory-primary" onClick={() => setConfirmClose(false)}>Продолжить</button></>}>
    <p className="text-sm text-muted-foreground">Вернитесь к заполнению, чтобы не потерять описание задачи.</p>
  </ResponsivePanel>;
  return <ResponsivePanel open onOpenChange={close} title={step === "done" ? "Заявка отправлена" : "Описать задачу"}
    description={step === "done" ? "Предложения появятся в разделе «Мои заявки»." : `Шаг ${stepNumber} из 3 · ${step === "category" ? "Услуга" : step === "details" ? "Описание и бюджет" : "Адрес и проверка"}`}
    footer={step === "done" ? <Link href="/requests" className="directory-primary" onClick={onClose}>Открыть мои заявки</Link> : <>
      {step !== "category" && <button type="button" className="directory-secondary" disabled={request.isPending} onClick={() => setStep(step === "location" ? "details" : "category")}>Назад</button>}
      <button type="button" className="directory-primary" disabled={invalid || request.isPending} onClick={next}
        data-testid={step === "category" ? "button-next-category" : step === "details" ? "button-next-details" : "button-submit-request"}>
        {request.isPending ? <><Loader2 size={18} className="animate-spin" />Отправляем…</> : step === "location" ? "Отправить мастерам" : step === "details" && !user ? "Сохранить и войти" : "Продолжить"}
      </button>
    </>}>
    {step === "category" && <fieldset className="govza-options"><legend>Какая услуга нужна?</legend><div>{categories.map((cat) => <DirectoryChip key={cat.id} active={category === cat.name} onClick={() => setCategory(cat.name)} testId={`category-${cat.id}`}>{cat.name}</DirectoryChip>)}</div></fieldset>}
    {step === "details" && <>
      {initialDraft && <p className="request-draft-note" role="status">Описание восстановлено. Проверьте его и продолжите — заявка ещё не отправлена.</p>}
      <label className="govza-field"><span>Что нужно сделать?</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={300} placeholder="Опишите задачу: что, где и в каком объёме" data-testid="input-description" /></label>
      <fieldset className="govza-options"><legend>Бюджет</legend><div>{budgets.map((item) => <DirectoryChip key={item} active={budget === item} onClick={() => setBudget(item)} testId={`budget-${item}`}>{item}</DirectoryChip>)}</div></fieldset>
      {!user && <p className="request-draft-note">Войдите перед отправкой. Описание и бюджет сохранятся на 30 минут в этой вкладке. Адрес укажете после входа.</p>}
    </>}
    {step === "location" && <>
      <label className="govza-field"><span>Адрес выполнения работы</span><input value={location} onChange={(event) => setLocation(event.target.value)} autoComplete="street-address" placeholder="Город, улица, дом" maxLength={300} data-testid="input-location" /></label>
      <div className="rounded-2xl bg-muted p-4 text-sm leading-relaxed"><h3 className="font-semibold mb-2">Проверьте заявку</h3><p>{category}</p><p className="whitespace-pre-wrap break-words mt-2">{description}</p><p className="mt-2 font-semibold">{budget}</p></div>
      <p className="text-xs text-muted-foreground leading-relaxed mt-3">Исполнители смогут предложить цену. Вы сами выбираете подходящий отклик.</p>
    </>}
    {draftError && <p role="alert" className="mt-4 text-sm text-destructive">{draftError}</p>}
    {request.isError && <p role="alert" className="mt-4 text-sm text-destructive">Не удалось отправить заявку. Данные сохранены в форме — проверьте соединение и повторите.</p>}
    {step === "done" && <div className="py-6 text-center"><CheckCircle2 size={48} className="mx-auto text-primary mb-4" /><p className="text-sm text-muted-foreground">Выберите исполнителя после получения откликов.</p></div>}
  </ResponsivePanel>;
}
