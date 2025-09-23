# NOVA Build – AI Brief

Goal: Complete a carrier & admin portal that:
- Ingests EAX load list (via Playwright) into DB for admin curation
- Ingests Telegram “bid” posts into DB with 30-minute expiry timers
- Lets carriers browse “Book Loads”, place offers, track “My Loads”, see “Current Offers”, and browse “Dedicated Lanes”
- Lets admins manage loads (publish/unpublish), manage bids (Telegram), and review offers sorted low→high

Auth / Roles:
- Clerk with catch-all sign-in/up using `routing="hash"`.
- Role: `user.publicMetadata.role` ("admin" | "carrier"; default "carrier").
- Server guards in `lib/auth.ts`:
  - `requireAdmin()` — redirects to sign-in if not admin.
  - `requireCarrier()` — redirects to sign-in if not signed in.
- Admin-only routes under `/admin` with `app/admin/layout.tsx` calling `requireAdmin()`.

Data (Postgres via `postgres` npm lib):
- `loads` — curated/published loads for carriers (sourced from EAX or manual).
- `eax_loads_raw` — raw parsed rows from EAX search results.
- `bids` — Telegram “New Load Bid …” entries (with `expires_at` = `received_at` + 30 min).
- `bid_offers` — carrier-submitted offers per `bid_number`, sorted ascending.
- `lanes` — dedicated lanes for the “Dedicated Lanes” page.
- Publish flags on `loads` and `bids` control carrier visibility.

Telegram:
- Webhook endpoint `/api/telegram/webhook` receives updates.
- When message text matches the format:

------------------------------
New Load Bid: 84614390

Distance: 667.0 miles

Pickup: 09/18/2025 09:00 PM  
Delivery: 09/19/2025 11:15 AM  

🚛Stops:  
Stop 1: PALMETTO, GA  
Stop 2: OPA LOCKA, FL  

#GA  

USPS LOADS
------------------------------

  → Parse fields (bid number, distance, pickup/delivery timestamps, stops, tag/state) and upsert into `bids`.  
  → Set `expires_at = received_at + interval '30 minutes'`.

- Carrier offers: `POST /api/bids/:bidNumber/offers { amount }` stores into `bid_offers` with user identity.

UI:
- Professional load-board look (clean tables/cards, filters, status pills, countdown timers).
- Header: “Hello, {name} · {role}” with role-based nav links.
- Carrier pages (all require sign-in):
  - `/book-loads` — list published `loads where published = true`.
  - `/my-loads` — the carrier’s accepted/active loads (later can join on user).
  - `/offers` — carrier’s offers across bids.
  - `/lanes` — list of dedicated lanes.
- Admin pages (require admin):
  - `/admin/loads` — list + filters + publish toggle (calls `POST /api/admin/loads/:rr { published }`).
  - `/admin/bids` — list bids with “expires in …” badge; per-bid offer stacks (ascending).

Open tasks for the agent:
1) Scaffold carrier pages (server components) with queries:
   - `/book-loads` reads from `public.loads where published = true`.
   - `/my-loads`, `/offers`, `/lanes` initial simple lists, then refine.
2) Scaffold admin pages + APIs:
   - `/admin/loads` with publish toggle → `POST /api/admin/loads/:rr`.
   - `/admin/bids` with offers view (join `bid_offers`).
3) Implement Telegram webhook:
   - `app/api/telegram/webhook/route.ts` to parse/insert bids and set `expires_at`.
   - `POST /api/bids/:bidNumber/offers` for carriers to submit offers.
4) Add light styling:
   - Table component (sticky header, zebra rows).
   - Status pills (published/unpublished, expired/active).
   - Client countdown component for `expires_at`.
   - Active nav highlighting; small “Admin” badge.
5) (Optional) Tailwind setup if needed; otherwise minimal CSS.

Constraints & Conventions:
- Next.js 15 App Router.
- Minimal dependencies. Use server components by default; client components only for interactivity (e.g., countdown, button handlers).
- Use `.env` / deployment secrets; never hardcode keys.
- Keep DB access in server code (no secrets client-side).
- Full-file replacements in responses; include shell commands for any new files.
- Before modifying, read related files and summarize the plan.

Test Plan:
- `npm run dev` runs clean without type errors.
- Telegram webhook tested with `curl` POST using sample payload above.
- Admin pages inaccessible to non-admins (verify redirect to sign-in).
- Offer submission flow:
  - Signed-in carrier posts offer → appears under the bid (sorted asc).
- EAX ingest can be manual (interactive script) or documented as a local/cron job; admin UI surfaces DB results from `loads`.
