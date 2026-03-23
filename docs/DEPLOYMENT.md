# FIFA Queue - Deployment Guide

Everything here uses **free tiers**. Total cost: **$0/month** for 6-10 users.

---

## 1. Supabase (Backend)

### Create Project

1. Sign up at [supabase.com](https://supabase.com) (free tier: 2 projects, 500 MB DB, 1 GB storage)
2. Click **New Project**, pick a name (e.g. `fifa-queue`), set a strong database password, choose a region close to Iceland (EU West works)
3. Wait for the project to finish provisioning (~2 minutes)

### Run Schema Migration

1. Go to **SQL Editor** in the Supabase dashboard
2. Open the file `supabase/migrations/001_schema.sql` from this repo
3. Paste the entire contents into the SQL editor and click **Run**
4. This creates all 7 tables, indexes, RLS policies, and inserts the default "Season 1"

### Enable Realtime

1. Go to **Database > Replication** (or **Database > Publications**)
2. Enable Realtime for these tables:
   - `queue_entries`
   - `games`
   - `game_players`
   - `game_results`

### Set Up pg_cron (Queue Auto-Open)

The queue opens automatically at 11:00 Mon-Fri (Europe/Reykjavik). To enable this:

1. Go to **SQL Editor**
2. Run the following, replacing the placeholder values:

```sql
select cron.schedule(
  'open-queue',
  '0 11 * * 1-5',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/open-queue',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  $$
);
```

Note: `pg_cron` uses UTC. The cron expression `0 11 * * 1-5` works because Iceland (Europe/Reykjavik) is UTC+0 year-round (no daylight saving). If your target timezone differs, adjust accordingly.

### Collect Your Keys

From **Settings > API** in the Supabase dashboard, note down:

| Key | Where to find it |
|-----|-----------------|
| Project URL | `https://YOUR_PROJECT_REF.supabase.co` |
| Anon (public) key | Under "Project API keys" |
| Service role key | Under "Project API keys" (keep this secret!) |

---

## 2. Google OAuth Setup

### Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Go to **APIs & Services > OAuth consent screen**
   - Choose **External** user type
   - Fill in app name: "FIFA Queue"
   - Add your email as a test user (and your colleagues' emails)
   - No scopes needed beyond the default `email` and `profile`
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > OAuth 2.0 Client ID**
6. Choose **Web application**
7. Set **Authorized redirect URIs**:

| Environment | Redirect URI |
|------------|-------------|
| Local dev (Expo) | `https://auth.expo.io/@your-expo-username/fifa-queue` |
| Production (Vercel) | `https://your-domain.vercel.app` |
| Supabase Auth | `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` |

8. Copy the **Client ID** (you'll need it for env vars)

### Enable Google Provider in Supabase

1. In Supabase dashboard, go to **Authentication > Providers**
2. Enable **Google**
3. Paste your Google Client ID and Client Secret
4. Save

---

## 3. Web App Deployment (Vercel)

Vercel is the simplest option for Expo web exports. Free tier covers this use case easily.

### Option A: CLI Deploy (Quick)

```bash
# From the fifa-queue directory:

# 1. Build the static web export
npx expo export --platform web

# 2. Deploy to Vercel
npx vercel dist/
```

On first run, Vercel CLI will prompt you to log in and link/create a project. Follow the prompts.

### Option B: GitHub Auto-Deploy (Recommended)

1. Push the repo to GitHub
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click **Import Project** and select the `fifa-queue` repo
4. Configure the build:
   - **Framework Preset:** Other
   - **Build Command:** `npx expo export --platform web`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
5. Deploy

Every push to `main` will auto-deploy.

### Custom Domain (Optional)

1. In Vercel project settings, go to **Domains**
2. Add your domain and follow the DNS instructions
3. Update your Google OAuth redirect URIs to include the custom domain

### Alternative: Netlify

If you prefer Netlify:

```bash
# Build
npx expo export --platform web

# Option 1: Drag-and-drop the dist/ folder at app.netlify.com
# Option 2: CLI deploy
npx netlify-cli deploy --dir=dist --prod
```

---

## 4. Environment Variables

### Local Development (`.env.local`)

Create `.env.local` in the project root:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
EXPO_PUBLIC_GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
```

Never put `SUPABASE_SERVICE_ROLE_KEY` in the client-side `.env.local`.

### Vercel Dashboard (Production Web)

Go to your Vercel project **Settings > Environment Variables** and add:

| Variable | Value |
|----------|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Your Google OAuth Client ID |

### Supabase Edge Functions (Server-Side)

If you deploy Edge Functions (e.g., `open-queue`, `send-push`), set secrets via the Supabase CLI:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set EXPO_ACCESS_TOKEN=your-expo-access-token
```

Or set them in the Supabase dashboard under **Edge Functions > Secrets**.

### iOS Builds (Future)

If you later build for iOS with EAS:

```bash
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_PROJECT_REF.supabase.co"
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-anon-key"
eas secret:create --name EXPO_PUBLIC_GOOGLE_CLIENT_ID --value "your-client-id"
```

---

## 5. Quick Deploy Checklist

Follow these steps in order to go from zero to live:

- [ ] **1. Create Supabase project** at supabase.com (free tier)
- [ ] **2. Run schema SQL** -- paste `supabase/migrations/001_schema.sql` into the SQL Editor and run
- [ ] **3. Enable Realtime** on `queue_entries`, `games`, `game_players`, `game_results`
- [ ] **4. Create Google Cloud project** and set up OAuth 2.0 credentials
- [ ] **5. Enable Google Auth in Supabase** -- paste Client ID and Secret into Auth > Providers > Google
- [ ] **6. Set up pg_cron** -- run the cron schedule SQL with your project URL and service role key
- [ ] **7. Build the web app** -- `npx expo export --platform web`
- [ ] **8. Deploy to Vercel** -- `npx vercel dist/` or connect GitHub for auto-deploy
- [ ] **9. Set environment variables** in Vercel dashboard
- [ ] **10. Update Google OAuth redirect URIs** to include your production Vercel URL
- [ ] **11. Test** -- open the Vercel URL, sign in with Google, join the queue
- [ ] **12. Make yourself admin** -- in Supabase SQL Editor: `update players set is_admin = true where name = 'Your Name';`

---

## Cost Summary

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| Supabase | Free (500 MB DB, 2 projects) | $0 |
| Vercel | Hobby (100 GB bandwidth) | $0 |
| Google Cloud (OAuth only) | Free | $0 |
| **Total** | | **$0** |

This setup comfortably handles 6-10 users with no risk of hitting free tier limits.
