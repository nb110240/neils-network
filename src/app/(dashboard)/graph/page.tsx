"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import * as d3 from "d3"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Crown, ArrowLeft, Network } from "lucide-react"
import Link from "next/link"

interface ContactNode {
  id: string
  name: string
  company: string | null
  health: { level: string; score: number }
  tags: string[]
  event_id: string | null
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  company: string | null
  healthLevel: string
  initials: string
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
  type: string
}

const HEALTH_COLORS: Record<string, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
}

function getInitials(name: string | null): string {
  if (!name) return "?"
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export default function GraphPage() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPro, setIsPro] = useState<boolean | null>(null)
  const [contacts, setContacts] = useState<ContactNode[]>([])

  // Check plan and fetch data
  useEffect(() => {
    async function init() {
      try {
        // Check plan
        const subRes = await fetch("/api/subscription")
        if (subRes.ok) {
          const subData = await subRes.json()
          if (subData.plan === "free") {
            setIsPro(false)
            setIsLoading(false)
            return
          }
        }
        setIsPro(true)

        // Fetch contacts
        const contactsRes = await fetch("/api/contacts")
        const contactsData = await contactsRes.json()
        const contactList = contactsData.contacts || []

        // Fetch tags for each contact
        const enriched: ContactNode[] = await Promise.all(
          contactList.map(async (c: Record<string, unknown>) => {
            let tags: string[] = []
            try {
              const tagRes = await fetch(`/api/contacts/${c.id}/tags`)
              const tagData = await tagRes.json()
              tags = (tagData.tags || []).map((t: { id: string }) => t.id)
            } catch {
              // ignore
            }
            return {
              id: c.id as string,
              name: (c.name as string) || "Unknown",
              company: c.company as string | null,
              health: c.health as { level: string; score: number },
              tags,
              event_id: (c.event_id as string) || null,
            }
          })
        )

        setContacts(enriched)
      } catch (err) {
        console.error("Failed to load graph data:", err)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  // Render D3 graph
  useEffect(() => {
    if (isLoading || !isPro || contacts.length === 0 || !svgRef.current || !containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = Math.max(500, container.clientHeight)

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()
    svg.attr("width", width).attr("height", height)

    // Build nodes
    const nodes: GraphNode[] = contacts.map((c) => ({
      id: c.id,
      name: c.name,
      company: c.company,
      healthLevel: c.health.level,
      initials: getInitials(c.name),
    }))

    // Build links
    const links: GraphLink[] = []
    const nodeIds = new Set(nodes.map((n) => n.id))

    for (let i = 0; i < contacts.length; i++) {
      for (let j = i + 1; j < contacts.length; j++) {
        const a = contacts[i]
        const b = contacts[j]

        // Same tag connection
        const sharedTags = a.tags.filter((t) => b.tags.includes(t))
        if (sharedTags.length > 0) {
          links.push({ source: a.id, target: b.id, type: "tag" })
          continue
        }

        // Same event connection
        if (a.event_id && a.event_id === b.event_id) {
          links.push({ source: a.id, target: b.id, type: "event" })
          continue
        }

        // Same company connection
        if (a.company && b.company && a.company.toLowerCase() === b.company.toLowerCase()) {
          links.push({ source: a.id, target: b.id, type: "company" })
        }
      }
    }

    // Setup zoom
    const g = svg.append("g")
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
      })
    svg.call(zoom)

    // Simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30))

    // Draw links
    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", document.documentElement.classList.contains("dark") ? "#44403c" : "#e7e5e4")
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.6)

    // Draw nodes
    const node = g
      .append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on("drag", (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          })
      )

    // Node circles
    node
      .append("circle")
      .attr("r", 22)
      .attr("fill", (d) => HEALTH_COLORS[d.healthLevel] || "#78716c")
      .attr("stroke", "white")
      .attr("stroke-width", 2)

    // Initials text
    node
      .append("text")
      .text((d) => d.initials)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", "white")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .style("pointer-events", "none")

    // Name labels
    node
      .append("text")
      .text((d) => d.name)
      .attr("dy", 36)
      .attr("text-anchor", "middle")
      .attr("fill", document.documentElement.classList.contains("dark") ? "#fafaf9" : "#1c1917")
      .attr("font-size", "11px")
      .style("pointer-events", "none")

    // Click to navigate
    node.on("click", (_event, d) => {
      router.push(`/contact/${d.id}`)
    })

    // Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x!)
        .attr("y1", (d) => (d.source as GraphNode).y!)
        .attr("x2", (d) => (d.target as GraphNode).x!)
        .attr("y2", (d) => (d.target as GraphNode).y!)

      node.attr("transform", (d) => `translate(${d.x},${d.y})`)
    })

    return () => {
      simulation.stop()
    }
  }, [isLoading, isPro, contacts, router])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    )
  }

  if (isPro === false) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Relationship Graph</h1>
        </div>
        <Card className="shadow-refined">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-[var(--copper)]/10 flex items-center justify-center mb-4">
              <Crown className="h-6 w-6 text-[var(--copper)]" />
            </div>
            <h3 className="text-xl font-normal mb-2">Pro Feature</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
              The relationship graph visualizes connections between your contacts based on shared tags, events, and companies. Upgrade to Pro to unlock it.
            </p>
            <Button asChild className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 border-0">
              <Link href="/pricing">
                <Crown className="mr-2 h-4 w-4" />
                Upgrade to Pro
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relationship Graph</h1>
          <p className="text-muted-foreground">
            {contacts.length} contacts &middot; Click a node to view details
          </p>
        </div>
      </div>

      {contacts.length === 0 ? (
        <Card className="shadow-refined">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-[var(--copper)]/10 flex items-center justify-center mb-4">
              <Network className="h-6 w-6 text-[var(--copper)]" />
            </div>
            <h3 className="text-xl font-normal mb-2">Your network graph</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              Add contacts and tag them to visualize your network. Tags create connections between people — the more you tag, the richer the graph.
            </p>
            <Button
              className="mt-6 bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 shadow-md border-0"
              asChild
            >
              <Link href="/add">Add Your First Contact</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-refined overflow-hidden">
          <div ref={containerRef} className="w-full h-[calc(100vh-8rem)] sm:h-[calc(100vh-12rem)]" style={{ minHeight: 500 }}>
            <svg ref={svgRef} className="w-full h-full" />
          </div>
        </Card>
      )}
    </div>
  )
}
