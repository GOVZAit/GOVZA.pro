/** A guest's explicit hand-off to login, limited to this tab and 30 minutes.
 * Addresses are deliberately excluded. Restoring never submits a request. */
export interface RequestDraft { category: string; description: string; budget: string; savedAt: number }
export const REQUEST_DRAFT_KEY = "govza:guest-request:v1";
export const REQUEST_DRAFT_TTL = 30 * 60 * 1000;
export function parseRequestDraft(raw: string | null, now = Date.now()): RequestDraft | null {
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || typeof value.category !== "string" || !value.category || value.category.length > 100 ||
      typeof value.description !== "string" || value.description.trim().length < 5 || value.description.length > 300 ||
      typeof value.budget !== "string" || value.budget.length > 100 ||
      !Number.isFinite(value.savedAt) || now < value.savedAt || now - value.savedAt >= REQUEST_DRAFT_TTL) return null;
    return { category: value.category, description: value.description, budget: value.budget, savedAt: value.savedAt };
  } catch { return null; }
}
export function readRequestDraft(): RequestDraft | null {
  try { return parseRequestDraft(sessionStorage.getItem(REQUEST_DRAFT_KEY)); } catch { return null; }
}
export function clearRequestDraft() {
  try { sessionStorage.removeItem(REQUEST_DRAFT_KEY); } catch { /* Storage may be unavailable. */ }
}
export function saveRequestDraft(value: Omit<RequestDraft, "savedAt">): boolean {
  try {
    const draft = parseRequestDraft(JSON.stringify({ ...value, savedAt: Date.now() }));
    if (!draft) return false;
    sessionStorage.setItem(REQUEST_DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch { return false; }
}
