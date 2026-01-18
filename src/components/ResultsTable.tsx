'use client'

import type { Candidate } from '@/types/candidate'
import { ProfileCard } from './ProfileCard'

interface Props {
  candidates: Candidate[]
  isLoading: boolean
}

export function ResultsTable({ candidates, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (candidates.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No results found. Try adjusting your search filters.
      </div>
    )
  }

  const exportToCSV = () => {
    const headers = [
      'Name', 'GitHub', 'Location', 'Tech Skills', 'Stars', 'Followers', 'Score',
      'LinkedIn', 'Twitter', 'Email'
    ]

    const rows = candidates.map(c => [
      c.name || '',
      `https://github.com/${c.github_username}`,
      c.location || '',
      (c.tech_skills || []).join('; '),
      c.total_stars.toString(),
      c.followers.toString(),
      c.score.toString(),
      c.linkedin_url || '',
      c.twitter_username ? `https://twitter.com/${c.twitter_username}` : '',
      c.email || '',
    ])

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `itpeople-search-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-gray-600">
          Found {candidates.length} candidates
        </p>
        <button
          onClick={exportToCSV}
          className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          Export CSV
        </button>
      </div>

      <div className="grid gap-4">
        {candidates.map((candidate, index) => (
          <ProfileCard key={candidate.github_username || index} candidate={candidate} rank={index + 1} />
        ))}
      </div>
    </div>
  )
}
