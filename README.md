<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/81500182-1f45-4400-8297-4319fde00ac9

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set up Supabase:
   - Create a Supabase project at https://supabase.com
   - Apply the schema from [supabase/schema.sql](supabase/schema.sql) to your database
   - Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in [.env.local](.env.local)
3. Run the app:
   `npm run dev`
