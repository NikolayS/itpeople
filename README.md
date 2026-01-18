# IT People Finder

A personal web application to discover tech talent by skills, spoken language, and location using GitHub data.

## Setup

1. Install dependencies:
```bash
bun install
```

2. Create `.env.local` with your API keys:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
GITHUB_TOKEN=your_github_token
```

Get a GitHub token from https://github.com/settings/tokens or use `gh auth token` if you have GitHub CLI installed.

3. Run the development server:
```bash
bun dev
```

4. Open http://localhost:3000

## Usage

1. Select tech skills (Python, Ruby, Go, etc.)
2. Optionally filter by:
   - Spoken language (auto-detected from bio/name/location)
   - Location (e.g., "Germany", "Berlin")
   - Minimum stars
   - Minimum followers
   - Recent activity
3. Click Search
4. Export results to CSV if needed

## Testing

```bash
bun test
```

## Tech Stack

- Next.js 16 with App Router
- Bun runtime
- Supabase (PostgreSQL)
- Tailwind CSS
- GitHub API
