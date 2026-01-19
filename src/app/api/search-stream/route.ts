import { NextRequest } from 'next/server'
import { searchUsers, enrichUserData, detectSpokenLanguage, getUser } from '@/lib/github'
import { enrichWithSOData } from '@/lib/stackoverflow'
import { enrichWithLinkedIn, searchLinkedInWithFilters, findGitHubFromLinkedIn } from '@/lib/linkedin'
import { calculateScore } from '@/lib/scoring'
import { supabase } from '@/lib/supabase'
import type { Candidate, SearchFilters } from '@/types/candidate'

function createProgressStream() {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController<Uint8Array>

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })

  const send = (event: string, data: unknown) => {
    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
  }

  const close = () => {
    controller.close()
  }

  return { stream, send, close }
}

export async function POST(request: NextRequest) {
  const filters: SearchFilters = await request.json()
  const { stream, send, close } = createProgressStream()

  // Process in background
  ;(async () => {
    try {
      send('progress', { stage: 'init', message: 'Starting search...' })

      const maxResults = filters.maxResults || 10

      // LinkedIn-first approach when strict language filter is enabled
      if (filters.strictLanguageFilter && filters.enableLinkedIn && filters.spokenLanguage) {
        send('progress', {
          stage: 'linkedin',
          message: `Searching LinkedIn for ${filters.spokenLanguage}-speaking ${filters.techSkills?.[0] || ''} developers...`
        })

        const linkedInResults = await searchLinkedInWithFilters(
          {
            techSkills: filters.techSkills,
            spokenLanguage: filters.spokenLanguage,
            location: filters.location,
            maxResults: Math.min(maxResults * 2, 30), // Fetch more to account for GitHub matching
          },
          (msg) => send('progress', { stage: 'linkedin', message: msg })
        )

        if (linkedInResults.error) {
          send('progress', {
            stage: 'linkedin',
            message: `LinkedIn search issue: ${linkedInResults.error}. Falling back to GitHub...`
          })
        } else if (linkedInResults.profiles.length > 0) {
          send('progress', {
            stage: 'linkedin',
            message: `Found ${linkedInResults.profiles.length} LinkedIn profiles, finding GitHub accounts...`,
            total: linkedInResults.profiles.length,
            current: 0
          })

          const candidates: Candidate[] = []

          for (let i = 0; i < linkedInResults.profiles.length; i++) {
            if (candidates.length >= maxResults) break

            const liProfile = linkedInResults.profiles[i]

            send('progress', {
              stage: 'github',
              message: `Finding GitHub for ${liProfile.name} (${i + 1}/${linkedInResults.profiles.length})...`,
              total: linkedInResults.profiles.length,
              current: i + 1
            })

            // Try to find GitHub username
            const githubUsername = await findGitHubFromLinkedIn(
              liProfile,
              (msg) => send('progress', { stage: 'github', message: msg })
            )

            if (!githubUsername) {
              send('progress', {
                stage: 'github',
                message: `No GitHub found for ${liProfile.name}, skipping...`
              })
              continue
            }

            try {
              const enriched = await enrichUserData(githubUsername)

              // Verify tech skills match
              if (filters.techSkills && filters.techSkills.length > 0) {
                const hasSkill = filters.techSkills.some(skill =>
                  enriched.techSkills.some(s => s.toLowerCase() === skill.toLowerCase()) ||
                  liProfile.skills.some(s => s.toLowerCase().includes(skill.toLowerCase()))
                )
                if (!hasSkill) continue
              }

              const lastActivity = enriched.repos.length > 0
                ? enriched.repos[0].pushed_at
                : enriched.user.updated_at

              // Merge skills from LinkedIn
              const allTechSkills = [...enriched.techSkills]
              for (const skill of liProfile.skills) {
                if (!allTechSkills.some(s => s.toLowerCase() === skill.toLowerCase())) {
                  allTechSkills.push(skill)
                }
              }

              const candidateData: Partial<Candidate> = {
                github_username: enriched.user.login,
                github_id: enriched.user.id,
                name: enriched.user.name || liProfile.name,
                bio: enriched.user.bio,
                location: enriched.user.location || liProfile.location,
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
                detected_spoken_language: filters.spokenLanguage, // From LinkedIn
                last_activity_at: lastActivity,
                stackoverflow_id: null,
                stackoverflow_reputation: 0,
                linkedin_url: liProfile.profileUrl,
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

              send('candidate', {
                candidate: candidates[candidates.length - 1],
                found: candidates.length,
                target: maxResults
              })

            } catch (err) {
              console.error(`Error enriching ${githubUsername}:`, err)
            }
          }

          if (candidates.length > 0) {
            candidates.sort((a, b) => b.score - a.score)

            await supabase.from('search_history').insert({
              filters,
              result_count: candidates.length,
            })

            send('complete', {
              candidates,
              total: candidates.length,
              query: `LinkedIn: ${filters.spokenLanguage} ${filters.techSkills?.join(' ')}`,
            })

            close()
            return
          }

          send('progress', {
            stage: 'github',
            message: 'No GitHub matches found from LinkedIn, falling back to GitHub search...'
          })
        }
      }

      // Standard GitHub-first search (fallback or when LinkedIn not enabled)
      // Build GitHub search query
      const queryParts: string[] = ['type:user']

      if (filters.location) {
        queryParts.push(`location:"${filters.location}"`)
      }
      if (filters.techSkills && filters.techSkills.length > 0) {
        queryParts.push(`language:${filters.techSkills[0]}`)
      }
      if (filters.minFollowers) {
        queryParts.push(`followers:>=${filters.minFollowers}`)
      }

      const query = queryParts.join(' ')

      let fetchCount = Math.min(maxResults * 2, 100)
      if (filters.strictLanguageFilter && filters.spokenLanguage) {
        fetchCount = 100
      }

      send('progress', { stage: 'github', message: `Searching GitHub for users...` })

      const searchResult = await searchUsers(query, 1, fetchCount)

      send('progress', {
        stage: 'github',
        message: `Found ${searchResult.items.length} GitHub users, enriching profiles...`
      })

      // Additional location-based searches for language targeting
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
          send('progress', {
            stage: 'github',
            message: `Searching ${filters.spokenLanguage}-speaking regions...`
          })

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

      // Combine and deduplicate
      const allUsers = [...searchResult.items]
      for (const user of additionalResults) {
        if (!allUsers.some(u => u.login === user.login)) {
          allUsers.push(user)
        }
      }

      send('progress', {
        stage: 'enrich',
        message: `Processing ${allUsers.length} candidates...`,
        total: allUsers.length,
        current: 0
      })

      const candidates: Candidate[] = []

      for (let i = 0; i < allUsers.length; i++) {
        const user = allUsers[i]

        if (candidates.length >= maxResults) break

        send('progress', {
          stage: 'enrich',
          message: `Enriching ${user.login} (${i + 1}/${allUsers.length})...`,
          total: allUsers.length,
          current: i + 1,
          username: user.login
        })

        try {
          const enriched = await enrichUserData(user.login)
          const detectedLanguage = detectSpokenLanguage(enriched.user.bio, enriched.user.location, enriched.user.name)

          // Check if there's any hint this user might speak the target language
          // Only defer to LinkedIn if there's at least SOME positive signal
          const hasLanguageHint = (targetLang: string): boolean => {
            const locationHints: Record<string, RegExp> = {
              'Russian': /russia|ukraine|belarus|moscow|kyiv|kiev|minsk|st\.?\s*petersburg|novosibirsk/i,
              'German': /germany|austria|switzerland|berlin|munich|vienna|zurich/i,
              'Spanish': /spain|mexico|argentina|colombia|madrid|barcelona|buenos aires/i,
              'French': /france|paris|lyon|montreal|quebec|brussels/i,
              'Portuguese': /brazil|portugal|lisbon|são paulo|rio/i,
              'Chinese': /china|beijing|shanghai|taiwan|hong kong|shenzhen/i,
              'Japanese': /japan|tokyo|osaka|kyoto/i,
            }
            const pattern = locationHints[targetLang]
            if (!pattern) return false

            const location = enriched.user.location || ''
            const bio = enriched.user.bio || ''
            return pattern.test(location) || pattern.test(bio)
          }

          // Only defer to LinkedIn if there's a location/bio hint for the target language
          const deferLanguageCheck = filters.strictLanguageFilter &&
            filters.enableLinkedIn &&
            !detectedLanguage &&
            filters.spokenLanguage &&
            hasLanguageHint(filters.spokenLanguage)

          if (filters.spokenLanguage && !deferLanguageCheck) {
            if (filters.strictLanguageFilter) {
              // Strict mode: must have detected language match
              if (detectedLanguage !== filters.spokenLanguage) {
                continue
              }
            } else {
              // Non-strict: skip only if we detected a DIFFERENT language
              if (detectedLanguage && detectedLanguage !== filters.spokenLanguage) continue
            }
          }

          if (filters.techSkills && filters.techSkills.length > 1) {
            const hasAllSkills = filters.techSkills.every(skill =>
              enriched.techSkills.some(s => s.toLowerCase() === skill.toLowerCase())
            )
            if (!hasAllSkills) continue
          }

          const lastActivity = enriched.repos.length > 0
            ? enriched.repos[0].pushed_at
            : enriched.user.updated_at

          if (filters.recentActivityMonths) {
            const lastActivityDate = new Date(lastActivity)
            const monthsAgo = (Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
            if (monthsAgo > filters.recentActivityMonths) continue
          }

          if (filters.minStars && enriched.totalStars < filters.minStars) continue

          // Stack Overflow enrichment
          let soData: { stackoverflow_id: number | null; stackoverflow_reputation: number; soTechSkills: string[] } | null = null
          if (filters.enableStackOverflow) {
            send('progress', {
              stage: 'stackoverflow',
              message: `Looking up ${user.login} on Stack Overflow...`,
              username: user.login
            })
            try {
              soData = await enrichWithSOData(enriched.user.login, enriched.user.name)
            } catch (soError) {
              console.warn(`SO enrichment failed for ${user.login}:`, soError)
            }
          }

          // LinkedIn enrichment
          let linkedInData: { linkedin_url: string | null; linkedinLanguages: string[]; linkedinSkills: string[] } | null = null
          if (filters.enableLinkedIn) {
            send('progress', {
              stage: 'linkedin',
              message: `Searching LinkedIn for ${enriched.user.name || user.login}... (this may take a moment)`,
              username: user.login
            })
            try {
              linkedInData = await enrichWithLinkedIn(
                enriched.user.name,
                enriched.user.location,
                enriched.user.company
              )
              if (linkedInData?.linkedinLanguages && linkedInData.linkedinLanguages.length > 0) {
                send('progress', {
                  stage: 'linkedin',
                  message: `Found LinkedIn languages: ${linkedInData.linkedinLanguages.join(', ')}`,
                  username: user.login
                })
              }
            } catch (liError) {
              console.warn(`LinkedIn enrichment failed for ${user.login}:`, liError)
            }
          }

          // Deferred language check with LinkedIn data
          if (deferLanguageCheck && filters.spokenLanguage) {
            const linkedInHasLanguage = linkedInData?.linkedinLanguages?.some(
              lang => lang.toLowerCase().includes(filters.spokenLanguage!.toLowerCase())
            )
            if (!linkedInHasLanguage) continue
          }

          // Merge tech skills
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

          // Send intermediate results
          send('candidate', {
            candidate: candidates[candidates.length - 1],
            found: candidates.length,
            target: maxResults
          })

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`Error enriching user ${user.login}: ${errorMessage}`)
        }
      }

      // Sort by score
      candidates.sort((a, b) => b.score - a.score)

      // Save to search history
      await supabase.from('search_history').insert({
        filters,
        result_count: candidates.length,
      })

      send('complete', {
        candidates,
        total: searchResult.total_count,
        query,
      })

    } catch (error) {
      console.error('Search error:', error)
      send('error', { message: 'Search failed' })
    } finally {
      close()
    }
  })()

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
