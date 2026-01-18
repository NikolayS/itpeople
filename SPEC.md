# IT People Finder - Tech Talent Discovery Tool

## Overview
A personal web application to find tech talent based on:
- **Spoken language** (detected from profile bio)
- **Tech skills** (programming languages, frameworks)
- **Open source activity** (GitHub contributions, repos)
- **Geography** (profile location)

## Tech Stack
- **Frontend/Backend**: Next.js 14+ (App Router) with TypeScript
- **Runtime**: Bun
- **Database**: Supabase (for saving searches, caching results)
- **Styling**: Tailwind CSS

## Data Sources & Integration Methods
1. **GitHub API** (direct) - repos, contributions, profile, languages
2. **Stack Overflow API** (direct) - reputation, tags, answers
3. **LinkedIn** (via Claude Code + Chrome) - profile search, details
4. **Twitter/X** (via Claude Code + Chrome) - tech community presence

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Web App                       │
├─────────────────────────────────────────────────────────┤
│  Search UI                                               │
│  ├── Language filter (e.g., Russian, German, Spanish)   │
│  ├── Tech skills filter (e.g., Python, Kubernetes)      │
│  ├── Geography filter (e.g., Europe, Germany, Berlin)   │
│  └── Activity filters (min stars, recent commits)       │
├─────────────────────────────────────────────────────────┤
│  Results View                                            │
│  ├── Ranked candidate cards                              │
│  ├── Profile links (GitHub, LinkedIn, Twitter, SO)       │
│  ├── Scoring breakdown                                   │
│  └── Export to CSV                                       │
├─────────────────────────────────────────────────────────┤
│  API Routes (Server Actions)                             │
│  ├── /api/search - orchestrates multi-source search     │
│  ├── /api/github - GitHub API integration               │
│  ├── /api/stackoverflow - SO API integration            │
│  └── /api/claude-search - triggers Claude Code agent    │
├─────────────────────────────────────────────────────────┤
│  Claude Code Agent (Docker container)                    │
│  ├── Runs with --chrome flag for browser automation     │
│  ├── LinkedIn profile search and scraping               │
│  ├── Twitter/X profile lookup                           │
│  └── Returns structured JSON results                    │
├─────────────────────────────────────────────────────────┤
│  Supabase                                                │
│  ├── saved_searches - store search parameters           │
│  ├── candidates_cache - cache API results               │
│  └── search_history - track past searches               │
└─────────────────────────────────────────────────────────┘
```

### Claude Code Integration
The tool will spawn Claude Code in a Docker container with `--chrome` flag to:
1. Search LinkedIn for candidates matching criteria
2. Extract profile information (name, headline, location, skills)
3. Search Twitter/X for tech presence
4. Return structured data back to the web app

**Communication method**: CLI invocation
- Web app spawns `claude` CLI with a prompt file
- Claude Code runs search, returns JSON to stdout
- Web app parses and displays results

## Key Features

### 1. Search Filters
- **Tech skills**: Multi-select for languages/frameworks (Python, Go, Rust, K8s, etc.)
- **Spoken language**: Dropdown with common languages + "detect from bio"
- **Geography**: Country/region selector with fuzzy location matching
- **Activity level**: Min stars, recent activity (last 3/6/12 months)

### 2. Scoring Algorithm
Composite score based on:
- **Contribution volume** (25%): commits, PRs, issues
- **Project quality** (25%): stars on owned/contributed repos
- **Recency** (25%): activity in last 6 months
- **Reputation** (25%): followers, SO rep, verified accounts

### 3. Profile Enrichment
- Start with GitHub username
- Cross-reference to find LinkedIn, Twitter, SO profiles
- Display all available profile links in results

### 4. Output
- Sortable/filterable results table
- One-click copy of profile links
- Export to CSV for import to your work system

## Implementation Plan

### Phase 0: Documentation
- [x] Create SPEC.md in project root with full specification
- [x] Push to repo for review

### Phase 0.5: API Keys Setup (via browser automation)
- [x] Create Supabase project, get URL and anon key
- [ ] Get Stack Overflow API key (skipped for MVP)
- [x] Add keys to ~/.zshrc

### Phase 1: Project Setup
- [x] Initialize Next.js project with Bun
- [x] Set up Tailwind CSS
- [x] Configure Supabase connection
- [x] Create database schema
- [x] Set up environment variables for API keys

### Phase 2: GitHub Integration
- [x] Create GitHub API client
- [x] Implement user search by location + language
- [x] Fetch repos and contribution stats
- [x] Detect programming languages from repos
- [x] Parse bio for spoken language hints

### Phase 3: Stack Overflow Integration
- [ ] Create SO API client
- [ ] Search users by tags (tech skills)
- [ ] Fetch reputation and top answers
- [ ] Cross-reference with GitHub (by username/email)

### Phase 4: Search UI
- [x] Build search form with filters
- [x] Create results table component
- [x] Implement scoring display
- [x] Add pagination
- [x] Add export functionality

### Phase 5: Profile Enrichment
- [x] LinkedIn URL discovery (from GitHub bio/website)
- [x] Twitter handle extraction
- [x] Unified profile card display

### Phase 6: Polish
- [ ] Save search feature
- [x] Search history (saved to Supabase)
- [ ] Caching layer for API results
- [x] Loading states and error handling

## Files to Create

```
/app
  /page.tsx              - Main search page
  /api
    /search/route.ts     - Main search endpoint
    /github/route.ts     - GitHub API calls
    /stackoverflow/route.ts - SO API calls
  /components
    /SearchForm.tsx      - Filter inputs
    /ResultsTable.tsx    - Candidate list
    /ProfileCard.tsx     - Individual result
    /ScoreBreakdown.tsx  - Scoring visualization
/lib
  /github.ts             - GitHub API client
  /stackoverflow.ts      - SO API client
  /scoring.ts            - Ranking algorithm
  /language-detect.ts    - Bio language detection
  /supabase.ts          - Database client
/types
  /candidate.ts          - Type definitions
```

## API Rate Limits to Consider
- GitHub: 5,000 requests/hour (authenticated)
- Stack Overflow: 10,000 requests/day
- Twitter: varies by tier
- LinkedIn: no official API, need scraping strategy or manual input

## Decisions Made
- **LinkedIn**: Use Claude Code with `--chrome` for browser automation
- **Twitter/X**: Same - Claude Code browser automation
- **No auth needed**: Personal tool only

## Verification Plan
1. Run `bun dev` and access http://localhost:3000
2. Test search with known GitHub users (e.g., search "Python developers in Germany")
3. Verify scoring produces sensible rankings
4. Test export functionality
5. Verify Supabase saves searches correctly
