# Codex Project Notes

## Hero Sections

- All top-level page heroes must feel like the same design system.
- Heroes should occupy the full available viewport: full width and at least the full screen height.
- Use the shared viewport token in `src/styles/global.css`:
  - `--levitate-hero-screen`
  - It defaults to `100svh` and upgrades to `100dvh` when supported.
- If a new hero class is added, include it in the shared hero normalization block near the end of `src/styles/global.css`.
- When a hero includes the main header inside the hero, use a grid layout with the header row and a stretched content row.
- When a page has the header outside the hero, make sure the first visual section still reads as a full-screen hero and does not look shorter than the rest of the site.
- On mobile, heroes may grow beyond the viewport if their content needs more room; do not cut off text or controls to force an exact height.

## Hero Typography

- Hero titles, subtitles, and descriptions should use the shared typography scale in `src/styles/global.css`:
  - `--levitate-hero-title-size`
  - `--levitate-hero-subtitle-size`
  - `--levitate-hero-description-size`
- Hero titles should share the same display font, weight, line-height, and letter spacing.
- In hero and major section titles, at least one meaningful keyword, phrase, or title line should be highlighted in Levitate pink, following the homepage reference: mostly white title text with a clear pink accent such as the supporting title line.
- Hero descriptions should share the same body font, size, weight, line-height, and max width.
- Do not create one-off hero title sizes unless there is a strong layout reason; prefer extending the shared typography block.

## Sede Pages

- Sede detail pages should use the same `SedesPage` hero format for CDMX, Puebla, and Estado de Mexico.
- Do not route one sede to a visually different hero pattern unless the user explicitly asks for a different page type.
- Keep old route aliases working when changing a visible sede URL.

## Grid And Card Layouts

- In responsive card grids with two or more columns, avoid leaving a single orphan card at half width on the final row.
- When a card is alone in the last row, extend it across the available grid columns, for example with `:last-child:nth-child(odd) { grid-column: 1 / -1; }` in two-column grids.
- Keep the mobile single-column layout natural; the full-width orphan rule should not create horizontal overflow.

## Verification

- After changing hero layout or typography, run `npm run build`.
- Check at least desktop and mobile viewport behavior:
  - Desktop example: `1280x720`
  - Mobile example: `390x844`
- Confirm heroes are not shorter than the viewport and that title/description text does not overflow.
