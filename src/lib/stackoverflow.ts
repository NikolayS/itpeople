import type { SOUser, SOUserSearchResult, SOTopTag } from '@/types/candidate'
import { getCached, setCache, cacheKey } from './cache'

const SO_API_BASE = 'https://api.stackexchange.com/2.3'

interface SOResponse<T> {
  items: T[]
  has_more: boolean
  quota_max: number
  quota_remaining: number
}

async function soFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<SOResponse<T>> {
  const searchParams = new URLSearchParams({
    site: 'stackoverflow',
    ...params,
  })

  // Add API key if available (increases quota)
  const apiKey = process.env.STACKOVERFLOW_API_KEY
  if (apiKey) {
    searchParams.set('key', apiKey)
  }

  const response = await fetch(`${SO_API_BASE}${endpoint}?${searchParams}`)

  if (!response.ok) {
    throw new Error(`Stack Overflow API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// Search users by name
export async function searchUsersByName(name: string, page = 1, pageSize = 20): Promise<SOUserSearchResult> {
  const key = cacheKey('so-user-search', name, String(page))
  const cached = await getCached<SOUserSearchResult>(key)
  if (cached) return cached

  const result = await soFetch<SOUser>('/users', {
    inname: name,
    page: String(page),
    pagesize: String(pageSize),
    order: 'desc',
    sort: 'reputation',
  })

  await setCache(key, result)
  return result
}

// Get user by ID
export async function getUser(userId: number): Promise<SOUser | null> {
  const key = cacheKey('so-user', String(userId))
  const cached = await getCached<SOUser>(key)
  if (cached) return cached

  const result = await soFetch<SOUser>(`/users/${userId}`)

  if (result.items.length === 0) return null

  const user = result.items[0]
  await setCache(key, user)
  return user
}

// Get top tags for a user (their tech skills)
export async function getUserTopTags(userId: number): Promise<SOTopTag[]> {
  const key = cacheKey('so-user-tags', String(userId))
  const cached = await getCached<SOTopTag[]>(key)
  if (cached) return cached

  const result = await soFetch<SOTopTag>(`/users/${userId}/top-tags`, {
    pagesize: '20',
  })

  await setCache(key, result.items)
  return result.items
}

// Search for users by tags they're active in
export async function searchUsersByTags(tags: string[], page = 1, pageSize = 20): Promise<SOUserSearchResult> {
  const tagString = tags.join(';')
  const key = cacheKey('so-tag-search', tagString, String(page))
  const cached = await getCached<SOUserSearchResult>(key)
  if (cached) return cached

  // Get top answerers for these tags
  const result = await soFetch<SOUser>(`/tags/${tagString}/top-answerers/all_time`, {
    page: String(page),
    pagesize: String(pageSize),
  })

  await setCache(key, result)
  return result
}

// Try to find a SO user that matches a GitHub user
export async function findSOUserByGitHub(
  githubUsername: string,
  name: string | null
): Promise<SOUser | null> {
  const key = cacheKey('so-github-match', githubUsername)
  const cached = await getCached<SOUser | null>(key)
  if (cached !== null) return cached

  // Strategy 1: Search by display name if available
  if (name) {
    try {
      const result = await searchUsersByName(name, 1, 10)
      for (const user of result.items) {
        // Check if the website_url contains GitHub profile
        if (user.website_url && user.website_url.toLowerCase().includes(`github.com/${githubUsername.toLowerCase()}`)) {
          await setCache(key, user)
          return user
        }
        // Check for close name match with high reputation
        if (user.display_name.toLowerCase() === name.toLowerCase() && user.reputation > 100) {
          await setCache(key, user)
          return user
        }
      }
    } catch (error) {
      console.error('SO search by name failed:', error)
    }
  }

  // Strategy 2: Search by GitHub username as display name
  try {
    const result = await searchUsersByName(githubUsername, 1, 5)
    for (const user of result.items) {
      if (user.website_url && user.website_url.toLowerCase().includes(`github.com/${githubUsername.toLowerCase()}`)) {
        await setCache(key, user)
        return user
      }
    }
  } catch (error) {
    console.error('SO search by username failed:', error)
  }

  // Cache the null result to avoid repeated lookups
  await setCache(key, null)
  return null
}

// Enrich a candidate with SO data
export async function enrichWithSOData(
  githubUsername: string,
  name: string | null
): Promise<{
  stackoverflow_id: number | null
  stackoverflow_reputation: number
  soTechSkills: string[]
} | null> {
  try {
    const soUser = await findSOUserByGitHub(githubUsername, name)

    if (!soUser) {
      return null
    }

    // Get their top tags as tech skills
    const topTags = await getUserTopTags(soUser.user_id)
    const soTechSkills = topTags.slice(0, 10).map(t => t.tag_name)

    return {
      stackoverflow_id: soUser.user_id,
      stackoverflow_reputation: soUser.reputation,
      soTechSkills,
    }
  } catch (error) {
    console.error('SO enrichment failed:', error)
    return null
  }
}
