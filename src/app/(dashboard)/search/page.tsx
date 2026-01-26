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
        <h1 className="text-3xl font-bold tracking-tight">Search Contacts</h1>
        <p className="text-muted-foreground">
          Find contacts using keywords or natural language queries.
        </p>
      </div>

      <SearchBar onSearch={handleSearch} isLoading={isLoading} />

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
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
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No results found</h3>
            <p className="text-muted-foreground text-center max-w-sm mt-2">
              Try a different search term or use semantic search for better results.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && results.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Found {results.length} contact{results.length === 1 ? "" : "s"}
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
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Search your network</h3>
            <p className="text-muted-foreground text-center max-w-sm mt-2">
              Enter a name, company, or describe who you&apos;re looking for.
              Semantic search uses AI to find related contacts.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
