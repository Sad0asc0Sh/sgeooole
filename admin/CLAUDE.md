# Admin panel — EKG Kala

React 18 + Vite + Ant Design 5, RTL Persian, Jalali dates.

## The design system lives in two files

| File | What it owns |
| --- | --- |
| `src/theme/tokens.css` | Custom CSS. Colour, type scale, spacing, radii, shadows, motion, layout metrics. |
| `src/theme/antdTheme.js` | Ant Design components. Every value mirrors a token; change the palette in both, never one. |
| `src/theme/navConfig.js` | The panel's structure: every route, its label, icon, permission and parent. |

Nothing else should hard-code a colour, radius or shadow. If a page
needs a value that isn't in the tokens, add it to `tokens.css` first.

## Colour

The storefront is saffron (`--primary: hsl(39 85% 49%)` in
`frontend/tailwind.config.ts`). The admin runs on the same hue, darkened
enough to pass AA behind white text:

- **Primary `#B45309`** — 5.02:1 on white. This is what primary buttons,
  selected nav rows, links, focus rings and progress bars use.
- **Saffron `#E79D13`** — the storefront's exact brand. 2.28:1 on white,
  so it is *decoration and dark-surface only*: the rail mark, the
  profile banner, gradients. Never behind body text.
- **Neutrals are warm, not slate.** The old `#0f172a`/`#e2e8f0` cool
  greys read muddy next to amber. Use `--ink-*` (stone) and `--line-*`.
- **Status is four words**, not fourteen colours: `ok` `#0F6B33`,
  `warn` `#8A6200`, `err` `#B3261E`, `info` `#0E7490`, each with a
  matching `--*-bg` tint. `warn` is deliberately more yellow than the
  primary so the two never get confused.

Contrast for every pair is recorded in `tokens.css`. Re-check it if you
change a value.

## Adding a page

1. Add an entry to `src/theme/navConfig.js` with `path`, `label`,
   `icon`, `permission`, `section` and `keywords` (used by ⌘K).
2. Add the route in `src/App.jsx` wrapped in `<RequirePermission>`.
3. Build the page with `<PageHeader>` and, if it lists data,
   `<ResponsiveTable>`.

The rail, the mobile drawer, the breadcrumb trail and the ⌘K palette
all derive from `navConfig` — there is nothing else to update.

## Shared components

- `components/ui/PageHeader` — every page's title, subtitle, count, actions.
- `components/ui/StatTile` — one number + label + footnote. `tone` is a
  status word, and passing `onClick` turns the tile into a link.
- `components/ui/StatusPill` — replaces ad-hoc antd `Tag` colours.
  Use `status="Delivered"` and let it pick the tone.
- `components/ui/EmptyState` — says what's missing and offers the one
  action that fixes it.
- `components/auth/AuthShell` — the frame for login/forgot/reset.
- `components/ResponsiveTable` — desktop table, mobile card list.

## Conventions

- **Money and counts** use `.money-cell` / tabular figures so columns
  don't shift as values change.
- **RTL** is set on `<html>`; use `margin-inline`/`padding-inline`, not
  left/right, so a page works if the locale ever flips.
- **Motion** is defined once (`--dur`, `--ease`) and collapses to 0
  under `prefers-reduced-motion`.
- **Charts** should read `stroke="#b45309"` from the primary token.

## Scripts

`scripts/migrate-*.mjs` are one-off codemods kept for reference (they
produced the current state). They are safe to re-run; each takes `--dry`.

## Build

```bash
npm run dev     # vite on :3001
npm run build   # node scripts/build.mjs → dist/
```
