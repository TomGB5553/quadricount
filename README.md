# Expense Splitter

A web app for splitting expenses with friends and groups (trips, flatmates, …).
A self-hosted alternative to Tricount / Splitwise.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind) — UI + server logic
- **Supabase** — Postgres, Auth, Row Level Security
- **Vercel** — hosting, deployed from GitHub

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL + anon key
npm run dev
```

Open http://localhost:3000.

## Database

Migrations live in `supabase/migrations/` and are applied with the Supabase CLI:

```bash
npx supabase db push
```

The project is linked with `npx supabase link --project-ref <ref>`.

## Deploying

1. Push this repo to GitHub.
2. Import it into Vercel (auto-detects Next.js).
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as
   environment variables in Vercel.
4. In Supabase → Authentication → URL Configuration, add the Vercel domain to
   the Site URL and redirect URLs.

## Features

Auth · groups & members · expenses with multiple payers · flexible splits
(equal / exact / percentage / shares / mixed) · at-a-glance impact per person ·
balance calculation · filter by person · member removal · multi-currency with
FX conversion · cross-group balance transfer · settlements · link invitations.
