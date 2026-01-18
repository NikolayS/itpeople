import { describe, test, expect } from 'bun:test'
import { buildSearchQuery, searchUsers, getUser, getUserRepos, enrichUserData } from '../lib/github'

describe('buildSearchQuery', () => {
  test('builds basic query with type:user', () => {
    const query = buildSearchQuery({})
    expect(query).toBe('type:user')
  })

  test('adds location filter', () => {
    const query = buildSearchQuery({ location: 'Germany' })
    expect(query).toBe('type:user location:"Germany"')
  })

  test('adds language filter', () => {
    const query = buildSearchQuery({ language: 'Python' })
    expect(query).toBe('type:user language:Python')
  })

  test('adds repos filter', () => {
    const query = buildSearchQuery({ repos: '>10' })
    expect(query).toBe('type:user repos:>10')
  })

  test('adds followers filter', () => {
    const query = buildSearchQuery({ followers: '>100' })
    expect(query).toBe('type:user followers:>100')
  })

  test('combines multiple filters', () => {
    const query = buildSearchQuery({
      location: 'Berlin',
      language: 'Ruby',
      followers: '>50',
    })
    expect(query).toBe('type:user location:"Berlin" language:Ruby followers:>50')
  })
})

describe('GitHub API integration', () => {
  // These tests hit the actual GitHub API - they may fail due to rate limits
  // Run with GITHUB_TOKEN env var for higher limits

  test('searchUsers returns results for Python developers', async () => {
    const result = await searchUsers('type:user language:Python location:Germany', 1, 5)
    expect(result.total_count).toBeGreaterThan(0)
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items[0]).toHaveProperty('login')
  })

  test('searchUsers returns results for Ruby developers', async () => {
    const result = await searchUsers('type:user language:Ruby', 1, 5)
    console.log(`Ruby search returned ${result.total_count} total, ${result.items.length} items`)
    expect(result.total_count).toBeGreaterThan(0)
    expect(result.items.length).toBeGreaterThan(0)
  })

  test('searchUsers returns results for JavaScript developers', async () => {
    const result = await searchUsers('type:user language:JavaScript', 1, 5)
    expect(result.total_count).toBeGreaterThan(0)
    expect(result.items.length).toBeGreaterThan(0)
  })

  test('getUser returns user details', async () => {
    const user = await getUser('torvalds')
    expect(user.login).toBe('torvalds')
    expect(user.name).toBeTruthy()
  })

  test('getUserRepos returns repositories', async () => {
    const repos = await getUserRepos('torvalds')
    expect(repos.length).toBeGreaterThan(0)
    expect(repos[0]).toHaveProperty('name')
    expect(repos[0]).toHaveProperty('stargazers_count')
  })

  test('enrichUserData returns enriched data', async () => {
    const enriched = await enrichUserData('torvalds')
    expect(enriched.user.login).toBe('torvalds')
    expect(enriched.repos.length).toBeGreaterThan(0)
    expect(enriched.techSkills.length).toBeGreaterThan(0)
    expect(enriched.totalStars).toBeGreaterThan(0)
  })
})
