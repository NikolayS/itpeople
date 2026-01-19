import { NextRequest, NextResponse } from 'next/server'
import { searchUsers, enrichUserData, detectSpokenLanguage } from '@/lib/github'
import { enrichWithSOData } from '@/lib/stackoverflow'
import { enrichWithLinkedIn } from '@/lib/linkedin'
import { calculateScore } from '@/lib/scoring'
import { supabase } from '@/lib/supabase'
import type { Candidate, SearchFilters } from '@/types/candidate'

export async function POST(request: NextRequest) {
  try {
    const filters: SearchFilters = await request.json()

    // Build GitHub search query
    const queryParts: string[] = ['type:user']

    if (filters.location) {
      queryParts.push(`location:"${filters.location}"`)
    }
    if (filters.techSkills && filters.techSkills.length > 0) {
      // Search for users who have repos in these languages
      queryParts.push(`language:${filters.techSkills[0]}`)
    }
    if (filters.minFollowers) {
      queryParts.push(`followers:>=${filters.minFollowers}`)
    }

    const query = queryParts.join(' ')
    const maxResults = filters.maxResults || 10

    // When using strict language filter, we need to fetch more users to find matches
    // Also add location-based queries for better language targeting
    let fetchCount = Math.min(maxResults * 2, 100)
    if (filters.strictLanguageFilter && filters.spokenLanguage) {
      fetchCount = 100 // Fetch max when strict filtering
    }

    // Search GitHub - fetch more than needed to account for filtering
    const searchResult = await searchUsers(query, 1, fetchCount)

    // If strict language filter and we're looking for specific languages,
    // also search with location hints
    const additionalResults: typeof searchResult.items = []
    if (filters.strictLanguageFilter && filters.spokenLanguage && !filters.location) {
      const locationHints: Record<string, string[]> = {
        'Russian': ['Russia', 'Ukraine', 'Belarus', 'Moscow', 'Saint Petersburg', 'Kyiv'],
        'German': ['Germany', 'Austria', 'Switzerland', 'Berlin', 'Munich'],
        'Spanish': ['Spain', 'Mexico', 'Argentina', 'Madrid', 'Barcelona'],
        'French': ['France', 'Paris', 'Lyon', 'Montreal'],
        'Portuguese': ['Brazil', 'Portugal', 'São Paulo', 'Lisbon'],
        'Chinese': ['China', 'Beijing', 'Shanghai', 'Taiwan'],
        'Japanese': ['Japan', 'Tokyo', 'Osaka'],
      }

      const locations = locationHints[filters.spokenLanguage]
      if (locations) {
        // Search with location hints (just the first 2 to avoid too many API calls)
        for (const loc of locations.slice(0, 2)) {
          try {
            const locQuery = `${query} location:"${loc}"`
            const locResult = await searchUsers(locQuery, 1, 30)
            additionalResults.push(...locResult.items)
          } catch (e) {
            console.warn(`Location search failed for ${loc}:`, e)
          }
        }
      }
    }

    // Combine and deduplicate results
    const allUsers = [...searchResult.items]
    for (const user of additionalResults) {
      if (!allUsers.some(u => u.login === user.login)) {
        allUsers.push(user)
      }
    }

    // Enrich each user with detailed data
    const candidates: Candidate[] = []

    console.log(`GitHub search returned ${allUsers.length} users for query: ${query}`)

    for (const user of allUsers) {
      // Stop if we have enough candidates
      if (candidates.length >= maxResults) break
      try {
        const enriched = await enrichUserData(user.login)
        const detectedLanguage = detectSpokenLanguage(enriched.user.bio, enriched.user.location, enriched.user.name)

        console.log(`User ${user.login}: name="${enriched.user.name}", location="${enriched.user.location}", bio="${enriched.user.bio?.substring(0, 50)}...", detected=${detectedLanguage}`)

        // For strict language filter with LinkedIn enabled, we defer the check until after LinkedIn enrichment
        const deferLanguageCheck = filters.strictLanguageFilter && filters.enableLinkedIn && !detectedLanguage

        // Filter by spoken language if specified (unless deferring to LinkedIn)
        if (filters.spokenLanguage && !deferLanguageCheck) {
          if (filters.strictLanguageFilter) {
            // Strict mode: only include users where we detected the exact language match
            if (detectedLanguage !== filters.spokenLanguage) {
              console.log(`  Skipping (strict): detected ${detectedLanguage}, wanted ${filters.spokenLanguage}`)
              continue
            }
          } else {
            // Non-strict mode: include users with matching language OR unknown language
            // Only skip if we detected a DIFFERENT language
            if (detectedLanguage && detectedLanguage !== filters.spokenLanguage) {
              console.log(`  Skipping: detected ${detectedLanguage}, wanted ${filters.spokenLanguage}`)
              continue
            }
          }
        }

        // Filter by tech skills if more than one specified
        if (filters.techSkills && filters.techSkills.length > 1) {
          const hasAllSkills = filters.techSkills.every(skill =>
            enriched.techSkills.some(s => s.toLowerCase() === skill.toLowerCase())
          )
          if (!hasAllSkills) continue
        }

        const lastActivity = enriched.repos.length > 0
          ? enriched.repos[0].pushed_at
          : enriched.user.updated_at

        // Filter by recent activity
        if (filters.recentActivityMonths) {
          const lastActivityDate = new Date(lastActivity)
          const monthsAgo = (Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
          if (monthsAgo > filters.recentActivityMonths) continue
        }

        // Filter by min stars
        if (filters.minStars && enriched.totalStars < filters.minStars) {
          continue
        }

        // Try to enrich with Stack Overflow data (if enabled)
        let soData: { stackoverflow_id: number | null; stackoverflow_reputation: number; soTechSkills: string[] } | null = null
        if (filters.enableStackOverflow) {
          try {
            soData = await enrichWithSOData(enriched.user.login, enriched.user.name)
          } catch (soError) {
            console.warn(`SO enrichment failed for ${user.login}:`, soError)
          }
        }

        // Try to enrich with LinkedIn data (if enabled)
        let linkedInData: { linkedin_url: string | null; linkedinLanguages: string[]; linkedinSkills: string[] } | null = null
        if (filters.enableLinkedIn) {
          try {
            linkedInData = await enrichWithLinkedIn(
              enriched.user.name,
              enriched.user.location,
              enriched.user.company
            )
            // If LinkedIn found languages, update detected language
            if (linkedInData?.linkedinLanguages?.length > 0) {
              // LinkedIn languages are more reliable
              console.log(`  LinkedIn languages for ${user.login}:`, linkedInData.linkedinLanguages)
            }
          } catch (liError) {
            console.warn(`LinkedIn enrichment failed for ${user.login}:`, liError)
          }
        }

        // Deferred language check - now using LinkedIn data if available
        if (deferLanguageCheck && filters.spokenLanguage) {
          const linkedInHasLanguage = linkedInData?.linkedinLanguages?.some(
            lang => lang.toLowerCase().includes(filters.spokenLanguage!.toLowerCase())
          )
          if (!linkedInHasLanguage) {
            console.log(`  Skipping (strict+LinkedIn): no ${filters.spokenLanguage} in LinkedIn languages:`, linkedInData?.linkedinLanguages)
            continue
          }
          console.log(`  Matched via LinkedIn languages: ${linkedInData?.linkedinLanguages}`)
        }

        // Merge tech skills from GitHub, SO, and LinkedIn
        const allTechSkills = [...enriched.techSkills]
        if (soData?.soTechSkills) {
          for (const skill of soData.soTechSkills) {
            if (!allTechSkills.some(s => s.toLowerCase() === skill.toLowerCase())) {
              allTechSkills.push(skill)
            }
          }
        }
        if (linkedInData?.linkedinSkills) {
          for (const skill of linkedInData.linkedinSkills) {
            if (!allTechSkills.some(s => s.toLowerCase() === skill.toLowerCase())) {
              allTechSkills.push(skill)
            }
          }
        }

        const candidateData: Partial<Candidate> = {
          github_username: enriched.user.login,
          github_id: enriched.user.id,
          name: enriched.user.name,
          bio: enriched.user.bio,
          location: enriched.user.location,
          company: enriched.user.company,
          email: enriched.user.email,
          blog: enriched.user.blog,
          twitter_username: enriched.user.twitter_username,
          avatar_url: enriched.user.avatar_url,
          public_repos: enriched.user.public_repos,
          followers: enriched.user.followers,
          following: enriched.user.following,
          total_stars: enriched.totalStars,
          tech_skills: allTechSkills.slice(0, 15),
          detected_spoken_language: detectedLanguage,
          last_activity_at: lastActivity,
          stackoverflow_id: soData?.stackoverflow_id ?? null,
          stackoverflow_reputation: soData?.stackoverflow_reputation ?? 0,
          linkedin_url: linkedInData?.linkedin_url ?? null,
        }

        const score = calculateScore(candidateData)

        candidates.push({
          id: '',
          ...candidateData,
          total_commits: 0,
          score,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Candidate)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`Error enriching user ${user.login}: ${errorMessage}`)
        // If rate limited, include a partial candidate with basic info
        if (errorMessage.includes('403') || errorMessage.includes('rate limit')) {
          console.warn('Rate limited - including basic user info without enrichment')
          candidates.push({
            id: '',
            github_username: user.login,
            github_id: user.id,
            name: null,
            bio: null,
            location: null,
            company: null,
            email: null,
            blog: null,
            twitter_username: null,
            avatar_url: user.avatar_url,
            public_repos: 0,
            followers: 0,
            following: 0,
            total_stars: 0,
            tech_skills: [],
            detected_spoken_language: null,
            last_activity_at: null,
            total_commits: 0,
            stackoverflow_id: null,
            stackoverflow_reputation: 0,
            linkedin_url: null,
            score: 10, // Minimal score for unenriched candidates
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Candidate)
        }
      }
    }

    // Sort by score
    candidates.sort((a, b) => b.score - a.score)

    // Save to search history
    await supabase.from('search_history').insert({
      filters,
      result_count: candidates.length,
    })

    return NextResponse.json({
      candidates,
      total: searchResult.total_count,
      query,
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
