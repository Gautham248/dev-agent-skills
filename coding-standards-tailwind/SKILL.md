---
name: coding-standards-tailwind
description: >
  Company conventions for wiring and using Tailwind CSS v4 -- CSS-first
  @theme configuration (no tailwind.config.js), the app.css/utils.css/fonts.css
  stylesheet split, semantic design tokens, promoting repeated arbitrary
  values to tokens, sticking to the standard breakpoint scale, cn() for class
  composition, tailwind-variants for multi-axis components, the shadcn-style
  generated component library, and prettier-plugin-tailwindcss for class
  sorting. Use when setting up Tailwind in a project, adding or changing
  design tokens, styling a component, or deciding between an arbitrary
  value and a token. Does NOT cover component structure, client state, or
  the shared api wrapper -- see coding-standards-frontend for those.
---

<!-- BEGIN dev-agent-skills clarification protocol (managed by setup.sh -- do not edit this block manually; edit CLARIFICATION-PROTOCOL.md instead) -->
Before doing anything else in this skill, read and follow the clarification protocol at:
../config/CLARIFICATION-PROTOCOL.md
<!-- END dev-agent-skills clarification protocol -->

<!-- BEGIN dev-agent-skills self-improvement protocol (managed by setup.sh -- do not edit this block manually; edit SELF-IMPROVEMENT-PROTOCOL.md instead) -->
While using this skill, and especially when you finish, read and follow the self-improvement protocol at:
../config/SELF-IMPROVEMENT-PROTOCOL.md
(Append real edge cases to this skill's own references/edge-cases.md — create it if missing. See the protocol file for what qualifies.)
<!-- END dev-agent-skills self-improvement protocol -->

# Coding Standards -- Tailwind CSS

Generalized guidelines for wiring and using Tailwind CSS v4 in a project. Universal rules were already applied by the `coding-standards` dispatcher before this skill was invoked. These conventions are framework-agnostic: examples use the Svelte adapter (Svelte components, shadcn-svelte primitives), but the same CSS-first config, theme-token, and utility structure applies to React, Vue, or Solid -- swap the component syntax for the project's framework.

## Base rules

- **CSS-first config, no `tailwind.config.js`.** Tailwind v4 moves every design token (colors, fonts, radii, easing, keyframes) into an `@theme { ... }` block in the main stylesheet. Don't add a JS config file "just in case" -- it's dead weight in v4 unless a custom plugin function truly can't be expressed as CSS.
- **Three stylesheets, three jobs**, all funneled through one entry point (`app.css`) imported exactly once at the app root: `app.css` owns the Tailwind import, `@theme` tokens, base resets, and theme-driven utility classes; `utils.css` owns one-off CSS that doesn't fit the token model (keyframe animations, native safe-area helpers, browser-quirk fixes); `fonts.css` owns `@font-face` declarations only. Never import `utils.css`/`fonts.css` directly from a component.
- **Tokens are semantic, not literal**: named for role (`--color-primary`, `--color-card-secondary`) not appearance (`--color-dark-gray`); colors as `oklch()` with a hex comment; font-size tokens always paired with a `--text-{size}--line-height` companion.
- **Promote repeated arbitrary values to tokens.** A `text-[10px]`/`w-[137px]` one-off is fine. The moment the same (or cosmetically-equivalent) value recurs: snap to an existing close token if the difference is a pixel or two, or add a new named token if it's genuinely distinct and recurring. Never leave the same bracket literal copy-pasted across files.
- **Standard breakpoint scale only** (`sm`/`md`/`lg`/`xl`/`2xl`). No arbitrary `min-[…]:`/`max-[…]:` variants or hand-written `@media` blocks; a recurring in-between tier gets a real `--breakpoint-*` token instead.
- **`cn()` is the only way to compose classes** (`clsx` + `tailwind-merge`), defined once in a shared utils module. Never hand-roll template-string class concatenation -- it's how override bugs (a caller's `className` losing to a component's baked-in class, or vice versa) sneak in.
- **`tailwind-variants` (`tv()`) for any component with more than one visual axis** (variant × size, tone × emphasis). Exported alongside the component so callers can read the variant/size prop types. Don't reach for nested ternaries once a component has more than one axis.
- **Reusable multi-property visual effects get a named class** in `app.css`'s `@layer utilities`, built from theme tokens -- reserve this for effects needing multiple vendor-prefixed properties Tailwind has no single utility for, and reused across more than one component. A one-off effect stays inline as arbitrary-value classes.
- **Component primitives come from a generator CLI** (e.g. shadcn-style) into a `ui/` folder, configured centrally so generated components resolve against the project's own theme tokens. Don't hand-write a new `ui/` primitive the generator already ships, and don't hand-edit a generated component's token names to something ad hoc -- add the missing token to `@theme` first.
- **Class sorting is automated**, not hand-ordered: a Tailwind-aware Prettier plugin, pointed at the project's own theme stylesheet so it sorts by the project's token order.

## Deeper reference

### Wiring

Two pieces: a Vite plugin (`@tailwindcss/vite` in `vite.config.ts`) for the main build, and a PostCSS fallback (`@tailwindcss/postcss` in `postcss.config.js`) kept alongside it for tooling that runs outside the Vite pipeline (some editor integrations, non-Vite build steps).

### Design tokens

```css
@theme {
  --font-sans: 'Inter', sans-serif;

  --color-primary: oklch(18% 0.01 260); /* #16181C */
  --color-secondary: oklch(24% 0.01 258); /* #1E2126 */

  --text-sm: 0.875rem;
  --text-sm--line-height: calc(1.25 / 0.875);

  --radius-md: 0.375rem;

  --animate-spin: spin 1s linear infinite;
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
}
```

Gradients are named background-images (`--background-image-hero-gradient`) rather than repeated `linear-gradient(...)` literals in markup. Keyframes are declared inside `@theme`, next to the `--animate-*` variable that references them. Add new tokens in the matching category (colors near colors, radii near radii), not appended to the bottom of the file.

### Token vs. arbitrary-value decision

1. **A close-enough token already exists → snap to it.** A 1-2px difference on a small label from a design export is drift, not a deliberate decision worth preserving as a magic number.
2. **No close token exists, and the value recurs → promote it.** Give it its own token with its paired line-height (for text sizes) and replace every occurrence.

Rule of thumb: if snapping would change the rendered size by only a pixel or two at small sizes ("would anyone notice in a side-by-side screenshot"), snap. If it recurs and is meaningfully different from every existing token, that's a real gap in the scale -- add it once, named. Applies beyond font sizes to arbitrary spacing, width/height, and radius values too.

### `cn()`

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

`twMerge` (not plain concatenation) resolves later conflicting Tailwind classes correctly -- e.g. a caller passing `className="px-6"` to override a component's baked-in `px-4` -- instead of both classes landing in the DOM and the cascade deciding arbitrarily.

### `tailwind-variants`

```ts
export const buttonVariants = tv({
  base: 'inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium ...',
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground hover:bg-primary/90',
      destructive: 'bg-destructive text-white hover:bg-destructive/90'
    },
    size: {
      default: 'h-9 px-4 py-2',
      sm: 'h-8 px-3'
    }
  },
  defaultVariants: { variant: 'default', size: 'default' }
});
```

Consumed as `cn(buttonVariants({ variant, size }), className)` -- always wrapped in `cn()` so a caller-supplied `class` prop can still override the resolved variant classes.

### Component library

Three tiers, same as `coding-standards-frontend`'s component structure: `ui/` (generated primitives), `elements/` (hand-written app-specific composites), feature folders (domain components). A `components.json`-style config at the repo root drives the generator CLI and points `tailwind.css` at the project's real stylesheet, so generated components pick up the project's own tokens automatically instead of the generator's generic defaults.

### Optional integrations

- **Icon plugins** (on-demand, e.g. `unplugin-icons`) for ad hoc icons from any collection, re-exported from one shared icon barrel file; a directly-imported icon package (e.g. `lucide-*`) only in files that already use that style -- don't mix both import styles within the same component.
- **`tw-animate-css`** for `animate-in`/`animate-out` enter/exit utilities on overlay components (dialog, sheet, drawer, tooltip) instead of hand-written CSS transitions.
- **JS-based CSS plugins** (`@tailwindcss/forms`, `@tailwindcss/typography`) require an explicit `@plugin '<package>';` directive in the stylesheet -- installing the npm package alone does nothing in v4. Verify by checking compiled CSS or rendering the page, not by assuming the plugin is active because the dependency is installed.

### Theme mode

Dark-only is a valid starting point: define the `dark` variant and a `[data-theme='light']` stub with no populated overrides yet, and write `dark:` variants defensively (`prose dark:prose-invert`) so the codebase doesn't need a class-by-class revisit if light mode is added later. Flag any third-party component hardcoded to a fixed theme prop (e.g. a toast library configured with a literal `theme="dark"`) as a spot to revisit when a toggle exists.

## If something goes wrong

Before improvising a fix, check `references/edge-cases.md` -- this may already be a documented, solved problem. If it's genuinely new once you're done, follow the self-improvement protocol and add it there.
