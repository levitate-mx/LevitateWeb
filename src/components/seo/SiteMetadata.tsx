import { createElement } from "react";
import { getSiteMetadataTags, isSiteMetadataTag, resolveSiteMetadata } from "../../../shared/site-seo.js";

/** The public site uses document navigations. Apply once before rendering React. */
export function applySiteMetadata(document: Document, pathname: string) {
  const metadata = resolveSiteMetadata(pathname);
  if (!metadata || !document.head) return false;
  for (const element of document.head.querySelectorAll("title, meta, link")) {
    if (isSiteMetadataTag(element.tagName, Object.fromEntries(Array.from(element.attributes, attribute => [attribute.name, attribute.value])))) element.remove();
  }
  for (const { tagName, attributes, text } of getSiteMetadataTags(metadata)) {
    const element = document.createElement(tagName);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    if (text !== undefined) element.textContent = text;
    document.head.append(element);
  }
  return true;
}

/** Optional declarative head for renderers; it emits no visible page content. */
export function SiteMetadata({ pathname }: { pathname: string }) {
  const metadata = resolveSiteMetadata(pathname);
  return metadata ? <>{getSiteMetadataTags(metadata).map(({ tagName, attributes, text }) => createElement(tagName, { ...attributes, key: attributes["data-site-seo"] }, text))}</> : null;
}
