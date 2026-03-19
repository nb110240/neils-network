"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Plus, X, Loader2 } from "lucide-react"

function getTextColor(bgColor: string): string {
  const hex = bgColor.replace("#", "")
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? "#1c1917" : "#ffffff"
}

interface Tag {
  id: string
  name: string
  color: string
}

interface TagManagerProps {
  contactId: string
  onUpdate?: () => void
}

export function TagManager({ contactId, onUpdate }: TagManagerProps) {
  const [contactTags, setContactTags] = useState<Tag[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState("#78716c")
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const TAG_COLORS = [
    "#78716c", "#ef4444", "#f97316", "#eab308",
    "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899",
  ]

  useEffect(() => {
    fetchData()
  }, [contactId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  async function fetchData() {
    setIsLoading(true)
    try {
      const [tagsRes, contactTagsRes] = await Promise.all([
        fetch("/api/tags"),
        fetch(`/api/contacts/${contactId}/tags`),
      ])
      const tagsData = await tagsRes.json()
      const contactTagsData = await contactTagsRes.json()
      setAllTags(tagsData.tags || [])
      setContactTags(contactTagsData.tags || [])
    } catch (err) {
      console.error("Failed to fetch tags:", err)
    } finally {
      setIsLoading(false)
    }
  }

  async function toggleTag(tagId: string) {
    const isSelected = contactTags.some((t) => t.id === tagId)
    const newTagIds = isSelected
      ? contactTags.filter((t) => t.id !== tagId).map((t) => t.id)
      : [...contactTags.map((t) => t.id), tagId]

    try {
      const res = await fetch(`/api/contacts/${contactId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: newTagIds }),
      })
      const data = await res.json()
      setContactTags(data.tags || [])
      onUpdate?.()
    } catch (err) {
      console.error("Failed to update tags:", err)
    }
  }

  async function createTag() {
    if (!newTagName.trim() || isCreating) return
    setIsCreating(true)
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
      })
      if (res.ok) {
        const data = await res.json()
        setAllTags((prev) => [...prev, data.tag])
        setNewTagName("")
        // Auto-assign the new tag
        await toggleTag(data.tag.id)
      }
    } catch (err) {
      console.error("Failed to create tag:", err)
    } finally {
      setIsCreating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading tags...
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        {contactTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: tag.color, color: getTextColor(tag.color) }}
          >
            {tag.name}
            <button
              onClick={() => toggleTag(tag.id)}
              className="hover:opacity-80 transition-opacity"
              aria-label={`Remove ${tag.name} tag`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        >
          <Plus className="h-3 w-3 mr-1" />
          Tag
        </Button>
      </div>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute top-full left-0 mt-2 z-50 w-64 max-w-[calc(100vw-2rem)] rounded-xl border bg-background shadow-refined-lg p-3 space-y-3"
        >
          {/* Existing tags */}
          {allTags.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {allTags.map((tag) => {
                const isSelected = contactTags.some((t) => t.id === tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm hover:bg-muted/50 transition-colors text-left"
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 truncate">{tag.name}</span>
                    {isSelected && (
                      <span className="text-xs text-[var(--copper)] font-medium">Added</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Divider */}
          {allTags.length > 0 && <div className="border-t" />}

          {/* Create new tag */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Create new tag</p>
            <input
              type="text"
              placeholder="Tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createTag()}
              maxLength={50}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex items-center gap-1.5">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewTagColor(c)}
                  className={`w-5 h-5 rounded-full transition-all ${
                    newTagColor === c ? "ring-2 ring-offset-2 ring-[var(--copper)]" : ""
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
            <Button
              size="sm"
              className="w-full h-7 text-xs"
              onClick={createTag}
              disabled={!newTagName.trim() || isCreating}
            >
              {isCreating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
              Create Tag
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
