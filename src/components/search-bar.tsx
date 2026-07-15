"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2, X, SlidersHorizontal } from "lucide-react"

interface Facet {
  name?: string
  level?: string
  count: number
}

interface SearchFilters {
  companies?: string[]
  tags?: string[]
  healthLevels?: string[]
}

interface SearchBarProps {
  onSearch: (query: string, filters: SearchFilters) => void
  isLoading?: boolean
  facets?: {
    companies?: Facet[]
    health?: Facet[]
  }
  totalMatches?: number
  searchMode?: string
}

const HEALTH_LABELS: Record<string, string> = {
  green: "Active",
  yellow: "Cooling",
  orange: "Going cold",
  red: "At risk",
}

const HEALTH_COLORS: Record<string, string> = {
  green: "bg-green-100 text-green-700 border-green-200",
  yellow: "bg-yellow-100 text-yellow-700 border-yellow-200",
  orange: "bg-orange-100 text-orange-700 border-orange-200",
  red: "bg-red-100 text-red-700 border-red-200",
}

export function SearchBar({ onSearch, isLoading, facets, totalMatches, searchMode }: SearchBarProps) {
  const [query, setQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())
  const [selectedHealth, setSelectedHealth] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  const activeFilterCount = selectedCompanies.size + selectedHealth.size

  const buildFilters = useCallback((): SearchFilters => {
    const filters: SearchFilters = {}
    if (selectedCompanies.size > 0) filters.companies = [...selectedCompanies]
    if (selectedHealth.size > 0) filters.healthLevels = [...selectedHealth]
    return filters
  }, [selectedCompanies, selectedHealth])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (query.trim()) {
        onSearch(query, buildFilters())
      }
    },
    [query, onSearch, buildFilters]
  )

  // Re-search when filters change (debounced to avoid rapid API calls)
  useEffect(() => {
    if (query.trim() && (selectedCompanies.size > 0 || selectedHealth.size > 0)) {
      const timer = setTimeout(() => {
        onSearch(query, buildFilters())
      }, 300)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanies, selectedHealth])

  function toggleCompany(name: string) {
    setSelectedCompanies((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function toggleHealth(level: string) {
    setSelectedHealth((prev) => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }

  function clearFilters() {
    setSelectedCompanies(new Set())
    setSelectedHealth(new Set())
    if (query.trim()) {
      onSearch(query, {})
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            aria-label="Search contacts"
            placeholder="Search by name, company, or describe who you're looking for..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11 h-12 text-base transition-all focus:shadow-md"
          />
        </div>
        <Button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="h-12 px-6 min-w-[80px] bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 border-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Search"
          )}
        </Button>
      </form>

      {/* Search info + filter toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {searchMode && (
            <span className="text-xs text-muted-foreground">
              {searchMode === "hybrid" ? "Hybrid search (AI + keyword)" : "Keyword search"}
            </span>
          )}
          {totalMatches !== undefined && totalMatches > 0 && (
            <span className="text-xs text-muted-foreground">
              {totalMatches} match{totalMatches !== 1 ? "es" : ""}
            </span>
          )}
        </div>
        {facets && (facets.companies?.length || facets.health?.length) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="text-xs text-muted-foreground h-7"
          >
            <SlidersHorizontal className="h-3 w-3 mr-1.5" />
            Filters
            {activeFilterCount > 0 && (
              <Badge className="ml-1.5 h-4 min-w-4 px-1 text-[10px] bg-[var(--copper)] text-white border-0">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        ) : null}
      </div>

      {/* Active filter pills */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {[...selectedCompanies].map((name) => (
            <button
              key={`c-${name}`}
              onClick={() => toggleCompany(name)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--copper)]/10 text-[var(--copper-text)] text-xs font-medium hover:bg-[var(--copper)]/20 transition-colors"
            >
              {name}
              <X className="h-3 w-3" />
            </button>
          ))}
          {[...selectedHealth].map((level) => (
            <button
              key={`h-${level}`}
              onClick={() => toggleHealth(level)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${HEALTH_COLORS[level] || ""}`}
            >
              {HEALTH_LABELS[level] || level}
              <X className="h-3 w-3" />
            </button>
          ))}
          <button
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Filter panel */}
      {showFilters && facets && (
        <div className="rounded-xl border bg-white dark:bg-stone-900 p-4 space-y-4 animate-fade-in">
          {/* Health filter */}
          {facets.health && facets.health.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Health Status</p>
              <div className="flex flex-wrap gap-2">
                {facets.health.map((f) => {
                  const level = f.level || ""
                  const isActive = selectedHealth.has(level)
                  return (
                    <button
                      key={level}
                      onClick={() => toggleHealth(level)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        isActive
                          ? HEALTH_COLORS[level] || "bg-muted"
                          : "border-stone-200 dark:border-stone-700 text-muted-foreground hover:border-stone-300"
                      }`}
                    >
                      {HEALTH_LABELS[level] || level}
                      <span className="text-[10px] opacity-60">{f.count}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Company filter */}
          {facets.companies && facets.companies.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Company</p>
              <div className="flex flex-wrap gap-2">
                {facets.companies.map((f) => {
                  const name = f.name || ""
                  const isActive = selectedCompanies.has(name)
                  return (
                    <button
                      key={name}
                      onClick={() => toggleCompany(name)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        isActive
                          ? "bg-[var(--copper)]/10 text-[var(--copper-text)] border-[var(--copper)]/30"
                          : "border-stone-200 dark:border-stone-700 text-muted-foreground hover:border-stone-300"
                      }`}
                    >
                      {name}
                      <span className="text-[10px] opacity-60">{f.count}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
