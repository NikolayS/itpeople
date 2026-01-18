import { describe, test, expect } from 'bun:test'
import { calculateScore, calculateScoreComponents, formatScoreBreakdown } from '../lib/scoring'
import type { Candidate } from '../types/candidate'

describe('calculateScore', () => {
  test('returns 0 for empty candidate', () => {
    const score = calculateScore({})
    expect(score).toBe(0)
  })

  test('calculates score correctly for full candidate', () => {
    const candidate: Partial<Candidate> = {
      public_repos: 30,
      total_commits: 500,
      total_stars: 150,
      followers: 200,
      last_activity_at: new Date().toISOString(), // recent activity
    }
    const score = calculateScore(candidate)
    // Should have high scores in all categories
    expect(score).toBeGreaterThan(50)
    expect(score).toBeLessThanOrEqual(100)
  })

  test('weights all components at 25%', () => {
    // Candidate with only high repos
    const repoOnlyCandidate: Partial<Candidate> = {
      public_repos: 100, // max contribution score
    }
    const repoScore = calculateScore(repoOnlyCandidate)

    // Should be approximately 25% (only contribution volume counts)
    expect(repoScore).toBeLessThan(30) // 25% of max + some variance
  })
})

describe('calculateScoreComponents', () => {
  describe('contributionVolume', () => {
    test('returns 0 for no repos', () => {
      const components = calculateScoreComponents({})
      expect(components.contributionVolume).toBe(0)
    })

    test('caps at 50 repos', () => {
      const comp1 = calculateScoreComponents({ public_repos: 50 })
      const comp2 = calculateScoreComponents({ public_repos: 100 })
      expect(comp1.contributionVolume).toBe(comp2.contributionVolume)
    })
  })

  describe('projectQuality', () => {
    test('returns 0 for no stars', () => {
      const components = calculateScoreComponents({ total_stars: 0 })
      expect(components.projectQuality).toBe(0)
    })

    test('returns 20 for < 10 stars', () => {
      const components = calculateScoreComponents({ total_stars: 5 })
      expect(components.projectQuality).toBe(20)
    })

    test('returns 40 for 10-49 stars', () => {
      const components = calculateScoreComponents({ total_stars: 25 })
      expect(components.projectQuality).toBe(40)
    })

    test('returns 60 for 50-99 stars', () => {
      const components = calculateScoreComponents({ total_stars: 75 })
      expect(components.projectQuality).toBe(60)
    })

    test('returns 80 for 100-499 stars', () => {
      const components = calculateScoreComponents({ total_stars: 250 })
      expect(components.projectQuality).toBe(80)
    })

    test('returns 100 for 500+ stars', () => {
      const components = calculateScoreComponents({ total_stars: 1000 })
      expect(components.projectQuality).toBe(100)
    })
  })

  describe('recency', () => {
    test('returns 0 for no last activity', () => {
      const components = calculateScoreComponents({})
      expect(components.recency).toBe(0)
    })

    test('returns 100 for activity within last month', () => {
      const components = calculateScoreComponents({
        last_activity_at: new Date().toISOString(),
      })
      expect(components.recency).toBe(100)
    })

    test('returns 80 for activity 1-3 months ago', () => {
      const twoMonthsAgo = new Date()
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)
      const components = calculateScoreComponents({
        last_activity_at: twoMonthsAgo.toISOString(),
      })
      expect(components.recency).toBe(80)
    })

    test('returns 60 for activity 3-6 months ago', () => {
      const fourMonthsAgo = new Date()
      fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4)
      const components = calculateScoreComponents({
        last_activity_at: fourMonthsAgo.toISOString(),
      })
      expect(components.recency).toBe(60)
    })

    test('returns 40 for activity 6-12 months ago', () => {
      const nineMonthsAgo = new Date()
      nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9)
      const components = calculateScoreComponents({
        last_activity_at: nineMonthsAgo.toISOString(),
      })
      expect(components.recency).toBe(40)
    })

    test('returns 20 for activity over 12 months ago', () => {
      const twoYearsAgo = new Date()
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
      const components = calculateScoreComponents({
        last_activity_at: twoYearsAgo.toISOString(),
      })
      expect(components.recency).toBe(20)
    })
  })

  describe('reputation', () => {
    test('returns 0 for no followers', () => {
      const components = calculateScoreComponents({})
      expect(components.reputation).toBe(0)
    })

    test('scores based on follower count tiers', () => {
      expect(calculateScoreComponents({ followers: 5 }).reputation).toBe(10)
      expect(calculateScoreComponents({ followers: 30 }).reputation).toBe(25)
      expect(calculateScoreComponents({ followers: 75 }).reputation).toBe(40)
      expect(calculateScoreComponents({ followers: 250 }).reputation).toBe(60)
      expect(calculateScoreComponents({ followers: 750 }).reputation).toBe(80)
      expect(calculateScoreComponents({ followers: 2000 }).reputation).toBe(100)
    })

    test('blends GitHub and Stack Overflow reputation', () => {
      const withSO = calculateScoreComponents({
        followers: 100, // 60 points (100-499 tier)
        stackoverflow_reputation: 1000, // 60 points (1000-4999 tier)
      })
      // With SO: 60 * 0.6 + 60 * 0.4 = 36 + 24 = 60
      expect(withSO.reputation).toBe(60)

      const withoutSO = calculateScoreComponents({
        followers: 100, // 60 points
      })
      // Without SO: just follower score = 60
      expect(withoutSO.reputation).toBe(60)
    })
  })
})

describe('formatScoreBreakdown', () => {
  test('returns formatted breakdown with details', () => {
    const candidate: Partial<Candidate> = {
      public_repos: 20,
      total_stars: 50,
      followers: 100,
      last_activity_at: new Date().toISOString(),
    }

    const breakdown = formatScoreBreakdown(candidate)

    expect(breakdown.total).toBeGreaterThan(0)
    expect(breakdown.components).toBeDefined()
    expect(breakdown.details).toHaveLength(4)
    expect(breakdown.details[0]).toContain('Contribution Volume')
    expect(breakdown.details[1]).toContain('Project Quality')
    expect(breakdown.details[2]).toContain('Recency')
    expect(breakdown.details[3]).toContain('Reputation')
  })
})
