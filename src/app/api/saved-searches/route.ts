import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { SearchFilters } from '@/types/candidate'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('saved_searches')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ searches: data })
  } catch (error) {
    console.error('Error fetching saved searches:', error)
    return NextResponse.json(
      { error: 'Failed to fetch saved searches' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, filters }: { name: string; filters: SearchFilters } = await request.json()

    if (!name || !filters) {
      return NextResponse.json(
        { error: 'Name and filters are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('saved_searches')
      .insert({ name, filters })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ search: data })
  } catch (error) {
    console.error('Error saving search:', error)
    return NextResponse.json(
      { error: 'Failed to save search' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Search ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('saved_searches')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting saved search:', error)
    return NextResponse.json(
      { error: 'Failed to delete saved search' },
      { status: 500 }
    )
  }
}
