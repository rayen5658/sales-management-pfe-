# Implementation Plan: Welcome Page Upgrade

## Overview

The routing structure is already largely correct — `RootRedirect`, `ProtectedRoute`, `Sidebar`, `TopBar`, and `Login` all match the design. The remaining work is: (1) verifying the `RootRedirect` implementation in `App.jsx` is complete and correct, and (2) adding entrance animations and a 320px responsive floor to `Welcome.jsx` / `Welcome.css`.

## Tasks

- [x] 1. Verify and finalize `RootRedirect` in `App.jsx`
  - Confirm `RootRedirect` reads `isAuthenticated` from `useAuthStore` and returns `<Navigate to="/dashboard" replace />` for authenticated users and `<Welcome />` for guests
  - Confirm the `/welcome` alias route renders `<Welcome />` without an auth check
  - Confirm the catch-all `<Route path="*">` uses `<Navigate to="/" replace />`
  - No code changes expected — this task is a correctness gate before writing tests
  - _Requirements: 1.1, 1.2, 1.3, 2.3, 6.1, 6.2_

- [x] 2. Add entrance animations to `Welcome.jsx` and `Welcome.css`
  - [x] 2.1 Add `@keyframes fadeInUp` and `@keyframes fadeIn` to `Welcome.css`
    - `fadeInUp`: translate from `translateY(24px)` + `opacity: 0` to `translateY(0)` + `opacity: 1`
    - `fadeIn`: opacity 0 → 1
    - Add utility classes `.animate-fade-in-up` and `.animate-fade-in` with `animation-fill-mode: both`
    - Add staggered delay variants: `--delay-1` through `--delay-4` (0s, 0.12s, 0.24s, 0.36s) as inline-style-friendly values, or as modifier classes `.delay-1` through `.delay-4`
    - _Requirements: 7.4_

  - [x] 2.2 Apply animation classes to hero elements in `Welcome.jsx`
    - Add `.animate-fade-in-up` to the `.pill` badge, `<h1>`, `<p>` subtitle, and `.hero-ctas` div
    - Apply staggered delays so elements appear sequentially (pill → h1 → p → ctas)
    - _Requirements: 7.4_

  - [x]* 2.3 Write unit tests for entrance animation classes
    - Render `<Welcome />` and assert that the hero `<h1>`, subtitle `<p>`, and CTA container have the `animate-fade-in-up` class
    - _Requirements: 7.4_

- [x] 3. Add 320px responsive floor to `Welcome.css`
  - Add `@media (max-width: 320px)` block (or adjust the existing 560px breakpoint) to prevent horizontal overflow on the smallest viewports
  - Ensure `.hero-copy h1` font-size does not overflow, `.hero-ctas` wraps correctly, and `.trust-row` items stack without overflow
  - Verify no element has a fixed `min-width` wider than 320px
  - _Requirements: 7.6_

- [x] 4. WCAG 2.1 AA contrast audit
  - [x] 4.1 Audit color pairs in `Welcome.css` against 4.5:1 ratio
    - Body text: `#e5e7eb` on `#0b1020` — verify passes (expected: ~14:1)
    - Muted text: `rgba(229,231,235,0.75)` on `#0b1020` — verify passes (expected: ~9:1)
    - CTA button: `#fff` on `var(--c1)` (`#4f46e5`) — verify passes (expected: ~4.6:1)
    - Gradient text `.gradient-text` — add a solid fallback color (`color: #a78bfa`) before the gradient clip rule so the text is readable if `background-clip: text` is unsupported
    - _Requirements: 7.7_

  - [x] 4.2 Add visible focus styles for all interactive elements
    - Ensure `.btn-primary`, `.btn-secondary`, `.link-ghost`, `.link-muted` have a `:focus-visible` outline (e.g., `outline: 2px solid #60a5fa; outline-offset: 3px`)
    - _Requirements: 7.7_

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Write routing property-based tests
  - [x] 6.1 Write property test for Property 1: all protected routes redirect unauthenticated users to `/`
  - [x] 6.2 Write property test for Property 2: all protected routes render content for authenticated users
  - [x] 6.3 Write property test for Property 3: all unknown routes redirect to `/`
  - [x] 6.4 Write property test for Property 4: all CTA buttons on Welcome navigate to `/login`

- [x] 7. Write example-based unit tests for routing scenarios
  - [x] 7.1 Unauthenticated user at `/` renders Welcome page
  - [x] 7.2 Authenticated user at `/` redirects to `/dashboard`
  - [x] 7.3 `/welcome` renders Welcome page (unauthenticated)
  - [x] 7.4 Authenticated user at `/dashboard` renders Dashboard
  - [x] 7.5 Unauthenticated user at `/dashboard` redirects to `/`
  - [x] 7.6 Catch-all unknown route uses `replace` navigation and redirects to `/`
  - [x]* 7.7 Welcome hero section contains `<h1>`, subtitle `<p>`, and at least one CTA linking to `/login`
  - [x]* 7.8 Welcome renders at least 4 feature cards
  - [x]* 7.9 Welcome renders final CTA section
  - [x]* 7.10 Welcome hero mock dashboard element is present
  - [x]* 7.11 Successful login calls `navigate('/dashboard')`

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- `fast-check` is the PBT library; install with `npm install --save-dev fast-check` in `frontend/` if not already present
- Property tests should use `numRuns: 100` minimum
- WCAG contrast values are pre-audited in the design; task 4.1 is a code-level confirmation pass
- No backend changes are required for this feature
