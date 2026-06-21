import { useEffect } from "react";
import {
  loadMediaOverrides,
  mediaCssVariableName,
  mediaOverrideChangeEvent,
  mediaSlots,
  mediaSlotsByDefaultUrl,
  mediaSlotsByKey,
  normalizeMediaSource,
  readMediaOverrides,
  type MediaOverrides,
} from "../../data/mediaRegistry";

type MediaAttribute = {
  selector: string;
  attribute: string;
  defaultAttribute: string;
};

const mediaAttributes: MediaAttribute[] = [
  {
    selector: "img[src], source[src], video[src]",
    attribute: "src",
    defaultAttribute: "data-levitate-media-default-src",
  },
  {
    selector: "video[poster]",
    attribute: "poster",
    defaultAttribute: "data-levitate-media-default-poster",
  },
];

const mediaKeyAttribute = "data-levitate-media-key";

function cssUrl(value: string) {
  return `url("${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
}

function getSlotKeyFromSource(source: string) {
  return mediaSlotsByDefaultUrl.get(normalizeMediaSource(source))?.key;
}

function applyMediaAttribute(element: Element, config: MediaAttribute, overrides: MediaOverrides) {
  const currentSource = element.getAttribute(config.attribute);
  if (!currentSource) return;

  const storedDefault = element.getAttribute(config.defaultAttribute);
  const explicitSlotKey = element.getAttribute(mediaKeyAttribute);
  const explicitSlot = explicitSlotKey ? mediaSlotsByKey.get(explicitSlotKey) : undefined;
  const defaultSource = storedDefault || explicitSlot?.defaultUrl || currentSource;

  if (!storedDefault) {
    element.setAttribute(config.defaultAttribute, defaultSource);
  }

  const slotKey = explicitSlot?.key || getSlotKeyFromSource(defaultSource);
  if (!slotKey) return;

  const nextSource = overrides[slotKey] || defaultSource;

  if (currentSource !== nextSource) {
    element.setAttribute(config.attribute, nextSource);

    if (config.attribute === "src") {
      const video =
        element.tagName === "SOURCE"
          ? element.closest("video")
          : element.tagName === "VIDEO"
            ? (element as HTMLVideoElement)
            : null;

      video?.load();
    }
  }
}

export function applyMediaOverrides() {
  if (typeof document === "undefined") return;

  const overrides = readMediaOverrides();

  mediaSlots.forEach((slot) => {
    const source = overrides[slot.key] || slot.defaultUrl;
    document.documentElement.style.setProperty(mediaCssVariableName(slot.key), cssUrl(source));
  });

  mediaAttributes.forEach((config) => {
    document.querySelectorAll(config.selector).forEach((element) => applyMediaAttribute(element, config, overrides));
  });
}

export function MediaOverrideRuntime() {
  useEffect(() => {
    let animationFrame = 0;
    let isMounted = true;

    const scheduleApply = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(applyMediaOverrides);
    };

    applyMediaOverrides();
    void loadMediaOverrides().then(() => {
      if (isMounted) {
        scheduleApply();
      }
    });

    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["src", "poster", mediaKeyAttribute],
      childList: true,
      subtree: true,
    });

    window.addEventListener("storage", scheduleApply);
    window.addEventListener(mediaOverrideChangeEvent, scheduleApply);

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("storage", scheduleApply);
      window.removeEventListener(mediaOverrideChangeEvent, scheduleApply);
    };
  }, []);

  return null;
}
