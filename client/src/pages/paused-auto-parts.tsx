import { Link } from "wouter";
import { DirectoryFrame } from "@/components/directory-layout";
import OrganizationBottomNavigation from "@/components/organization-bottom-navigation";
import { useAuth } from "@/contexts/auth-context";

export default function PausedAutoPartsPage() {
  const { user } = useAuth();
  const content = <main className="directory-container py-6"><div className="directory-empty">
    <h2 className="text-xl font-semibold">Сейчас доступны услуги специалистов</h2>
    <p>Запчасти пока убраны из приложения. Ваши данные сохранены.</p>
    <Link href={user?.role === "organization" ? "/organization" : "/"} className="directory-primary">На главную</Link>
  </div></main>;
  return user?.role === "organization"
    ? <div className="app-page bg-background"><header className="directory-container pt-6"><h1 className="text-2xl font-semibold">Раздел временно недоступен</h1></header>{content}<OrganizationBottomNavigation /></div>
    : <DirectoryFrame title="Раздел временно недоступен">{content}</DirectoryFrame>;
}
