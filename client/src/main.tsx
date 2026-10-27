import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/directory.css";
import "./styles/redesign.css";
import { attemptAutomaticStaleAssetRecovery } from "@/lib/stale-asset-recovery";

window.addEventListener("vite:preloadError", (event) => {
  const preloadEvent = event as Event & { payload?: unknown };
  if (attemptAutomaticStaleAssetRecovery(preloadEvent.payload)) {
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker (PWA) — only in production builds.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("SW registration failed:", err);
    });
  });
}
