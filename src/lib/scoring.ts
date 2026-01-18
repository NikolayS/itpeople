import type { Candidate } from '@/types/candidate'

interface ScoreComponents {
  contributionVolume: number  // 25%
  projectQuality: number      // 25%
  recency: number             // 25%
  reputation: number          // 25%
}

export function calculateScore(candidate: Partial<Candidate>): number {
  const components = calculateScoreComponents(candidate)

  const weightedScore = (
    components.contributionVolume * 0.25 +
    components.projectQuality * 0.25 +
    components.recency * 0.25 +
    components.reputation * 0.25
  )

  // Return score on 0-100 scale, rounded to 2 decimal places
  return Math.round(weightedScore * 100) / 100
}

export function calculateScoreComponents(candidate: Partial<Candidate>): ScoreComponents {
  return {
    contributionVolume: scoreContributionVolume(candidate),
    projectQuality: scoreProjectQuality(candidate),
    recency: scoreRecency(candidate),
    reputation: scoreReputation(candidate),
  }
}

function scoreContributionVolume(candidate: Partial<Candidate>): number {
  const repos = candidate.public_repos || 0
  const commits = candidate.total_commits || 0

  // Normalize repos (0-50 repos = 0-50 points, max at 50)
  const repoScore = Math.min(repos, 50)

  // Commits are harder to get, so weight them more if available
  const commitScore = commits > 0 ? Math.min(commits / 100, 50) : 0

  return (repoScore + commitScore) / 100 * 100
}

function scoreProjectQuality(candidate: Partial<Candidate>): number {
  const stars = candidate.total_stars || 0

  // Logarithmic scale for stars (diminishing returns after certain thresholds)
  if (stars === 0) return 0
  if (stars < 10) return 20
  if (stars < 50) return 40
  if (stars < 100) return 60
  if (stars < 500) return 80
  return 100
}

function scoreRecency(candidate: Partial<Candidate>): number {
  const lastActivity = candidate.last_activity_at

  if (!lastActivity) return 0

  const lastActivityDate = new Date(lastActivity)
  const now = new Date()
  const monthsAgo = (now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24 * 30)

  // Active in last month = 100, falls off over 12 months
  if (monthsAgo < 1) return 100
  if (monthsAgo < 3) return 80
  if (monthsAgo < 6) return 60
  if (monthsAgo < 12) return 40
  return 20
}

function scoreReputation(candidate: Partial<Candidate>): number {
  const followers = candidate.followers || 0
  const soRep = candidate.stackoverflow_reputation || 0

  // Followers score (logarithmic)
  let followerScore = 0
  if (followers > 0) {
    if (followers < 10) followerScore = 10
    else if (followers < 50) followerScore = 25
    else if (followers < 100) followerScore = 40
    else if (followers < 500) followerScore = 60
    else if (followers < 1000) followerScore = 80
    else followerScore = 100
  }

  // Stack Overflow reputation score
  let soScore = 0
  if (soRep > 0) {
    if (soRep < 100) soScore = 10
    else if (soRep < 500) soScore = 25
    else if (soRep < 1000) soScore = 40
    else if (soRep < 5000) soScore = 60
    else if (soRep < 10000) soScore = 80
    else soScore = 100
  }

  // Weight GitHub followers more since SO integration is optional
  return soRep > 0 ? (followerScore * 0.6 + soScore * 0.4) : followerScore
}

export function formatScoreBreakdown(candidate: Partial<Candidate>): {
  total: number
  components: ScoreComponents
  details: string[]
} {
  const components = calculateScoreComponents(candidate)
  const total = calculateScore(candidate)

  const details = [
    `Contribution Volume: ${Math.round(components.contributionVolume)}% (${candidate.public_repos || 0} repos)`,
    `Project Quality: ${Math.round(components.projectQuality)}% (${candidate.total_stars || 0} stars)`,
    `Recency: ${Math.round(components.recency)}%`,
    `Reputation: ${Math.round(components.reputation)}% (${candidate.followers || 0} followers)`,
  ]

  return { total, components, details }
}
