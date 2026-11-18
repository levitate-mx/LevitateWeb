export type SiteMetadata = Readonly<{
  key: string;
  path: string;
  title: string;
  description: string;
  canonical: string;
  image: string;
  imageAlt: string;
}>;
export type SiteMetadataTag = { tagName: "title" | "meta" | "link"; attributes: Record<string, string>; text?: string };
export const siteOrigin: "https://levitate.mx";
export const siteName: "Levitate MX";
export const sitePages: readonly SiteMetadata[];
export function resolveSiteMetadata(pathname: string): SiteMetadata | null;
export function getSiteMetadataTags(metadata: SiteMetadata): SiteMetadataTag[];
export function isSiteMetadataTag(tagName: string, attributes: Record<string, string>): boolean;
export function renderSiteMetadataTags(metadata: SiteMetadata): string;
export function applySiteMetadataToHtml(html: string, metadata: SiteMetadata | null | undefined): string;
