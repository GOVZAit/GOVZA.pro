import assert from "node:assert/strict";
import { isOrganizationProfile, providerDisplayName, collectClinicPlaces, clinicLocationKey } from "../shared/provider-directory";

assert.equal(isOrganizationProfile({ providerType: "organization", executorType: "private" }), true);
assert.equal(isOrganizationProfile({ providerType: "master", executorType: "company" }), false);
assert.equal(isOrganizationProfile({ executorType: "company" }), true);
assert.equal(isOrganizationProfile({ executorType: "self_employed" }), false);
assert.equal(isOrganizationProfile({}), false);
assert.equal(providerDisplayName({ name: "Представитель", companyName: " Компания ", executorType: "company" }), "Компания");
assert.equal(providerDisplayName({ name: "Специалист", companyName: "Бренд", providerType: "master" }), "Специалист");
const address = { clinic: "Клиника", city: "Грозный", address: "Улица, 1" };
const places = collectClinicPlaces([
  { id: 1, locations: [address, { ...address, clinic: " КЛИНИКА " }] },
  { id: 2, locations: [address, { ...address, address: "Улица, 2" }] },
  { id: 3, locations: [{ ...address, clinic: " " }] },
]);
assert.equal(places.length, 2);
assert.deepEqual(places.find(place => place.key === clinicLocationKey(address))?.doctorIds, [1, 2]);
assert.ok(places.every(place => !("phone" in place) && !("rating" in place) && !("providerId" in place)));
console.log("Provider classification and clinic directory checks passed.");
