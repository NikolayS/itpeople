'use client'

import { useState, useEffect } from 'react'
import type { SearchFilters, SavedSearch } from '@/types/candidate'

interface Props {
  currentFilters: SearchFilters
  onLoadSearch: (filters: SearchFilters) => void
}

export function SavedSearches({ currentFilters, onLoadSearch }: Props) {
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchSearches()
  }, [])

  const fetchSearches = async () => {
    try {
      const response = await fetch('/api/saved-searches')
      const data = await response.json()
      setSearches(data.searches || [])
    } catch (error) {
      console.error('Failed to fetch saved searches:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!saveName.trim()) return

    setIsSaving(true)
    try {
      const response = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saveName, filters: currentFilters }),
      })

      if (response.ok) {
        await fetchSearches()
        setShowSaveModal(false)
        setSaveName('')
      }
    } catch (error) {
      console.error('Failed to save search:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/saved-searches?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setSearches(prev => prev.filter(s => s.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete search:', error)
    }
  }

  const hasFilters = currentFilters.techSkills?.length ||
    currentFilters.spokenLanguage ||
    currentFilters.location ||
    currentFilters.minStars ||
    currentFilters.minFollowers ||
    currentFilters.recentActivityMonths

  return (
    <div className="bg-white p-4 rounded-lg shadow mt-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Saved Searches</h3>
        {hasFilters && (
          <button
            onClick={() => setShowSaveModal(true)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Save current
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : searches.length === 0 ? (
        <p className="text-sm text-gray-500">No saved searches yet</p>
      ) : (
        <ul className="space-y-2">
          {searches.map(search => (
            <li
              key={search.id}
              className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
            >
              <button
                onClick={() => onLoadSearch(search.filters)}
                className="text-left hover:text-blue-600 flex-grow truncate"
                title={formatFilters(search.filters)}
              >
                {search.name}
              </button>
              <button
                onClick={() => handleDelete(search.id)}
                className="ml-2 text-gray-400 hover:text-red-600"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full mx-4">
            <h4 className="text-lg font-medium mb-4">Save Search</h4>
            <input
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Enter a name for this search"
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!saveName.trim() || isSaving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatFilters(filters: SearchFilters): string {
  const parts: string[] = []
  if (filters.techSkills?.length) parts.push(`Skills: ${filters.techSkills.join(', ')}`)
  if (filters.spokenLanguage) parts.push(`Language: ${filters.spokenLanguage}`)
  if (filters.location) parts.push(`Location: ${filters.location}`)
  if (filters.minStars) parts.push(`Min stars: ${filters.minStars}`)
  if (filters.minFollowers) parts.push(`Min followers: ${filters.minFollowers}`)
  return parts.join(' | ') || 'No filters'
}
