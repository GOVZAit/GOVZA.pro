/** UI acceptance data only. Never imported by the application or written to its database. */
import { writeFileSync } from "node:fs";
import { mastersData } from "../client/src/lib/data";
import { doctors } from "../client/src/lib/doctors-data";
import { categories } from "../shared/schema";
import { curatedChechnyaAutoPartsSeeds } from "../server/auto-parts-curated-data";
const output = process.env.UI_FIXTURES;
if (!output) throw new Error("UI_FIXTURES must point to a temporary JSON file");
const masters = mastersData.map((master) => ({ ...master, city: "Грозный", district: "", callMode: "always", workingHours: { from: "09:00", to: "18:00" }, isOnline: false, categoryIds: [master.categoryId] }));
const organization = { ...masters[0], id: 9001, name: "Тестовая сервисная компания", companyName: "Тестовая сервисная компания", providerType: "organization", organizationKind: "service_company", executorType: "company", rating: 0, reviews: 0, verified: false, avatar: "" };
writeFileSync(output, JSON.stringify({
  masters: [...masters, organization,
    { ...organization, id: 9002, name: "Тестовая клиника", companyName: "Тестовая клиника", organizationKind: "medical", services: [] },
    { ...organization, id: 9003, name: "Представитель", companyName: "Тестовая старая компания", providerType: undefined }],
  doctors, categories,
  suppliers: curatedChechnyaAutoPartsSeeds.map((entry, index) => ({ id: index + 1, ...entry.data })),
}));
