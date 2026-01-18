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
