# ParkSpace MSU

ParkSpace MSU is a bilingual Thai/English smart-parking web application and PWA foundation for Mahasarakham University.

> จองง่าย จอดสะดวก / Easy to Book, Easy to Park

## Current implementation

- Responsive user experience for phone, tablet, and desktop browsers.
- Thai/English locale routes: `/th/*` and `/en/*`.
- Public SEO routes, metadata, `sitemap.xml`, `robots.txt`, and PWA manifest.
- User-facing home, parking search, official 28-area directory, parking detail, area booking, verified-slot selection workflow, profile, vehicle management, notifications, and legal pages.
- Staff, Admin, and Developer route shells with least-privilege boundaries ready for auth guards.
- Supabase client/server helpers, booking conflict protection, availability RPC, vehicle records, role bootstrap script, and an initial schema/RLS migration.
- Thai area names are transcribed from the official MSU announcement graphic. Locations, photos, coordinates, capacity, slot labels, and live occupancy remain explicitly awaiting verification. Only the estimated-capacity example is marked Mockup Data.

## Run locally

Requires Node.js 20.9 or newer.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000/th` or `http://localhost:3000/en`.

Without Supabase environment variables, authentication and booking submission show a clear setup state and do not pretend to be live.

## Supabase setup

1. Create a Supabase project.
2. Copy the project URL and publishable key into `.env.local`.
3. Apply `supabase/migrations/202609090001_initial_schema.sql`.
4. Run `supabase/seed.sql` to create/update the 28 source-labelled areas without overwriting verified records.
5. After the two Auth accounts exist, run `supabase/bootstrap_roles.sql` as an owner/service-role operator to assign the requested Admin and Developer roles.
6. Add verified MSU coordinates, images, capacity, and slot layout through the Admin workflow.

```powershell
npx supabase init
npx supabase link --project-ref <project-ref>
npx supabase db push
```

The service-role key is server-only and must never be included in browser or mobile code.

## Important data rule

Never replace a real MSU location photo with an AI-generated image. AI assets belong under `public/ai/` or an explicitly labelled storage folder and are limited to illustrations, onboarding, decorative artwork, or design drafts. Verified parking images belong in Supabase Storage with source and verification metadata.

If individual slot data is not verified, use `slot_mode = AREA_ONLY` and reserve the parking area. Do not invent slot numbers.

## Mobile packaging

The Android and iOS Capacitor projects are already present in `android/` and `ios/`. Native features such as camera, geolocation, and notifications use Capacitor plugins, while privileged operations remain behind Supabase RLS and server/Edge Function boundaries.

```powershell
npm run build
npx cap sync
npx cap open android
npx cap open ios
```

iOS compilation requires macOS/Xcode; Android can be opened in Android Studio on Windows.

## Useful checks

```powershell
npm run typecheck
npm run lint
npm run build
```

## Folder map

```text
src/app/[locale]/       bilingual routes
src/components/         shared UI
src/features/           feature modules as they are added
src/lib/i18n.ts         locale and translation dictionary
src/lib/parking/        parking domain data/types
src/lib/supabase/       browser/server clients
src/messages/           reserved for extracted translation files
public/brand/            logo, favicon, app icons
public/ai/               labelled AI illustrations only
supabase/migrations/    schema and RLS changes
supabase/seed.sql       source-labelled 28-area seed
supabase/bootstrap_roles.sql  requested Admin/Developer role assignment
```
