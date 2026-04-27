# Context

The header used **triple-tap on the logo** as a hidden shortcut to open the auth modal—leftover “admin-style” affordance. Profile inserts still sent **`is_admin: false`** even though the column has a DB default and the app never branches on admin.

## Decision

- Remove **`LogoWithTripleTap`**; render **`MouthLogo`** only (decorative). Sign-in remains via the header **Sign in / account** button and existing gates.
- Omit **`is_admin`** from **`ensureProfile`** insert payload; rely on **`profiles.is_admin` default false** in migrations.

## Alternatives considered

- Keep triple-tap as convenience — rejected; user asked to simplify and drop hidden admin-like behavior.

## Consequences

- **`src/components/LogoWithTripleTap.jsx`** deleted; **`src/App.jsx`**, **`src/utils/profileApi.js`** updated.
