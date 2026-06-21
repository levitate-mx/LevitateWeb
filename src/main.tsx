import { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyMediaOverrides } from "./components/media/MediaOverrideRuntime";
import { loadMediaOverrides } from "./data/mediaRegistry";
import "./styles/global.css";

const rootElement = document.getElementById("root")!;

document.documentElement.dataset.levitateMediaBoot = "loading";

async function bootstrap() {
  try {
    await loadMediaOverrides();
  } finally {
    const root = createRoot(rootElement);

    flushSync(() => {
      root.render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
    });

    applyMediaOverrides();

    requestAnimationFrame(() => {
      document.documentElement.dataset.levitateMediaBoot = "ready";
    });
  }
}

void bootstrap();
