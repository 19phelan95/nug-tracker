# Nug-Tracker — Run, Verify & Deploy

This is the optimised source. It runs exactly as before with **no env vars** (local-first), and gains
optional cloud sync once Supabase is configured.

> Heads up: these changes were prepared in an environment without npm access, so the build was **not**
> compiled here. Run `npm install && npm run build` once locally first — it's the verification gate. If
> anything fails to compile, send me the error and I'll fix it.

## 1. Run locally

```bash
cd nug-tracker
npm install
npm run dev        # http://localhost:5173
```

## 2. Verify the build (do this before deploying)

```bash
npm run build      # tsc -b && vite build — must pass clean
npm run preview    # serve the production build locally to sanity-check
```

## 3. Deploy to Vercel

Your repo (`https://github.com/19phelan95/nug-tracker.git`) auto-deploys on push to `main`.

```bash
# from your local clone of the repo (copy these files in if needed)
git add -A
git commit -m "Optimise app; add Vercel SPA routing; scaffold gated Supabase cloud sync"
git push origin main
```

`vercel.json` adds the SPA rewrite so refreshing `/work`, `/life`, `/overtime` no longer 404s in production.

> If your GitHub repo keeps the app at the repo **root**, copy the contents of this `nug-tracker/` folder
> to the repo root (so `package.json` sits at the top). In Vercel, the project's **Root Directory** must
> point to wherever `package.json` lives.

## 4. Activate Supabase cloud sync (optional, when you're ready)

Everything below is **off** until you set the two env vars — the app stays local-first without them.

1. **Create the database.** In your Supabase project → SQL Editor, run `supabase/schema.sql`.
   (Use *this* file — ids are `text` to match the app, unlike the original handover draft.)
2. **Set env vars locally:** copy `.env.example` → `.env.local` and fill in:
   ```bash
   VITE_SUPABASE_URL=...        # Project Settings → API → Project URL
   VITE_SUPABASE_ANON_KEY=...   # Project Settings → API → anon / public key
   ```
   Never use the `service_role` key in this app.
3. **Set the same two vars in Vercel:** Project → Settings → Environment Variables → add for Production
   (and Preview), then redeploy.
4. **Use it.** Open the app → **Overtime** tab → *Account & cloud sync* → create an account / sign in.
   - First sign-in **seeds** your account from this device if the account is empty.
   - If the account already has data, it **loads** that down to this device.
   - After that, changes sync automatically (local stays the safety net).
   - On a second device, sign in and hit **Pull cloud → this device**.

### Sync model (current foundation)
Local is the source of truth; the cloud is a mirror of the signed-in device. This is the simple,
safe first version from the integration plan — great for single-device-at-a-time use across your
laptop and phone. True multi-device simultaneous-edit merging (offline queue / per-record
last-write-wins) is the next increment.

## What changed in this pass
- **Fix:** the recent work log now filters *before* truncating to 20 rows (Week/Month no longer miss older sessions).
- **Types:** unified overtime row shape (removed the `'days' in row` workaround).
- **Perf:** heavy aggregates (overtime rows, life bars, 7-day trends) recompute once a minute instead of every second.
- **Mobile/PWA:** iOS safe-area insets, theme-color, SVG favicon, web manifest (installable).
- **Routing:** `vercel.json` SPA fallback for deep links.
- **Cloud (gated, additive):** Supabase client, auth, cloud storage adapter, migration, and an Account panel — all inert until env vars are set.

## Guardrails kept (per handover non-negotiables)
Work/Life/Overtime/Home structure, pace-based decay, derived overtime, and JSON backup/import are all unchanged.
The service_role key is never referenced client-side; `.env*` stays gitignored.
