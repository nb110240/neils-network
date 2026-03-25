"use client"

import { useState } from "react"
import Link from "next/link"
import { Contact, SearchResult } from "@/lib/types"
import { SearchBar } from "@/components/search-bar"
import { ContactCard } from "@/components/contact-card"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Crown, Zap } from "lucide-react"

interface SearchFacets {
  companies?: { name: string; count: number }[]
  health?: { level: string; count: number }[]
}

interface SearchFilters {
  companies?: string[]
  tags?: string[]
  healthLevels?: string[]
}

export default function SearchPage() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [facets, setFacets] = useState<SearchFacets | undefined>()
  const [totalMatches, setTotalMatches] = useState<number | undefined>()
  const [searchMode, setSearchMode] = useState<string | undefined>()

  const handleSearch = async (query: string, filters: SearchFilters) => {
    setIsLoading(true)
    setHasSearched(true)
    setSearchError(null)

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, filters }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        if (response.status === 403 && data.error) {
          setSearchError(data.error)
          setResults([])
          return
        }
        throw new Error("Search failed")
      }

      const data = await response.json()
      setResults(data.results || [])
      setFacets(data.facets)
      setTotalMatches(data.totalMatches)
      setSearchMode(data.searchMode)
    } catch (error) {
      console.error("Search error:", error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-normal tracking-tight">Search</h1>
        <p className="text-muted-foreground mt-1 text-lg">
          Find anyone in your network by name, company, or context.
        </p>
      </div>

      <SearchBar
        onSearch={handleSearch}
        isLoading={isLoading}
        facets={facets}
        totalMatches={totalMatches}
        searchMode={searchMode}
      />

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Skeleton className="h-11 w-11 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && searchError && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center mb-4">
              <Crown className="h-5 w-5 text-amber-600" />
            </div>
            <h3 className="text-lg font-normal mb-1">Search limit reached</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {searchError}
            </p>
            <Button size="sm" asChild className="mt-4 bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 border-0">
              <Link href="/pricing">Upgrade to Pro</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && hasSearched && results.length === 0 && !searchError && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-normal">No results found</h3>
            <p className="text-muted-foreground text-center max-w-sm mt-2">
              Try different keywords or clear your filters.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground font-medium">
              {results.length} result{results.length === 1 ? "" : "s"}
              {totalMatches && totalMatches > results.length ? ` of ${totalMatches}` : ""}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
            {results.map((contact) => (
              <div key={contact.id} className="card-interactive">
                <ContactCard
                  contact={contact as Contact}
                  showSimilarity={contact.similarity !== undefined}
                  similarity={contact.similarity}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasSearched && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-[var(--copper)]/10 flex items-center justify-center mb-4">
              <Zap className="h-6 w-6 text-[var(--copper)]" />
            </div>
            <h3 className="text-xl font-normal">Hybrid search</h3>
            <p className="text-muted-foreground text-center max-w-md mt-2">
              AI-powered search combines keyword matching with semantic understanding.
              Find contacts by name, company, or describe who you&apos;re looking for.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
