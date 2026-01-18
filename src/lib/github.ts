import type { GitHubUser, GitHubRepo, GitHubSearchResult } from '@/types/candidate'

const GITHUB_API_BASE = 'https://api.github.com'

async function githubFetch<T>(endpoint: string): Promise<T> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'itpeople-talent-finder',
  }

  // Use token if available for higher rate limits
  const token = process.env.GITHUB_TOKEN
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, { headers })

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export async function searchUsers(query: string, page = 1, perPage = 30): Promise<GitHubSearchResult> {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    per_page: String(perPage),
  })
  return githubFetch<GitHubSearchResult>(`/search/users?${params}`)
}

export async function getUser(username: string): Promise<GitHubUser> {
  return githubFetch<GitHubUser>(`/users/${username}`)
}

export async function getUserRepos(username: string, perPage = 100): Promise<GitHubRepo[]> {
  const params = new URLSearchParams({
    sort: 'updated',
    direction: 'desc',
    per_page: String(perPage),
  })
  return githubFetch<GitHubRepo[]>(`/users/${username}/repos?${params}`)
}

export async function getRepoLanguages(owner: string, repo: string): Promise<Record<string, number>> {
  return githubFetch<Record<string, number>>(`/repos/${owner}/${repo}/languages`)
}

export function buildSearchQuery(filters: {
  location?: string
  language?: string
  repos?: string
  followers?: string
}): string {
  const parts: string[] = ['type:user']

  if (filters.location) {
    parts.push(`location:"${filters.location}"`)
  }
  if (filters.language) {
    parts.push(`language:${filters.language}`)
  }
  if (filters.repos) {
    parts.push(`repos:${filters.repos}`)
  }
  if (filters.followers) {
    parts.push(`followers:${filters.followers}`)
  }

  return parts.join(' ')
}

export async function enrichUserData(username: string): Promise<{
  user: GitHubUser
  repos: GitHubRepo[]
  techSkills: string[]
  totalStars: number
}> {
  const [user, repos] = await Promise.all([
    getUser(username),
    getUserRepos(username),
  ])

  // Extract tech skills from repo languages
  const languageCounts: Record<string, number> = {}
  for (const repo of repos) {
    if (repo.language) {
      languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1
    }
    // Also add topics as potential skills
    for (const topic of repo.topics || []) {
      languageCounts[topic] = (languageCounts[topic] || 0) + 1
    }
  }

  // Sort by frequency and take top skills
  const techSkills = Object.entries(languageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([skill]) => skill)

  // Calculate total stars
  const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0)

  return { user, repos, techSkills, totalStars }
}

export function detectSpokenLanguage(bio: string | null): string | null {
  if (!bio) return null

  // Simple heuristics for language detection based on common patterns
  const bioLower = bio.toLowerCase()

  // Check for explicit language mentions
  const languagePatterns: Record<string, RegExp[]> = {
    'Russian': [/\bрусский\b/i, /\bрусскоговорящий\b/i, /\bиз россии\b/i, /\bмосква\b/i, /\bпетербург\b/i],
    'German': [/\bdeutsch\b/i, /\bgerman\b/i, /\bberlin\b/i, /\bmünchen\b/i],
    'Spanish': [/\bespañol\b/i, /\bspanish\b/i, /\bhablo español\b/i],
    'French': [/\bfrançais\b/i, /\bfrench\b/i],
    'Portuguese': [/\bportuguês\b/i, /\bportuguese\b/i, /\bbrasil\b/i],
    'Chinese': [/\b中文\b/, /\bchinese\b/i, /\b普通话\b/],
    'Japanese': [/\b日本語\b/, /\bjapanese\b/i],
    'Korean': [/\b한국어\b/, /\bkorean\b/i],
  }

  for (const [language, patterns] of Object.entries(languagePatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(bio)) {
        return language
      }
    }
  }

  // Check for Cyrillic characters (likely Russian/Ukrainian)
  if (/[\u0400-\u04FF]/.test(bio)) {
    return 'Russian'
  }

  // Check for CJK characters
  if (/[\u4e00-\u9fff]/.test(bio)) {
    return 'Chinese'
  }
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(bio)) {
    return 'Japanese'
  }
  if (/[\uac00-\ud7af]/.test(bio)) {
    return 'Korean'
  }

  return null
}
