"use client"

import { useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Search, Loader2 } from "lucide-react"

interface SearchBarProps {
  onSearch: (query: string, semantic: boolean) => void
  isLoading?: boolean
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState("")
  const [semantic, setSemantic] = useState(true)

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (query.trim()) {
        onSearch(query, semantic)
      }
    },
    [query, semantic, onSearch]
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
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
      </div>
      <div className="flex items-center space-x-3">
        <Switch
          id="semantic-search"
          checked={semantic}
          onCheckedChange={setSemantic}
        />
        <Label htmlFor="semantic-search" className="text-sm text-muted-foreground cursor-pointer">
          Smart search (find by meaning, not just keywords)
        </Label>
      </div>
    </form>
  )
}
