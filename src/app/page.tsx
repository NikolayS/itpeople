'use client'

import { useState, useMemo } from 'react'
import { SearchForm } from '@/components/SearchForm'
import { ResultsTable } from '@/components/ResultsTable'
import { SavedSearches } from '@/components/SavedSearches'
import type { Candidate, SearchFilters } from '@/types/candidate'

export default function Home() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedFilters, setLoadedFilters] = useState<SearchFilters | undefined>()
  const [currentFilters, setCurrentFilters] = useState<SearchFilters>({})

  // Key to reset SearchForm when loading saved search
  const formKey = useMemo(() => JSON.stringify(loadedFilters || {}), [loadedFilters])

  const handleSearch = async (filters: SearchFilters) => {
    setIsLoading(true)
    setError(null)
    setHasSearched(true)

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      setCandidates(data.candidates)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setCandidates([])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">IT People Finder</h1>
          <p className="mt-1 text-gray-600">
            Discover tech talent by skills, language, and location
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <SearchForm
              key={formKey}
              onSearch={handleSearch}
              isLoading={isLoading}
              initialFilters={loadedFilters}
              onFiltersChange={setCurrentFilters}
            />
            <SavedSearches
              currentFilters={currentFilters}
              onLoadSearch={setLoadedFilters}
            />
          </div>

          <div className="lg:col-span-2">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            {hasSearched ? (
              <ResultsTable candidates={candidates} isLoading={isLoading} />
            ) : (
              <div className="text-center py-12 text-gray-500">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <p className="mt-4 text-lg">
                  Start by selecting tech skills and location to find candidates
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
