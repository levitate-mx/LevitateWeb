export type BrowserDownload = { url: string; fileName: string };

export function prepareBrowserDownload(
  blob: Blob,
  fileName: string,
): BrowserDownload {
  // Safari may read this URL after its download prompt or PDF viewer opens.
  // Do not revoke it on a timer or when a React panel unmounts: a separate
  // preview can still need the file. The browser releases it on document unload.
  // https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/blob#memory_management
  return { url: URL.createObjectURL(blob), fileName };
}

export function startBrowserDownload(download: BrowserDownload) {
  const link = document.createElement("a");
  link.href = download.url;
  link.download = download.fileName;
  // If Safari opens a preview instead of downloading, keep the source document
  // (and its blob URL) alive rather than navigating the admin page away.
  link.target = "_blank";
  link.rel = "noopener";
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
  }
}
