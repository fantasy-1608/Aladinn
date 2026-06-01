# Project: Aladinn UI/UX Redesign

## Architecture
- `styles/aladinn-core.css`: Single source of truth for design tokens (CSS variables: `--al-*`) based on M3 Medical Blue theme. 0px flat border-radius.
- `styles/aladinn-components.css`: Shared component styles using the design tokens.
- `popup/popup.html` & `popup.css`: Extension popup UI.
- `options/options.html` & `options/options.css`: Options page UI.
- `content/*/`: Content scripts generating injected UI elements.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Design System | `styles/aladinn-core.css`, `styles/aladinn-components.css` | none | IN_PROGRESS |
| 2 | M2: Popup & Options | `popup/*`, `options/*` | M1 | PLANNED |
| 3 | M3: Content Script UI | `content/*/*`, `styles/aladinn-*.css` | M1 | PLANNED |

## Interface Contracts
### Design System ↔ UI Components
- All colors must use `--al-*` CSS variables instead of hardcoded hex values.
- Shared components must use classes defined in `aladinn-components.css`.
- 0px border-radius must be applied universally.

## Code Layout
- Design tokens: `styles/aladinn-core.css`
- Component styles: `styles/aladinn-components.css`
- Feature styles: `styles/aladinn-scanner.css`, `styles/aladinn-sign.css`, `styles/aladinn-voice.css`
- Extension pages: `popup/`, `options/`
- Content script logic: `content/scanner/`, `content/sign/`, `content/voice/`, etc.
