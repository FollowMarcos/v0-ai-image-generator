"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { HistoryStorage, type HistoryItem } from "@/lib/history-storage"

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [modelFilter, setModelFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "cost-high" | "cost-low">("newest")
  const [stats, setStats] = useState({
    totalGenerations: 0,
    totalImages: 0,
    totalCost: 0,
    averageCost: 0,
  })

  useEffect(() => {
    const loadHistory = () => {
      const historyData = HistoryStorage.getHistory()
      setHistory(historyData)
      setStats(HistoryStorage.getStats())
    }

    loadHistory()
    // Refresh every 5 seconds to catch new generations
    const interval = setInterval(loadHistory, 5000)
    return () => clearInterval(interval)
  }, [])

  const filteredAndSortedHistory = useMemo(() => {
    let filtered = history

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = HistoryStorage.searchHistory(searchQuery.trim())
    }

    // Apply model filter
    if (modelFilter !== "all") {
      filtered = filtered.filter((item) => item.settings.model === modelFilter)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return b.timestamp - a.timestamp
        case "oldest":
          return a.timestamp - b.timestamp
        case "cost-high":
          return b.cost - a.cost
        case "cost-low":
          return a.cost - b.cost
        default:
          return b.timestamp - a.timestamp
      }
    })

    return filtered
  }, [history, searchQuery, modelFilter, sortBy])

  const handleDeleteItem = (id: string) => {
    if (confirm("Are you sure you want to delete this generation?")) {
      HistoryStorage.deleteHistoryItem(id)
      setHistory(HistoryStorage.getHistory())
      setStats(HistoryStorage.getStats())
    }
  }

  const handleClearHistory = () => {
    if (confirm("Are you sure you want to clear all history? This cannot be undone.")) {
      HistoryStorage.clearHistory()
      setHistory([])
      setStats({ totalGenerations: 0, totalImages: 0, totalCost: 0, averageCost: 0 })
    }
  }

  const downloadImage = async (url: string, prompt: string, index: number) => {
    try {
      let response: Response
      try {
        response = await fetch(url)
      } catch (corsError) {
        response = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`)
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`)
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl

      const urlParts = url.split(".")
      const extension = urlParts.length > 1 ? urlParts[urlParts.length - 1].split("?")[0] : "png"
      const safePrompt = prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "-")
      link.download = `${safePrompt}-${index + 1}.${extension}`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error("Error downloading image:", error)
      alert("Failed to download image. Please try right-clicking and 'Save image as...'")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-balance mb-2 flex items-center gap-3 text-foreground">
              <span className="text-4xl">📚</span>
              Generation History
            </h1>
            <p className="text-lg text-muted-foreground">View and manage your AI image generation history</p>
          </div>
          <Button variant="outline" asChild>
            <a href="/">← Back to Generator</a>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{stats.totalGenerations}</div>
              <div className="text-sm text-muted-foreground">Total Generations</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{stats.totalImages}</div>
              <div className="text-sm text-muted-foreground">Total Images</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">${stats.totalCost.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Total Spent</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">${stats.averageCost.toFixed(3)}</div>
              <div className="text-sm text-muted-foreground">Avg per Generation</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search prompts, models, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={modelFilter} onValueChange={setModelFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Models</SelectItem>
                  <SelectItem value="edit">Image Editing</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="cost-high">Highest Cost</SelectItem>
                  <SelectItem value="cost-low">Lowest Cost</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="destructive" onClick={handleClearHistory}>
                Clear All
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* History Items */}
        <div className="space-y-6">
          {filteredAndSortedHistory.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="text-6xl text-muted-foreground mb-4">📚</div>
                <p className="text-muted-foreground">
                  {searchQuery || modelFilter !== "all" ? "No matching generations found" : "No generations yet"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredAndSortedHistory.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg text-card-foreground mb-2">{item.prompt}</CardTitle>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <Badge variant="secondary">{item.settings.model}</Badge>
                        <Badge variant="outline">{item.settings.aspectRatio}</Badge>
                        <Badge variant="outline">${item.cost.toFixed(3)}</Badge>
                        <Badge variant="outline">{new Date(item.timestamp).toLocaleDateString()}</Badge>
                      </div>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteItem(item.id)}>
                      Delete
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {item.images.map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={image.url || "/placeholder.svg"}
                          alt={`Generated image ${index + 1}`}
                          className="w-full h-auto rounded-lg shadow-md"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <Button
                            onClick={() => downloadImage(image.url, item.prompt, index)}
                            variant="secondary"
                            size="sm"
                          >
                            <span className="mr-2">⬇</span>
                            Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {item.uploadedImages && item.uploadedImages.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-2">Reference Images:</p>
                      <div className="flex flex-wrap gap-2">
                        {item.uploadedImages.map((img, index) => (
                          <Badge key={index} variant="outline">
                            @img{index + 1}: {img.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
