import { NextRequest, NextResponse } from 'next/server'
import { searchUsers, enrichUserData, detectSpokenLanguage, buildSearchQuery } from '@/lib/github'
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

    // Search GitHub
    const searchResult = await searchUsers(query, 1, 20)

    // Enrich each user with detailed data
    const candidates: Candidate[] = []

    for (const user of searchResult.items.slice(0, 10)) {
      try {
        const enriched = await enrichUserData(user.login)
        const detectedLanguage = detectSpokenLanguage(enriched.user.bio)

        // Filter by spoken language if specified
        if (filters.spokenLanguage && detectedLanguage !== filters.spokenLanguage) {
          continue
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
          tech_skills: enriched.techSkills,
          detected_spoken_language: detectedLanguage,
          last_activity_at: lastActivity,
        }

        const score = calculateScore(candidateData)

        candidates.push({
          id: '',
          ...candidateData,
          total_commits: 0,
          stackoverflow_id: null,
          stackoverflow_reputation: 0,
          linkedin_url: null,
          score,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Candidate)
      } catch (error) {
        console.error(`Error enriching user ${user.login}:`, error)
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
