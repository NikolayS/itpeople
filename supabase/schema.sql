-- Candidates table: stores discovered tech talent profiles
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_username TEXT UNIQUE,
  github_id BIGINT,
  name TEXT,
  bio TEXT,
  location TEXT,
  company TEXT,
  email TEXT,
  blog TEXT,
  twitter_username TEXT,
  linkedin_url TEXT,
  stackoverflow_id BIGINT,
  avatar_url TEXT,
  public_repos INTEGER DEFAULT 0,
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  total_stars INTEGER DEFAULT 0,
  total_commits INTEGER DEFAULT 0,
  stackoverflow_reputation INTEGER DEFAULT 0,
  detected_spoken_language TEXT,
  tech_skills TEXT[] DEFAULT '{}',
  score NUMERIC(5,2) DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved searches table
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Search history table
CREATE TABLE search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filters JSONB NOT NULL DEFAULT '{}',
  result_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cache table for API results
CREATE TABLE cache (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_cache_expires ON cache(expires_at);

-- Index for faster searches
CREATE INDEX idx_candidates_location ON candidates(location);
CREATE INDEX idx_candidates_tech_skills ON candidates USING GIN(tech_skills);
CREATE INDEX idx_candidates_score ON candidates(score DESC);
CREATE INDEX idx_candidates_github_username ON candidates(github_username);

-- Enable RLS
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

-- Allow public read access (personal tool, no auth needed)
CREATE POLICY "Allow public read" ON candidates FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON candidates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON candidates FOR UPDATE USING (true);

CREATE POLICY "Allow public read" ON saved_searches FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON saved_searches FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete" ON saved_searches FOR DELETE USING (true);

CREATE POLICY "Allow public read" ON search_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON search_history FOR INSERT WITH CHECK (true);

ALTER TABLE cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON cache FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON cache FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON cache FOR DELETE USING (true);
