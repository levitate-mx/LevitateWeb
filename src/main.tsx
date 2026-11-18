import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import { applySiteMetadata } from "./components/seo/SiteMetadata";
import "./styles/global.css";
import "./components/admin/AdminWorkspace.css";

applySiteMetadata(document, window.location.pathname);
const root = document.getElementById("root")!;
const normalizePath = (path: string) => path === "/" ? path : path.replace(/\/$/, "");
const prerenderedPath = root.dataset.prerenderPath;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);
if (prerenderedPath && normalizePath(prerenderedPath) === normalizePath(window.location.pathname)) {
  hydrateRoot(root, app);
} else {
  // A fallback document must never hydrate content belonging to another URL.
  root.replaceChildren();
  createRoot(root).render(app);
}
