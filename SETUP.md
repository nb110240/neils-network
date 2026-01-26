# Neil's Network - Setup Guide

## Overview

Neil's Network is a personal contact management app with AI-powered note extraction and semantic search.

## Quick Start

### 1. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for server-side operations)
- `N8N_WEBHOOK_URL` - Your n8n webhook URL (see below)
- `N8N_WEBHOOK_SECRET` - A secret token for webhook verification
- `OPENAI_API_KEY` - Your OpenAI API key (for semantic search)

### 2. Supabase Setup

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com) and sign in
   - Click "New Project"
   - Name: `neils-network`
   - Generate a strong database password
   - Choose your preferred region
   - Wait for the project to provision

2. **Get API Credentials**
   - Go to Settings > API
   - Copy:
     - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
     - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

3. **Run Database Schema**
   - Go to SQL Editor in Supabase Dashboard
   - Copy the contents of `supabase-schema.sql`
   - Execute the SQL to create tables, indexes, RLS policies, and functions

4. **Configure Authentication**
   - Go to Authentication > Providers
   - Email is enabled by default
   - To enable Google OAuth:
     1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
     2. Add Authorized redirect URIs:
        - `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`
     3. Copy Client ID and Secret to Supabase Auth > Providers > Google

### 3. n8n Workflow Configuration

A workflow has been created: **"Neil's Network - Contact Ingestion"** (ID: `67iGBOfTi9RU56j2`)

**Webhook URLs:**
- Test mode: `https://primary-production-0c8b.up.railway.app/webhook-test/contact-ingestion`
- Production: `https://primary-production-0c8b.up.railway.app/webhook/contact-ingestion`

**Required n8n Setup:**

1. **Set Environment Variable**
   - In n8n, go to Settings > Variables
   - Add: `N8N_WEBHOOK_SECRET` = your chosen secret (same as in `.env.local`)

2. **Configure OpenAI Credentials**
   - In n8n, go to Credentials
   - Add OpenAI API credentials with your API key
   - Connect them to the "Extract Contact Info" and "Generate Embedding" nodes

3. **Configure Supabase Credentials**
   - In n8n, add Supabase credentials:
     - Host: Your Supabase project URL
     - Service Role Key: Your service role key
   - Connect to the "Insert Contact" node

4. **Activate the Workflow**
   - Open the workflow in n8n
   - Toggle "Active" to enable the production webhook

**Copy the production webhook URL to your `.env.local`:**
```
N8N_WEBHOOK_URL=https://primary-production-0c8b.up.railway.app/webhook/contact-ingestion
```

### 4. Run the Application

```bash
# Install dependencies (if not done)
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Architecture

```
┌─────────────────┐     POST      ┌──────────────────┐
│  Next.js App    │ ───────────> │  n8n Webhook     │
│  (localhost)    │              │                  │
│                 │              │  ├─ LLM Extract  │
│  ├─ /login      │              │  ├─ Embeddings   │
│  ├─ /dashboard  │              │  └─ Supabase     │
│  ├─ /search     │ <─────────── │     Insert       │
│  ├─ /contact/id │   Response   │                  │
│  └─ /add        │   (contact)  └──────────────────┘
│                 │
│  Supabase SDK   │ ──────────────> Supabase DB
│  (direct reads) │                 (RLS enabled)
└─────────────────┘
```

## Features

- **AI-Powered Contact Entry**: Write free-form notes, AI extracts structured data
- **Semantic Search**: Find contacts using natural language queries
- **Follow-up Reminders**: Track contacts that need follow-up
- **Secure**: Row-level security ensures users only see their own data
- **Google OAuth**: Easy sign-in with Google account

## Deployment to Vercel

1. Push your code to GitHub
2. Import to Vercel
3. Add environment variables in Vercel dashboard
4. Update n8n webhook if using a custom domain
5. Add your Vercel domain to Supabase Auth redirect URLs

## Troubleshooting

### "Webhook URL not configured"
- Ensure `N8N_WEBHOOK_URL` is set in `.env.local`
- Make sure the n8n workflow is activated

### "Failed to process contact"
- Check n8n execution logs for errors
- Verify OpenAI and Supabase credentials are configured in n8n
- Ensure `N8N_WEBHOOK_SECRET` matches in both places

### "Unauthorized" on protected routes
- Clear browser cookies and sign in again
- Check Supabase auth configuration

### Semantic search not working
- Ensure `OPENAI_API_KEY` is set
- Verify contacts have embeddings (check database)
- The `match_contacts` function must exist in Supabase

## Database Schema

See `supabase-schema.sql` for the complete schema including:
- Contacts table with embedding support
- Row-level security policies
- Semantic search function (`match_contacts`)
- Auto-updating timestamps
