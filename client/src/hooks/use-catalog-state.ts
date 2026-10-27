import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { defaultCatalogState, defaultFilterState, readCatalogState, writeCatalogState, type CatalogState } from "@shared/catalog";

const keys = ["q", "city", "category", "view", ...Object.keys(defaultFilterState)];

export function useCatalogState(ownerId?: number, ready = true, scope: "specialists" | "organizations" = "specialists"): [CatalogState, Dispatch<SetStateAction<CatalogState>>] {
  const catalogPath = scope === "organizations" ? "/organizations" : "/";
  const storageKey = `govza:catalog:v2:${ownerId ?? "guest"}${scope === "organizations" ? ":organizations" : ""}`;
  const load = (useUrl: boolean) => {
    const params = new URLSearchParams(window.location.search);
    if (useUrl && keys.some((key) => params.has(key))) return readCatalogState(params);
    try { return readCatalogState(new URLSearchParams(localStorage.getItem(storageKey) ?? "")); }
    catch { return defaultCatalogState; }
  };
  const [saved, setSaved] = useState(() => ({ key: storageKey, value: load(true) }));
  const state = saved.key === storageKey ? saved.value : defaultCatalogState;

  useEffect(() => {
    if (ready && saved.key !== storageKey) setSaved({ key: storageKey, value: load(true) });
  }, [storageKey, saved.key, ready]);

  useEffect(() => {
    if (!ready || saved.key !== storageKey || window.location.pathname !== catalogPath) return;
    const serialized = writeCatalogState(saved.value);
    try { localStorage.setItem(storageKey, serialized); } catch { /* Storage can be disabled. */ }
    const params = new URLSearchParams(window.location.search);
    keys.forEach((key) => params.delete(key));
    new URLSearchParams(serialized).forEach((value, key) => params.set(key, value));
    const search = params.toString();
    const url = `${catalogPath}${search ? `?${search}` : ""}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, "", url);
    }
  }, [saved, storageKey, ready, catalogPath]);

  useEffect(() => {
    const restore = () => {
      if (window.location.pathname === catalogPath) setSaved({ key: storageKey, value: readCatalogState(new URLSearchParams(window.location.search)) });
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [storageKey, catalogPath]);

  const setState: Dispatch<SetStateAction<CatalogState>> = (next) => setSaved((previous) => ({
    key: storageKey,
    value: typeof next === "function" ? next(previous.key === storageKey ? previous.value : defaultCatalogState) : next,
  }));
  return [state, setState];
}
