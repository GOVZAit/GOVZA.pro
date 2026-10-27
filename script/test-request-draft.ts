import assert from "node:assert/strict";
import { parseRequestDraft, REQUEST_DRAFT_TTL } from "../client/src/lib/request-draft";

const now = Date.now();
const input = { category: "Сантехника", description: "Заменить смеситель", budget: "Обсудим с мастером", savedAt: now };
assert.deepEqual(parseRequestDraft(JSON.stringify(input), now), input);
assert.equal(parseRequestDraft(JSON.stringify(input), now + REQUEST_DRAFT_TTL), null);
assert.equal(parseRequestDraft(JSON.stringify(input), now - 1), null);
assert.equal(parseRequestDraft("not-json", now), null);
assert.equal(parseRequestDraft(null, now), null);
assert.equal(parseRequestDraft(JSON.stringify({ ...input, description: "a".repeat(301) }), now), null);
assert.equal(parseRequestDraft(JSON.stringify({ ...input, description: "    " }), now), null);
assert.equal(parseRequestDraft(JSON.stringify({ ...input, savedAt: "now" }), now), null);
assert.equal(parseRequestDraft(JSON.stringify({ ...input, category: [] }), now), null);
// Address/contact additions must never cross the login hand-off.
assert.deepEqual(parseRequestDraft(JSON.stringify({ ...input, location: "Private address", phone: "Private phone" }), now), input);
console.log("Request draft expiry, validation and privacy checks passed.");
