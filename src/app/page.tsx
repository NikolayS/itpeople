'use client'

import { useState, useMemo, useCallback } from 'react'
import { SearchForm } from '@/components/SearchForm'
import { ResultsTable } from '@/components/ResultsTable'
import { SavedSearches } from '@/components/SavedSearches'
import type { Candidate, SearchFilters } from '@/types/candidate'

interface ProgressState {
  stage: string
  message: string
  current?: number
  total?: number
  username?: string
}

export default function Home() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedFilters, setLoadedFilters] = useState<SearchFilters | undefined>()
  const [currentFilters, setCurrentFilters] = useState<SearchFilters>({})
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [foundCount, setFoundCount] = useState(0)

  // Key to reset SearchForm when loading saved search
  const formKey = useMemo(() => JSON.stringify(loadedFilters || {}), [loadedFilters])

  const handleSearch = useCallback(async (filters: SearchFilters) => {
    setIsLoading(true)
    setError(null)
    setHasSearched(true)
    setCandidates([])
    setFoundCount(0)
    setProgress({ stage: 'init', message: 'Starting search...' })

    try {
      const response = await fetch('/api/search-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7)
          } else if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))

            if (eventType === 'progress') {
              setProgress(data)
            } else if (eventType === 'candidate') {
              setFoundCount(data.found)
              setCandidates(prev => {
                const exists = prev.some(c => c.github_username === data.candidate.github_username)
                if (exists) return prev
                return [...prev, data.candidate].sort((a, b) => b.score - a.score)
              })
            } else if (eventType === 'complete') {
              setCandidates(data.candidates)
              setProgress(null)
            } else if (eventType === 'error') {
              setError(data.message)
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setCandidates([])
    } finally {
      setIsLoading(false)
      setProgress(null)
    }
  }, [])

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

            {isLoading && progress && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-800 font-medium">{progress.message}</span>
                      {foundCount > 0 && (
                        <span className="text-blue-600 text-sm">{foundCount} found</span>
                      )}
                    </div>
                    {progress.total && progress.current && (
                      <div className="mt-2">
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(progress.current / progress.total) * 100}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          {progress.current} / {progress.total} users processed
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
