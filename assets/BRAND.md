# Brand notes: PauseAI and AI Safety Berlin

Research notes gathered 2026-09-07 for the slide deck. Nothing here is an official brand guide beyond what is quoted; the quoted lines are the authority.

## 1. PauseAI palette

Two sources, which disagree slightly on the orange:

- The **press page** (`src/posts/press.md`, rendered at https://pauseai.info/press) gives one "brand color", `#FF9416`, and this is the orange used in every official logo file (see section 2).
- The **site stylesheet** (`src/styles/styles.css`) uses a slightly darker `#f68b1e` for UI (links, buttons, headings) and reserves `#ff9416` for the home-page hero band so it matches the logo.

Source files (all on `main` of https://github.com/PauseAI/pauseai-website):

- S1 = https://github.com/PauseAI/pauseai-website/blob/main/src/posts/press.md
- S2 = https://github.com/PauseAI/pauseai-website/blob/main/src/styles/styles.css
- S3 = https://github.com/PauseAI/pauseai-website/blob/main/src/lib/components/logo.svelte
- S4 = served bundle https://pauseai.info/_app/immutable/assets/0.CjQxFvXz.css (hsl values compiled to hex by lightningcss)

### Palette table

| Name | Hex | Where used on the site | Source and quoted line |
|---|---|---|---|
| Brand orange (logo / press) | `#FF9416` | Logo circle and "AI" in the wordmark; home hero band; the colour the press page tells third parties to use | S1 line 24: `you can use our brand color _#FF9416_` ; S2 line 20: `--hero-orange: #ff9416; /* Home hero: menu band + photo-loading backdrop must match */` ; S3 line 17: `let orange = $derived(inverted ? 'white' : '#FF9416')` |
| UI orange (`--brand`) | `#F68B1E` | Links, buttons, headings, focus outlines; identical in light and dark themes | S2 line 19: `--t-color-main: #f68b1e; /* Default main color - saturated orange */` ; line 23: `--brand-dark: #f68b1e;` ; line 26: `--brand-light: var(--t-color-main);` |
| Text, light theme | `#000000` | Body text; also the "PAUSE" part of the wordmark (`fill: var(--text)`) | S2 line 45: `--text: black;` |
| Background, light theme | `#FFFFFF` | Page background | S2 line 47: `--bg: white;` |
| Background subtle, light | `#FFE7CC` (`hsl(32, 100%, 90%)`) | Tinted panels/cards | S2 line 48: `--bg-subtle: hsl(32, 100%, 90%);` ; S4: `--bg-subtle:#ffe7cc` |
| Brand subtle, light | `#B35F00` (`hsl(32, 100%, 35%)`) | Darker orange for hover/active states on light | S2 line 75: `--brand-subtle: hsl(32, 100%, 35%);` ; S4: `--brand-subtle:#b35f00` |
| Text subtle, light | `#F7F7F7` (`hsl(32, 0%, 97%)`) | Text on orange surfaces | S2 line 46: `--text-subtle: hsl(32, 0%, 97%);` |
| Text, dark theme | `#FFFFFF` | Body text on dark | S2 line 64: `--text: white;` |
| Background, dark theme | `#000000` | Page background on dark (pure black, not grey) | S2 line 65: `--bg: black;` |
| Background secondary, dark | `#1A1A1A` (`hsl(0, 0%, 10%)`) | Cards, nav, panels on dark | S2 line 68: `--bg-secondary: hsl(0, 0%, 10%);` ; S4: `--bg-secondary:#1a1a1a` |
| Background subtle, dark | `#663600` (`hsl(32, 100%, 20%)`) | Deep-orange tinted panels on dark | S2 line 66: `--bg-subtle: hsl(32, 100%, 20%);` ; S4: `--bg-subtle:#663600` |
| Brand subtle, dark | `#FFC480` (`hsl(32, 100%, 75%)`) | Pale orange for hover/active on dark | S2 line 63: `--brand-subtle: hsl(32, 100%, 75%);` ; S4: `--brand-subtle:#ffc480` |
| Text subtle, dark | `#262626` (`hsl(32, 0%, 15%)`) | Text on orange surfaces in dark theme | S2 line 67: `--text-subtle: hsl(32, 0%, 15%);` |

Theme switching: `src/lib/theme.ts` sets a `color-scheme="light|dark"` attribute on `<html>` (line 38: `document.documentElement.setAttribute('color-scheme', value)`), and `styles.css` keys the `[color-scheme='dark']` / `[color-scheme='light']` blocks off that. Default follows `prefers-color-scheme`.

### Fonts

| Role | Font | Source |
|---|---|---|
| Headings | Saira Condensed, weight 700 | S1 line 24: `the fonts _Saira Condensed_ (700), _Montserrat Black_, and _Roboto Slab_ (300, 700)` ; S2 line 10: `--font-heading: 'Saira Condensed', 'Saira Condensed fallback', Impact, sans-serif;` |
| Body | Roboto Slab, weights 300 and 700 | S1 line 24 (as above); S2 line 9: `--font-body: 'Roboto Slab', 'Roboto Slab fallback', serif;` |
| Display / posters | Montserrat Black | S1 line 24 (as above). Not used in the site CSS; it is the wordmark-style face used in printed material. |

All three are on Google Fonts. Fallback stack on the site: Impact for headings, generic serif for body.

## 2. PauseAI logo files

Official source: the press page (S1 line 22) points to a Google Drive folder, https://drive.google.com/drive/folders/1bQ_MZ8giK-Mee4ABkO0BgcFInaXruNpa, whose `Logos/SVGs` subfolder (id `1tR5w28Zj4_0nuoS056Hf1GbUWmsOF_Qv`) holds nine SVGs. Five were downloaded via `https://drive.google.com/uc?export=download&id=<id>`; all pass `xmllint --noout`. Every file uses `#FF9416` for the orange.

| File in `assets/` | Drive name (file id) | Size | What it is |
|---|---|---|---|
| `pauseai-logo-circle.svg` | `Logo Circle Transparent.svg` (`1otzed0dkm8AT817AaC2nuSCkUoxR2-DQ`) | 530 B, 616×616 | Orange disc with the pause bars cut out (transparent), so the slide background shows through the bars. Best for a dark deck. |
| `pauseai-logo-circle-white.svg` | `Logo Circle White.svg` (`1wTSxGMS2VdKMRgPRc826wHTSMR72pk9k`) | 456 B, 654×654 | Orange disc with solid white bars. |
| `pauseai-logo-square.svg` | `Logo Square.svg` (`1M8bbrFhrRV2Z8lb18EnkzmBLa8LkA-_0`) | 565 B, 654×654 | Orange square (disc cropped to a square), bars cut out. |
| `pauseai-banner-on-dark.svg` | `Banner transparent dark bg.svg` (`1mNQa2mPeigw07KAVHNYY3a86D6CaMJat`) | 3958 B, 1280×449 | Wordmark for dark backgrounds: orange disc with black bars, "PAUSE" in white, "AI" in orange. Transparent background. |
| `pauseai-banner-on-light.svg` | `Banner transparent light bg.svg` (`1AjyF6Lx9UQ32XM_oNSmYPEcXgw_BQy1t`) | 3914 B, 1331×449 | Wordmark for light backgrounds: orange disc with white bars, "PAUSE" in black, "AI" in orange. Transparent background. |

Not downloaded (same folder): `Banner orange bg.svg`, `Banner white bg.svg`, `Cover.svg`, `Logo Square White - for pin buttons.svg`, plus PNG equivalents in `Logos/PNGs`.

The website's own inline logo component (S3) matches the banners: circle and "AI" in `#FF9416`, "PAUSE" in `var(--text)` (black on light, white on dark); an `inverted` prop swaps the orange to white and the text to black for use on an orange background.

### Licence

- Website repo `LICENSE` file (https://github.com/PauseAI/pauseai-website/blob/main/LICENSE), full text: `CC-BY 4.0` / `Mention "PauseAI" when using content from this.` / `https://creativecommons.org/licenses/by/4.0/`. GitHub reports it as `NOASSERTION` because the file is not in SPDX form.
- The press page (S1 line 24) explicitly invites third parties to make PauseAI-related material: `If you want to create PauseAI-related material yourself, you can use our brand color _#FF9416_ and the fonts ...`.
- The Drive folder itself carries no separate licence statement. Treat the logos as CC-BY 4.0 with attribution "PauseAI", per the repo licence, and credit PauseAI on the slide.

### Berlin group naming

- https://pauseai.info/communities lists countries by native name; Germany appears as "Deutschland" linking to https://pause-ai.de/. There is no "PauseAI Berlin" page on pauseai.info itself.
- https://pause-ai.de/lokalgruppen (site title `PauseAI Deutschland`) lists local groups by bare city name under the heading "Alle Lokalgruppen": Berlin, Bonn, Freiburg, Halle (Saale), Leipzig, München, Münster, Nürnberg, Würzburg. The Berlin entry reads: `We are meeting approx once a month. Meetings are in English. Join one of our messenger groups to get more info!` with contact `Sandra · germany+berlin@pauseai.info` and WhatsApp/Signal/Telegram links.
- The 2024 protest page (https://pauseai.info/2024-may) lists the group as "Berlin, Germany (sign up on Facebook)". PauseAI's own precedent for city groups is "PauseAI NYC" (local-organizing guide), so "PauseAI Berlin" is the natural form; "PauseAI Deutschland" is the parent organisation's name.

## 3. AI Safety Berlin logo

Organisation: **AI Safety Berlin**, https://aisafety.berlin (also https://www.aisafety.berlin/ on LinkedIn; Luma calendar https://luma.com/AISafetyBerlin). Tagline on LinkedIn and Luma: "AI is shaping our future. Let's get it right."

An official logo was found. The mark is a blue circuit-board brain outline (rings and traces) around a black silhouette of the Berlin Fernsehturm.

| File in `assets/` | Source URL | Size | Notes |
|---|---|---|---|
| `ai-safety-berlin-logo.svg` | https://aisafety.berlin/favicon.svg | 15702 B, viewBox 0 0 500 500 | The site's own nav uses this file with `alt="AI Safety Berlin logo"` (in `index.html` and `/learn`). Valid SVG 1.1 (exported from Affinity, `xmlns:serif`). Colours: blue `rgb(51,153,238)` = `#3399EE` (fills and strokes), black strokes for the tower, white fills for the tower windows. No background, so it works on dark slides. Note: ImageMagick 7 drops the stroked circuit traces when rasterising this file (only the rings and tower survive); Quick Look, browsers and `rsvg-convert` render it correctly, so embed the SVG directly rather than converting it with `magick`. |
| `ai-safety-berlin-logo-linkedin-200.jpg` | LinkedIn company page `og:image`, https://www.linkedin.com/company/ai-safety-berlin (media.licdn.com `.../ai_safety_berlin_logo`) | 9536 B, 200×200 JPEG, white background | Same mark, raster, low resolution. Keep only as a visual reference; use the SVG on slides. |

Checked and found nothing: `https://aisafety.berlin/images/og-image.jpg` (referenced in the page's `og:image` meta) returns a 404; no `/images/logos/` file for the org itself (that folder holds partner logos); no public GitHub repo for the site (`julxi/founding_aisafety.berlin` is association paperwork only, no logo, no licence).

Licence: none stated. The site footer reads `© 2026 AI Safety Berlin. All rights reserved.` and `Website created in personal capacity by Manuel Allgaier, Guy, Alex McKenzie and others`. Since Alex is one of the site's creators, using the mark on a talk given at or with AI Safety Berlin is a matter of asking Manuel/the group, not a licensing question.

## 4. Mapping the PauseAI palette onto a dark projected deck

1. Background `#000000` (PauseAI's own dark theme `--bg`), or `#1A1A1A` (`--bg-secondary`) if pure black blooms on the projector; use `#1A1A1A` for cards/panels either way.
2. Body text `#FFFFFF`; de-emphasised text `#FFC480` (`--brand-subtle` dark) rather than grey, so secondary text still reads as PauseAI.
3. Accent and headings `#FF9416` (the logo orange); keep `#F68B1E` for large filled shapes such as buttons or callout boxes, as the site does.
4. Deep-orange tint `#663600` (`--bg-subtle` dark) for highlighted rows or quote backgrounds; never put `#FF9416` text on it.
5. Logos: `pauseai-banner-on-dark.svg` for the wordmark, `pauseai-logo-circle.svg` as a bug; `ai-safety-berlin-logo.svg` needs no recolouring, its `#3399EE` blue sits fine next to the orange on black.
