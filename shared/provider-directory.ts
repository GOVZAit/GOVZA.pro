import type { Master } from "./schema";

export type ProviderDirectory = "specialists" | "organizations";
/** Explicit profile type wins; legacy company accounts predate providerType. */
export function isOrganizationProfile(master: Pick<Master, "providerType" | "executorType">) {
  return master.providerType ? master.providerType === "organization" : master.executorType === "company";
}
export function providerDisplayName(master: Pick<Master, "providerType" | "executorType" | "companyName" | "name">) {
  return isOrganizationProfile(master) ? master.companyName?.trim() || master.name : master.name;
}
export interface ClinicLocation { clinic: string; city: string; address: string; schedule?: string }
export interface ClinicDoctor { id: number; locations: ClinicLocation[] }
export interface ClinicPlace extends ClinicLocation { key: string; doctorIds: number[] }
const normalize = (text: string) => text.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");
export function clinicLocationKey(location: ClinicLocation) {
  return JSON.stringify([location.clinic, location.city, location.address].map(normalize));
}
/** Locations are directory listings, never invented organization accounts. */
export function collectClinicPlaces(doctors: readonly ClinicDoctor[]): ClinicPlace[] {
  const places = new Map<string, ClinicPlace>();
  for (const doctor of doctors) for (const location of doctor.locations) {
    if (!location.clinic.trim()) continue;
    const key = clinicLocationKey(location);
    const current = places.get(key);
    if (current) { if (!current.doctorIds.includes(doctor.id)) current.doctorIds.push(doctor.id); }
    else places.set(key, { key, clinic: location.clinic.trim(), city: location.city.trim(), address: location.address.trim(), doctorIds: [doctor.id] });
  }
  return [...places.values()].sort((a, b) => a.clinic.localeCompare(b.clinic, "ru"));
}
