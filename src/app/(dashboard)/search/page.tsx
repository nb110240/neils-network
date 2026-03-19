"use client"

import { useState } from "react"
import { Contact, SearchResult } from "@/lib/types"
import { SearchBar } from "@/components/search-bar"
import { ContactCard } from "@/components/contact-card"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Search } from "lucide-react"

export default function SearchPage() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async (query: string, semantic: boolean) => {
    setIsLoading(true)
    setHasSearched(true)

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, semantic }),
      })

      if (!response.ok) {
        throw new Error("Search failed")
      }

      const data = await response.json()
      setResults(data.results || [])
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
          Find anyone in your network.
        </p>
      </div>

      <SearchBar onSearch={handleSearch} isLoading={isLoading} />

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

      {!isLoading && hasSearched && results.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-normal">No results found</h3>
            <p className="text-muted-foreground text-center max-w-sm mt-2">
              Try different keywords or turn on smart search.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && results.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground font-medium">
            {results.length} result{results.length === 1 ? "" : "s"}
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {results.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact as Contact}
                showSimilarity={contact.similarity !== undefined}
                similarity={contact.similarity}
              />
            ))}
          </div>
        </div>
      )}

      {!hasSearched && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-normal">Search your network</h3>
            <p className="text-muted-foreground text-center max-w-md mt-2">
              Enter a name, company, or describe who you&apos;re looking for.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
