import type { GitHubUser, GitHubRepo, GitHubSearchResult } from '@/types/candidate'
import { getCached, setCache, cacheKey } from './cache'

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

interface EnrichedUserData {
  user: GitHubUser
  repos: GitHubRepo[]
  techSkills: string[]
  totalStars: number
}

export async function enrichUserData(username: string): Promise<EnrichedUserData> {
  // Check cache first
  const key = cacheKey('github-user', username)
  const cached = await getCached<EnrichedUserData>(key)
  if (cached) {
    return cached
  }

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

  const result = { user, repos, techSkills, totalStars }

  // Cache the result
  await setCache(key, result)

  return result
}

export function detectSpokenLanguage(bio: string | null, location?: string | null, name?: string | null): string | null {
  const bioText = bio || ''
  const locationText = location || ''
  const nameText = name || ''

  // First check bio for explicit language mentions and non-Latin characters
  // These are strong signals of spoken language

  // Check for Cyrillic characters in bio or name (strong signal for Russian)
  if (/[\u0400-\u04FF]/.test(bioText) || /[\u0400-\u04FF]/.test(nameText)) {
    return 'Russian'
  }

  // Check for CJK characters in bio
  if (/[\u4e00-\u9fff]/.test(bioText)) {
    return 'Chinese'
  }
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(bioText)) {
    return 'Japanese'
  }
  if (/[\uac00-\ud7af]/.test(bioText)) {
    return 'Korean'
  }

  // Bio-only patterns (explicit language mentions)
  const bioPatterns: Record<string, RegExp[]> = {
    'Russian': [
      /\bрусский\b/i, /\bрусскоговорящий\b/i, /\bиз россии\b/i,
      /\bfrom russia\b/i, /\brussian\b/i, /\bborn in russia\b/i,
      /\bfrom moscow\b/i, /\bfrom ukraine\b/i, /\bfrom belarus\b/i,
      /\bukrainian\b/i, /\bbelarusian\b/i,
    ],
    'German': [/\bdeutsch\b/i, /\bgerman native\b/i, /\bnative german\b/i],
    'Spanish': [/\bespañol\b/i, /\bspanish native\b/i, /\bhablo español\b/i, /\bnative spanish\b/i],
    'French': [/\bfrançais\b/i, /\bfrench native\b/i, /\bnative french\b/i],
    'Portuguese': [/\bportuguês\b/i, /\bportuguese native\b/i, /\bnative portuguese\b/i],
    'Chinese': [/\b中文\b/, /\b普通话\b/, /\bchinese native\b/i],
    'Japanese': [/\b日本語\b/, /\bjapanese native\b/i],
    'Korean': [/\b한국어\b/, /\bkorean native\b/i],
  }

  for (const [language, patterns] of Object.entries(bioPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(bioText)) {
        return language
      }
    }
  }

  // Check Russian surname patterns (indirect detection)
  // Common Russian/Ukrainian/Belarusian surname endings
  if (nameText) {
    const nameParts = nameText.split(/\s+/)
    for (const part of nameParts) {
      const lowerPart = part.toLowerCase()
      // Russian surname endings: -ov, -ev, -in, -yn, -sky, -skiy, -ski, -enko, -ko, -uk, -yuk, -chuk, -ovich, -evich
      if (/(?:ov|ev|ova|eva|in|yn|ina|yna|sky|skiy|ski|skaya|enko|ko|uk|yuk|chuk|ovich|evich|ich|ych)$/i.test(lowerPart)) {
        // Exclude common non-Russian names that might match
        const excludeNames = ['markov', 'ivanov'] // these are too common, could be anyone
        if (lowerPart.length > 4 && !excludeNames.includes(lowerPart)) {
          return 'Russian'
        }
      }
    }
  }

  // Check location for Russian-speaking country origins (secondary signal)
  const russianLocationPatterns = [
    /\brussia\b/i, /\bmoscow\b/i, /\bsaint petersburg\b/i, /\bst\.? petersburg\b/i,
    /\bnovosibirsk\b/i, /\byekaterinburg\b/i, /\bkazan\b/i,
    /\bukraine\b/i, /\bkyiv\b/i, /\bkiev\b/i, /\bkharkiv\b/i, /\bodessa\b/i,
    /\bbelarus\b/i, /\bminsk\b/i,
  ]

  for (const pattern of russianLocationPatterns) {
    if (pattern.test(locationText) || pattern.test(bioText)) {
      return 'Russian'
    }
  }

  return null
}
