'use client'

import { useState, useEffect } from 'react'
import type { Candidate } from '@/types/candidate'
import { ProfileCard } from './ProfileCard'

const ITEMS_PER_PAGE = 10

interface Props {
  candidates: Candidate[]
  isLoading: boolean
}

export function ResultsTable({ candidates, isLoading }: Props) {
  const [currentPage, setCurrentPage] = useState(1)

  // Reset to first page when candidates change
  useEffect(() => {
    setCurrentPage(1)
  }, [candidates])

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

  const totalPages = Math.ceil(candidates.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedCandidates = candidates.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-gray-600">
          Found {candidates.length} candidates
          {totalPages > 1 && ` (showing ${startIndex + 1}-${Math.min(endIndex, candidates.length)})`}
        </p>
        <button
          onClick={exportToCSV}
          className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          Export CSV
        </button>
      </div>

      <div className="grid gap-4">
        {paginatedCandidates.map((candidate, index) => (
          <ProfileCard key={candidate.github_username || index} candidate={candidate} rank={startIndex + index + 1} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-4">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>

          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => goToPage(page)}
                className={`px-3 py-1 rounded text-sm ${
                  page === currentPage
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
