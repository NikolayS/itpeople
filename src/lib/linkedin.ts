import { spawn } from 'child_process'
import { getCached, setCache, cacheKey } from './cache'

export interface LinkedInProfile {
  name: string
  headline: string | null
  location: string | null
  profileUrl: string
  languages: string[]
  skills: string[]
}

export interface LinkedInSearchResult {
  profiles: LinkedInProfile[]
  error?: string
}

// Search LinkedIn using Claude Code browser automation
export async function searchLinkedIn(
  query: string,
  maxResults: number = 10
): Promise<LinkedInSearchResult> {
  // Check cache first
  const key = cacheKey('linkedin-search', query, String(maxResults))
  const cached = await getCached<LinkedInSearchResult>(key)
  if (cached) return cached

  const prompt = `
Search LinkedIn for: ${query}

Instructions:
1. Go to linkedin.com/search/results/people/
2. Search for people matching: ${query}
3. For up to ${maxResults} results, extract:
   - Full name
   - Headline/title
   - Location
   - Profile URL
   - Languages (if visible)
   - Skills (if visible on card)

Return ONLY a JSON object in this exact format (no other text):
{
  "profiles": [
    {
      "name": "John Doe",
      "headline": "Senior Engineer at Company",
      "location": "Berlin, Germany",
      "profileUrl": "https://linkedin.com/in/johndoe",
      "languages": ["English", "German"],
      "skills": ["Python", "Kubernetes"]
    }
  ]
}

If you encounter login walls or errors, return:
{"profiles": [], "error": "description of issue"}
`

  return new Promise((resolve) => {
    const result: LinkedInSearchResult = { profiles: [] }
    let output = ''
    let errorOutput = ''

    // Spawn claude CLI with chrome flag
    const claude = spawn('claude', ['--chrome', '-p', prompt], {
      timeout: 120000, // 2 minute timeout
      env: { ...process.env },
    })

    claude.stdout.on('data', (data) => {
      output += data.toString()
    })

    claude.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    claude.on('error', (err) => {
      console.error('Failed to spawn claude:', err)
      resolve({ profiles: [], error: `Failed to start Claude: ${err.message}` })
    })

    claude.on('close', async (code) => {
      if (code !== 0) {
        console.error('Claude exited with code:', code, errorOutput)
        resolve({ profiles: [], error: `Claude exited with code ${code}` })
        return
      }

      // Try to parse JSON from output
      try {
        // Find JSON in output (might have other text around it)
        const jsonMatch = output.match(/\{[\s\S]*"profiles"[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          result.profiles = parsed.profiles || []
          result.error = parsed.error

          // Cache successful results
          if (result.profiles.length > 0) {
            await setCache(key, result)
          }
        } else {
          result.error = 'No valid JSON in Claude output'
        }
      } catch (parseErr) {
        console.error('Failed to parse Claude output:', parseErr)
        result.error = 'Failed to parse response'
      }

      resolve(result)
    })
  })
}

// Find LinkedIn profile for a specific person
export async function findLinkedInProfile(
  name: string,
  location?: string | null,
  company?: string | null
): Promise<LinkedInProfile | null> {
  const queryParts = [name]
  if (company) queryParts.push(company)
  if (location) queryParts.push(location)

  const key = cacheKey('linkedin-profile', ...queryParts)
  const cached = await getCached<LinkedInProfile | null>(key)
  if (cached !== null) return cached

  const result = await searchLinkedIn(queryParts.join(' '), 3)

  if (result.profiles.length > 0) {
    // Return the first match (most relevant)
    const profile = result.profiles[0]
    await setCache(key, profile)
    return profile
  }

  // Cache null result
  await setCache(key, null)
  return null
}

// Search LinkedIn with specific filters for language + skills
export async function searchLinkedInWithFilters(
  filters: {
    techSkills?: string[]
    spokenLanguage?: string
    location?: string
    maxResults?: number
  },
  onProgress?: (message: string) => void
): Promise<LinkedInSearchResult> {
  // Build search query for LinkedIn
  const queryParts: string[] = []

  // Add tech skills
  if (filters.techSkills && filters.techSkills.length > 0) {
    queryParts.push(filters.techSkills.join(' '))
    queryParts.push('developer OR engineer OR programmer')
  }

  // Add location hints based on language
  if (filters.spokenLanguage && !filters.location) {
    const languageLocations: Record<string, string> = {
      'Russian': 'Russia OR Ukraine OR Belarus',
      'German': 'Germany OR Austria OR Switzerland',
      'Spanish': 'Spain OR Mexico OR Argentina',
      'French': 'France OR Canada',
      'Portuguese': 'Brazil OR Portugal',
      'Chinese': 'China OR Taiwan',
      'Japanese': 'Japan',
    }
    const locHint = languageLocations[filters.spokenLanguage]
    if (locHint) queryParts.push(locHint)
  } else if (filters.location) {
    queryParts.push(filters.location)
  }

  const query = queryParts.join(' ')
  const maxResults = filters.maxResults || 20

  onProgress?.(`Searching LinkedIn for: ${query}`)

  // Check cache
  const key = cacheKey('linkedin-filtered', query, String(maxResults))
  const cached = await getCached<LinkedInSearchResult>(key)
  if (cached) {
    onProgress?.(`Found ${cached.profiles.length} cached LinkedIn results`)
    return cached
  }

  const prompt = `
Search LinkedIn for people matching these criteria:
- Skills/Keywords: ${filters.techSkills?.join(', ') || 'software developer'}
- Language: ${filters.spokenLanguage || 'any'}
- Location preference: ${filters.location || (filters.spokenLanguage ? `countries where ${filters.spokenLanguage} is spoken` : 'any')}

Instructions:
1. Go to linkedin.com/search/results/people/
2. Use the search box and filters to find: ${query}
3. Apply language filter if available (${filters.spokenLanguage || 'skip'})
4. For up to ${maxResults} results, extract:
   - Full name
   - Headline/title
   - Location
   - Profile URL
   - Languages listed on profile (check profile if needed)
   - Skills visible

Return ONLY a JSON object in this exact format (no other text):
{
  "profiles": [
    {
      "name": "Ivan Petrov",
      "headline": "Senior Ruby Developer",
      "location": "Moscow, Russia",
      "profileUrl": "https://linkedin.com/in/ivanpetrov",
      "languages": ["Russian", "English"],
      "skills": ["Ruby", "Rails", "PostgreSQL"]
    }
  ]
}

Important: Focus on finding developers who speak ${filters.spokenLanguage || 'any language'}.
If you encounter login walls or errors, return:
{"profiles": [], "error": "description of issue"}
`

  return new Promise((resolve) => {
    const result: LinkedInSearchResult = { profiles: [] }
    let output = ''
    let errorOutput = ''

    const claude = spawn('claude', ['--chrome', '-p', prompt], {
      timeout: 180000, // 3 minute timeout for filtered search
      env: { ...process.env },
    })

    claude.stdout.on('data', (data) => {
      output += data.toString()
    })

    claude.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    claude.on('error', (err) => {
      console.error('Failed to spawn claude:', err)
      resolve({ profiles: [], error: `Failed to start Claude: ${err.message}` })
    })

    claude.on('close', async (code) => {
      if (code !== 0) {
        console.error('Claude exited with code:', code, errorOutput)
        resolve({ profiles: [], error: `Claude exited with code ${code}` })
        return
      }

      try {
        const jsonMatch = output.match(/\{[\s\S]*"profiles"[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          result.profiles = parsed.profiles || []
          result.error = parsed.error

          // Filter by language if specified
          if (filters.spokenLanguage && result.profiles.length > 0) {
            result.profiles = result.profiles.filter(p =>
              p.languages.some(lang =>
                lang.toLowerCase().includes(filters.spokenLanguage!.toLowerCase())
              )
            )
          }

          if (result.profiles.length > 0) {
            await setCache(key, result)
          }

          onProgress?.(`Found ${result.profiles.length} matching LinkedIn profiles`)
        } else {
          result.error = 'No valid JSON in Claude output'
        }
      } catch (parseErr) {
        console.error('Failed to parse Claude output:', parseErr)
        result.error = 'Failed to parse response'
      }

      resolve(result)
    })
  })
}

// Try to find GitHub username from LinkedIn profile
export async function findGitHubFromLinkedIn(
  profile: LinkedInProfile,
  onProgress?: (message: string) => void
): Promise<string | null> {
  const key = cacheKey('linkedin-to-github', profile.profileUrl)
  const cached = await getCached<string | null>(key)
  if (cached !== null) return cached

  onProgress?.(`Looking for GitHub account for ${profile.name}...`)

  const prompt = `
Find the GitHub username for this person:
- Name: ${profile.name}
- LinkedIn: ${profile.profileUrl}
- Headline: ${profile.headline || 'N/A'}
- Location: ${profile.location || 'N/A'}
- Skills: ${profile.skills.join(', ')}

Instructions:
1. First check if their LinkedIn profile mentions a GitHub link
2. If not, search GitHub for users matching this name and location
3. Verify the match by comparing skills/bio

Return ONLY a JSON object:
{"github_username": "username"} or {"github_username": null} if not found
`

  return new Promise((resolve) => {
    let output = ''

    const claude = spawn('claude', ['--chrome', '-p', prompt], {
      timeout: 60000,
      env: { ...process.env },
    })

    claude.stdout.on('data', (data) => {
      output += data.toString()
    })

    claude.on('error', () => resolve(null))

    claude.on('close', async (code) => {
      if (code !== 0) {
        resolve(null)
        return
      }

      try {
        const jsonMatch = output.match(/\{[\s\S]*"github_username"[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          const username = parsed.github_username || null
          await setCache(key, username)
          if (username) {
            onProgress?.(`Found GitHub: ${username}`)
          }
          resolve(username)
        } else {
          resolve(null)
        }
      } catch {
        resolve(null)
      }
    })
  })
}

// Enrich a candidate with LinkedIn data
export async function enrichWithLinkedIn(
  name: string | null,
  location: string | null,
  company: string | null
): Promise<{
  linkedin_url: string | null
  linkedinLanguages: string[]
  linkedinSkills: string[]
} | null> {
  if (!name) return null

  try {
    const profile = await findLinkedInProfile(name, location, company)

    if (!profile) return null

    return {
      linkedin_url: profile.profileUrl,
      linkedinLanguages: profile.languages,
      linkedinSkills: profile.skills,
    }
  } catch (error) {
    console.error('LinkedIn enrichment failed:', error)
    return null
  }
}
