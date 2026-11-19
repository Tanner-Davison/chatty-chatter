import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { registerServiceWorker } from "./features/notifications/alerts";
import "./styles/index.css";

void registerServiceWorker()?.catch((err: unknown) => console.error("Service worker failed", err));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
