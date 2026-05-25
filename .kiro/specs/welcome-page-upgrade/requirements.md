# Requirements Document

## Introduction

The **Welcome Page Upgrade** feature restructures the Gestion Ventes frontend routing so that the public landing page becomes the application's root entry point, the authenticated dashboard moves to a dedicated `/dashboard` route, and all navigation components (Sidebar, TopBar, ProtectedRoute) are updated consistently. The feature also includes a visual polish pass on the Welcome page to deliver a more impressive, "jury-amazed" first impression with enhanced hero design, smooth animations, and a professional CTA section.

## Glossary

- **App**: The Gestion Ventes React/Vite single-page application.
- **Router**: The React Router v6 `BrowserRouter` instance defined in `App.jsx`.
- **Welcome_Page**: The public landing page component (`Welcome.jsx`) accessible without authentication.
- **Dashboard**: The authenticated analytics page (`Dashboard.jsx`) showing KPIs, charts, and sales data.
- **ProtectedRoute**: The `ProtectedRoute.jsx` component that guards authenticated routes and redirects unauthenticated users.
- **Sidebar**: The `Sidebar.jsx` navigation component rendered inside the authenticated `AppLayout`.
- **TopBar**: The `TopBar.jsx` header component rendered inside the authenticated `AppLayout`.
- **Unauthenticated_User**: A visitor who has no active session in the auth store.
- **Authenticated_User**: A visitor who has a valid session in the auth store.

---

## Requirements

### Requirement 1: Root Route Points to the Public Welcome Page

**User Story:** As an unauthenticated user, I want the root URL `/` to show the public landing page, so that I can learn about the application before logging in.

#### Acceptance Criteria

1. WHEN an unauthenticated user navigates to `/`, THE Router SHALL render the Welcome_Page without requiring authentication.
2. WHEN an authenticated user navigates to `/`, THE Router SHALL redirect the user to `/dashboard`.
3. THE Router SHALL serve the Welcome_Page at both `/` and `/welcome` for backward compatibility.

---

### Requirement 2: Authenticated Dashboard Moves to `/dashboard`

**User Story:** As an authenticated user, I want the dashboard to be available at `/dashboard`, so that the URL clearly reflects the page I am on.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to `/dashboard`, THE Router SHALL render the Dashboard inside the `AppLayout`.
2. WHEN an unauthenticated user navigates to `/dashboard`, THE ProtectedRoute SHALL redirect the user to `/` (the Welcome_Page).
3. THE Router SHALL remove the previous mapping of Dashboard to `/` and replace it with `/dashboard`.

---

### Requirement 3: ProtectedRoute Redirects Without Loops

**User Story:** As a developer, I want ProtectedRoute to redirect unauthenticated users to the Welcome_Page without causing redirect loops, so that the application navigates predictably.

#### Acceptance Criteria

1. WHEN an unauthenticated user accesses a protected route, THE ProtectedRoute SHALL redirect the user to `/`.
2. WHEN an authenticated user accesses a protected route, THE ProtectedRoute SHALL render the protected content.
3. IF a user with an insufficient role accesses a role-restricted route, THEN THE ProtectedRoute SHALL redirect the user to `/dashboard`.
4. THE ProtectedRoute SHALL never redirect a user to a route that itself triggers another redirect (no redirect loops).

---

### Requirement 4: Sidebar Dashboard Link Updated

**User Story:** As an authenticated user, I want the Sidebar's Dashboard link to point to `/dashboard`, so that clicking it takes me to the correct route.

#### Acceptance Criteria

1. THE Sidebar SHALL link the "Dashboard" navigation item to `/dashboard`.
2. WHEN the current route is `/dashboard`, THE Sidebar SHALL mark the Dashboard navigation item as active.
3. THE Sidebar SHALL not contain any navigation item pointing to `/` as the Dashboard destination.

---

### Requirement 5: TopBar Page Titles Updated

**User Story:** As an authenticated user, I want the TopBar to display the correct title and subtitle for the `/dashboard` route, so that the page header is accurate.

#### Acceptance Criteria

1. WHEN the current route is `/dashboard`, THE TopBar SHALL display the title "Dashboard" and the subtitle "Vue d'ensemble de votre activité".
2. THE TopBar SHALL include `/dashboard` in its `PAGE_TITLES` mapping.
3. THE TopBar SHALL remove any stale mapping for `/` as a Dashboard title entry, if present.

---

### Requirement 6: Catch-All Route Redirects to Welcome Page

**User Story:** As a user who navigates to an unknown URL, I want to be redirected to the Welcome_Page, so that I always land on a meaningful page.

#### Acceptance Criteria

1. WHEN a user navigates to any route not defined in the Router, THE Router SHALL redirect the user to `/`.
2. THE Router SHALL use a `replace` navigation so the unknown URL is not added to the browser history.

---

### Requirement 7: Welcome Page Visual Polish

**User Story:** As a visitor, I want the Welcome page to have an impressive, professional design with smooth animations and a compelling call-to-action, so that the application makes a strong first impression on evaluators.

#### Acceptance Criteria

1. THE Welcome_Page SHALL display a hero section with a headline, a descriptive subtitle, and at least one primary call-to-action button linking to `/login`.
2. THE Welcome_Page SHALL display a feature highlights section with at least four feature cards describing key application capabilities.
3. THE Welcome_Page SHALL display a final call-to-action section encouraging the visitor to log in.
4. WHEN the Welcome_Page first renders, THE Welcome_Page SHALL apply entrance animations (fade-in or slide-up) to the hero headline, subtitle, and CTA buttons.
5. THE Welcome_Page SHALL display a mock dashboard preview (static visual) in the hero section to illustrate the application's analytics capabilities.
6. THE Welcome_Page SHALL be fully responsive, adapting its layout for viewport widths from 320px to 1440px and above.
7. THE Welcome_Page SHALL meet WCAG 2.1 AA color contrast requirements for all text elements.
8. WHEN a visitor clicks any CTA button on the Welcome_Page, THE Welcome_Page SHALL navigate the visitor to `/login`.

---

### Requirement 8: Navigation Consistency After Login

**User Story:** As an authenticated user who has just logged in, I want to be redirected to `/dashboard` instead of `/`, so that I land directly on the analytics view.

#### Acceptance Criteria

1. WHEN an authenticated user completes login, THE App SHALL redirect the user to `/dashboard`.
2. THE Login page SHALL redirect to `/dashboard` on successful authentication, not to `/`.
