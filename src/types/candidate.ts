export interface Candidate {
  id: string
  github_username: string | null
  github_id: number | null
  name: string | null
  bio: string | null
  location: string | null
  company: string | null
  email: string | null
  blog: string | null
  twitter_username: string | null
  linkedin_url: string | null
  stackoverflow_id: number | null
  avatar_url: string | null
  public_repos: number
  followers: number
  following: number
  total_stars: number
  total_commits: number
  stackoverflow_reputation: number
  detected_spoken_language: string | null
  tech_skills: string[]
  score: number
  last_activity_at: string | null
  created_at: string
  updated_at: string
}

export interface SearchFilters {
  techSkills?: string[]
  spokenLanguage?: string
  strictLanguageFilter?: boolean  // If true, only show users with confirmed language match
  location?: string
  minStars?: number
  minFollowers?: number
  recentActivityMonths?: number
  // Integration controls
  enableStackOverflow?: boolean  // Enable SO profile lookup (slower)
  enableLinkedIn?: boolean  // Enable LinkedIn lookup via Claude (slowest)
  // Result limit
  maxResults?: number  // How many results to return (10, 50, 100)
}

export interface SavedSearch {
  id: string
  name: string
  filters: SearchFilters
  created_at: string
}

export interface SearchHistory {
  id: string
  filters: SearchFilters
  result_count: number
  created_at: string
}

export interface GitHubUser {
  login: string
  id: number
  avatar_url: string
  html_url: string
  name: string | null
  company: string | null
  blog: string | null
  location: string | null
  email: string | null
  bio: string | null
  twitter_username: string | null
  public_repos: number
  followers: number
  following: number
  created_at: string
  updated_at: string
}

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  stargazers_count: number
  forks_count: number
  language: string | null
  topics: string[]
  pushed_at: string
  created_at: string
  updated_at: string
}

export interface GitHubSearchResult {
  total_count: number
  incomplete_results: boolean
  items: GitHubUser[]
}

// Stack Overflow types
export interface SOUser {
  user_id: number
  display_name: string
  profile_image: string
  link: string
  reputation: number
  location: string | null
  website_url: string | null
  creation_date: number
  last_access_date: number
  answer_count: number
  question_count: number
  accept_rate?: number
}

export interface SOUserSearchResult {
  items: SOUser[]
  has_more: boolean
  quota_max: number
  quota_remaining: number
}

export interface SOTopTag {
  tag_name: string
  answer_count: number
  answer_score: number
  question_count: number
  question_score: number
}
