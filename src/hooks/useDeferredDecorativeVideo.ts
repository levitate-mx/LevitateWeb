import { useEffect, useRef, useState } from "react";

type BrowserConnection = {
  effectiveType?: string;
  saveData?: boolean;
};

function getConnection() {
  return (
    (navigator as Navigator & { connection?: BrowserConnection }).connection ??
    (navigator as Navigator & { mozConnection?: BrowserConnection }).mozConnection ??
    (navigator as Navigator & { webkitConnection?: BrowserConnection }).webkitConnection
  );
}

function canUseDecorativeVideo() {
  const connection = getConnection();

  if (connection?.saveData || connection?.effectiveType?.includes("2g")) {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
}

export function useDeferredDecorativeVideo<T extends HTMLElement>(rootMargin = "600px") {
  const containerRef = useRef<T | null>(null);
  const [shouldRenderVideo, setShouldRenderVideo] = useState(false);

  useEffect(() => {
    if (!canUseDecorativeVideo()) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const element = containerRef.current;

    const renderVideo = () => setShouldRenderVideo(true);
    const removeVideo = () => setShouldRenderVideo(false);

    if (!element || !("IntersectionObserver" in window)) {
      renderVideo();
      mediaQuery.addEventListener("change", removeVideo);

      return () => mediaQuery.removeEventListener("change", removeVideo);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          renderVideo();
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 },
    );

    observer.observe(element);
    mediaQuery.addEventListener("change", removeVideo);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", removeVideo);
    };
  }, [rootMargin]);

  return { containerRef, shouldRenderVideo };
}
