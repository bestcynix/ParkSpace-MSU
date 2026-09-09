# ParkSpace MSU — Dev/AI operating guide

## Product boundary

Build one product named **ParkSpace MSU** for Mahasarakham University:

- Web/PWA: responsive on phone, tablet, Windows, macOS, and Linux browsers.
- Android/iOS: Capacitor projects in `android/` and `ios/`, sharing the built web UI and Supabase source of truth.
- Language: every user-visible message has Thai and English translations. Use `/th/...` and `/en/...` routes.
- Account owner supplied by the user: `bestcynix@gmail.com`. Never hard-code this account as Admin or Developer; assign roles explicitly in Supabase.

## Non-negotiable truth rules

1. Real MSU place names, photos, buildings, coordinates, and map data require a source and verification record.
2. Only unverified capacity/estimated capacity may be marked `MOCKUP`.
3. Booking, QR, users, vehicles, scans, check-in/out, sessions, incidents, notifications, feedback, consent, and audit history are real system records from Supabase.
4. If individual slot data is not verified, set `slot_mode = AREA_ONLY`; never invent slot numbers.
5. Never present an AI-generated image as a real MSU place. If a verified image is unavailable, show the awaiting-verification placeholder.
6. Never place passwords, service-role keys, QR personal data, or private booking data in public pages, URLs, logs, SEO, or QR payloads.

## Asset locations

| Asset | Location | Rule |
|---|---|---|
| Logo source | `public/brand/parkspace-msu-logo.svg` | Original ParkSpace MSU mark based on the supplied visual direction |
| Favicon/app mark | `public/brand/app-icon.svg`, `public/brand/favicon.svg` | Keep dark parking mark + yellow location accent |
| Verified parking photos | Supabase Storage bucket `parking-media` | Store source, type, alt text, verifier, and verification date in `parking_images` |
| AI illustrations | `public/ai/` or labelled Storage folder | Onboarding, abstract backgrounds, icons, and design drafts only |
| Unverified placeholder | UI/CSS placeholder | Must say `Awaiting verified image / รอข้อมูลภาพที่ได้รับการตรวจสอบ` |
| Translations | `src/lib/i18n.ts` | Do not hard-code copy inside feature components |

Do not embed Thai or English text inside an image unless separate localized image files are supplied. Prefer HTML text so language switching and accessibility work.

## Route locations

Public/indexable: `src/app/[locale]/page.tsx`, `parking/`, `map/`, `about-project/`, `team/`, `privacy/`, `terms/`, `cookies/`, `help/`.

Private/noindex: `app/`, `staff/`, `admin/`, and `developer/`. These must be protected by authentication and role checks; RLS remains the final data boundary.

SEO files: `src/app/sitemap.ts`, `src/app/robots.ts`, root metadata in `src/app/layout.tsx`.

Feature code belongs under `src/features/` as it grows. Shared UI belongs under `src/components/`. Supabase schema and RLS belong under `supabase/migrations/`.

## Where to make changes

- Copy/translation: `src/lib/i18n.ts`.
- Layout/colors/tokens: `src/app/globals.css`.
- Logo/PWA icons: `public/brand/`, `src/app/manifest.ts`.
- Parking name/photo/location/capacity: Admin > Parking Areas, then Supabase `parking_areas`/`parking_images`; do not hard-code production records.
- Booking rules: Supabase `booking_policies` and the Admin settings UI.
- Permissions/RLS: migration SQL plus server/Edge Function authorization.
- Web routes/SEO: `src/app/[locale]/...`, `sitemap.ts`, `robots.ts`.
- Mobile packaging: `capacitor.config.ts`, `android/`, `ios/`.

Every production data correction must leave an audit record with actor, reason, before/after state, and timestamp.

## Commands

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
npm run typecheck
npm run lint
npm run build
npm audit --audit-level=moderate
```

Supabase:

```powershell
npx supabase init
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Native builds after a successful web build:

```powershell
npm run build
npx cap sync
npx cap open android
```

Open iOS on macOS/Xcode:

```powershell
npx cap open ios
```

## Definition of done for each feature

- TH/EN copy exists and does not overflow at mobile width.
- Loading, empty, error, offline, forbidden, and success states exist.
- No status relies on color alone; pair color with icon and text.
- Data is validated and authorized server-side/RLS-side.
- Sensitive actions create audit events.
- `npm run typecheck`, `npm run lint`, and `npm run build` pass.
- Public pages have localized metadata and no private data.
