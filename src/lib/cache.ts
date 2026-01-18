const CACHE_TTL_HOURS = 24 // Cache for 24 hours

// Check if Supabase is configured
function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

// Lazy import supabase to avoid module-level errors in tests
async function getSupabase() {
  const { supabase } = await import('./supabase')
  return supabase
}

export async function getCached<T>(key: string): Promise<T | null> {
  if (!isSupabaseConfigured()) return null

  try {
    const supabase = await getSupabase()
    const { data, error } = await supabase
      .from('cache')
      .select('data, expires_at')
      .eq('key', key)
      .single()

    if (error || !data) return null

    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      // Delete expired entry
      await supabase.from('cache').delete().eq('key', key)
      return null
    }

    return data.data as T
  } catch {
    return null
  }
}

export async function setCache<T>(key: string, data: T): Promise<void> {
  if (!isSupabaseConfigured()) return

  try {
    const supabase = await getSupabase()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000)

    await supabase
      .from('cache')
      .upsert({
        key,
        data,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'key' })
  } catch (error) {
    console.error('Cache write error:', error)
  }
}

export async function invalidateCache(keyPattern: string): Promise<void> {
  if (!isSupabaseConfigured()) return

  try {
    const supabase = await getSupabase()
    await supabase
      .from('cache')
      .delete()
      .like('key', `${keyPattern}%`)
  } catch (error) {
    console.error('Cache invalidation error:', error)
  }
}

// Helper to create cache keys
export function cacheKey(type: string, ...parts: string[]): string {
  return `${type}:${parts.join(':')}`
}
