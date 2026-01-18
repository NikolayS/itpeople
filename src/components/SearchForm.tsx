'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SearchFilters } from '@/types/candidate'

const TECH_SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'Java', 'C++', 'C#',
  'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'Elixir', 'Haskell',
  'React', 'Vue', 'Angular', 'Node.js', 'Django', 'Rails',
  'Kubernetes', 'Docker', 'AWS', 'PostgreSQL', 'MongoDB',
]

const SPOKEN_LANGUAGES = [
  'English', 'Russian', 'German', 'Spanish', 'French', 'Portuguese',
  'Chinese', 'Japanese', 'Korean', 'Hindi', 'Arabic',
]

interface Props {
  onSearch: (filters: SearchFilters) => void
  isLoading: boolean
  initialFilters?: SearchFilters
  onFiltersChange?: (filters: SearchFilters) => void
}

export function SearchForm({ onSearch, isLoading, initialFilters, onFiltersChange }: Props) {
  const [techSkills, setTechSkills] = useState<string[]>(initialFilters?.techSkills || [])
  const [spokenLanguage, setSpokenLanguage] = useState(initialFilters?.spokenLanguage || '')
  const [strictLanguageFilter, setStrictLanguageFilter] = useState(initialFilters?.strictLanguageFilter || false)
  const [location, setLocation] = useState(initialFilters?.location || '')
  const [minStars, setMinStars] = useState(initialFilters?.minStars?.toString() || '')
  const [minFollowers, setMinFollowers] = useState(initialFilters?.minFollowers?.toString() || '')
  const [recentActivityMonths, setRecentActivityMonths] = useState(initialFilters?.recentActivityMonths?.toString() || '')
  const [enableStackOverflow, setEnableStackOverflow] = useState(initialFilters?.enableStackOverflow ?? false)
  const [enableLinkedIn, setEnableLinkedIn] = useState(initialFilters?.enableLinkedIn ?? false)
  const [maxResults, setMaxResults] = useState(initialFilters?.maxResults?.toString() || '10')

  // Build current filters object
  const buildFilters = useCallback((): SearchFilters => ({
    techSkills: techSkills.length > 0 ? techSkills : undefined,
    spokenLanguage: spokenLanguage || undefined,
    strictLanguageFilter: spokenLanguage ? strictLanguageFilter : undefined,
    location: location || undefined,
    minStars: minStars ? parseInt(minStars) : undefined,
    minFollowers: minFollowers ? parseInt(minFollowers) : undefined,
    recentActivityMonths: recentActivityMonths ? parseInt(recentActivityMonths) : undefined,
    enableStackOverflow: enableStackOverflow || undefined,
    enableLinkedIn: enableLinkedIn || undefined,
    maxResults: maxResults ? parseInt(maxResults) : undefined,
  }), [techSkills, spokenLanguage, strictLanguageFilter, location, minStars, minFollowers, recentActivityMonths, enableStackOverflow, enableLinkedIn, maxResults])

  // Notify parent of filter changes
  useEffect(() => {
    onFiltersChange?.(buildFilters())
  }, [buildFilters, onFiltersChange])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(buildFilters())
  }

  const toggleSkill = (skill: string) => {
    setTechSkills(prev =>
      prev.includes(skill)
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tech Skills
        </label>
        <div className="flex flex-wrap gap-2">
          {TECH_SKILLS.map(skill => (
            <button
              key={skill}
              type="button"
              onClick={() => toggleSkill(skill)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                techSkills.includes(skill)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {skill}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Spoken Language
          </label>
          <select
            value={spokenLanguage}
            onChange={e => setSpokenLanguage(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Any</option>
            {SPOKEN_LANGUAGES.map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
          {spokenLanguage && (
            <label className="flex items-center gap-2 mt-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={strictLanguageFilter}
                onChange={e => setStrictLanguageFilter(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Strict (confirmed match only)</span>
            </label>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="e.g., Germany, Berlin, Europe"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Min Stars
          </label>
          <input
            type="number"
            value={minStars}
            onChange={e => setMinStars(e.target.value)}
            placeholder="0"
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Min Followers
          </label>
          <input
            type="number"
            value={minFollowers}
            onChange={e => setMinFollowers(e.target.value)}
            placeholder="0"
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Active in Last (months)
          </label>
          <select
            value={recentActivityMonths}
            onChange={e => setRecentActivityMonths(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Any time</option>
            <option value="1">1 month</option>
            <option value="3">3 months</option>
            <option value="6">6 months</option>
            <option value="12">12 months</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Results
          </label>
          <select
            value={maxResults}
            onChange={e => setMaxResults(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>

      <div className="border-t pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Integrations
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={enableStackOverflow}
            onChange={e => setEnableStackOverflow(e.target.checked)}
            className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
          />
          <span>Stack Overflow lookup (slower, adds SO reputation)</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 mt-2">
          <input
            type="checkbox"
            checked={enableLinkedIn}
            onChange={e => setEnableLinkedIn(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>LinkedIn lookup (slowest, uses Claude browser automation)</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Searching...' : 'Search'}
      </button>
    </form>
  )
}
