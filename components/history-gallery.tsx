"use client"

import { useState, useEffect, useMemo } from "react"
import { HistoryStorage, type HistoryItem } from "@/lib/history-storage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Search,
  Filter,
  ImageIcon,
  Trash2,
  Copy,
  RotateCcw,
  Download,
  Heart,
  HeartOff,
  CheckSquare,
  Square,
  X,
  SortDesc,
  SortAsc,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"

interface HistoryGalleryProps {
  onRemix?: (item: HistoryItem) => void
  onReusePrompt?: (prompt: string) => void
  onCopyPrompt?: (prompt: string) => void
}

export function HistoryGallery({ onRemix, onReusePrompt, onCopyPrompt }: HistoryGalleryProps) {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<"date" | "cost">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [filterBySize, setFilterBySize] = useState<string>("all")
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(12)
  const [copiedPrompts, setCopiedPrompts] = useState<Set<string>>(new Set())

  // Load history items
  useEffect(() => {
    const loadHistory = () => {
      const items = HistoryStorage.getHistory()
      setHistoryItems(items)
    }

    loadHistory()

    // Listen for storage changes
    const handleStorageChange = () => loadHistory()
    window.addEventListener("storage", handleStorageChange)

    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let filtered = historyItems

    // Search filter
    if (searchQuery.trim()) {
      filtered = HistoryStorage.searchHistory(searchQuery)
    }

    // Size filter
    if (filterBySize !== "all") {
      filtered = filtered.filter((item) => {
        const aspectRatio = item.settings.aspectRatio
        return aspectRatio === filterBySize
      })
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0

      if (sortBy === "date") {
        comparison = a.timestamp - b.timestamp
      } else if (sortBy === "cost") {
        comparison = a.cost - b.cost
      }

      return sortOrder === "asc" ? comparison : -comparison
    })

    return filtered
  }, [historyItems, searchQuery, filterBySize, sortBy, sortOrder])

  const totalPages = Math.ceil(filteredAndSortedItems.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = filteredAndSortedItems.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterBySize, sortBy, sortOrder])

  const handleDeleteItem = (id: string) => {
    HistoryStorage.deleteHistoryItem(id)
    setHistoryItems(HistoryStorage.getHistory())
    setSelectedItems((prev) => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
  }

  const handleBulkDelete = () => {
    selectedItems.forEach((id) => {
      HistoryStorage.deleteHistoryItem(id)
    })
    setHistoryItems(HistoryStorage.getHistory())
    setSelectedItems(new Set())
    setShowBulkActions(false)
  }

  const handleToggleSelect = (id: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedItems.size === paginatedItems.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(paginatedItems.map((item) => item.id)))
    }
  }

  const handleDownloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)

      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error("Error downloading image:", error)
    }
  }

  const getImageSizeLabel = (aspectRatio: string) => {
    const sizeMap: Record<string, string> = {
      "1:1": "Square",
      "4:3": "Landscape",
      "3:4": "Portrait",
      "16:9": "Widescreen",
      "9:16": "Vertical",
      "3:2": "Photo",
      "2:3": "Portrait Photo",
      "21:9": "Ultrawide",
      custom: "Custom",
    }
    return sizeMap[aspectRatio] || aspectRatio
  }

  const handleToggleFavorite = (id: string) => {
    const item = historyItems.find((h) => h.id === id)
    if (item) {
      HistoryStorage.updateHistoryItem(id, { favorite: !item.favorite })
      setHistoryItems(HistoryStorage.getHistory())
    }
  }

  const handleCopyPromptClick = async (prompt: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedPrompts((prev) => new Set(prev).add(itemId))
      onCopyPrompt?.(prompt)

      // Clear the copied state after 2 seconds
      setTimeout(() => {
        setCopiedPrompts((prev) => {
          const newSet = new Set(prev)
          newSet.delete(itemId)
          return newSet
        })
      }, 2000)
    } catch (error) {
      console.error("Failed to copy prompt:", error)
    }
  }

  if (historyItems.length === 0) {
    return (
      <div className="text-center py-12">
        <ImageIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No generations yet</h3>
        <p className="text-muted-foreground">Your generated images will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Generation History</h2>
        <div className="text-sm text-muted-foreground">
          {filteredAndSortedItems.length} of {historyItems.length} generations
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Size: {getImageSizeLabel(filterBySize === "all" ? "all" : filterBySize)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuCheckboxItem
                checked={filterBySize === "all"}
                onCheckedChange={(checked) => checked && setFilterBySize("all")}
              >
                All Sizes
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={filterBySize === "1:1"}
                onCheckedChange={(checked) => checked && setFilterBySize("1:1")}
              >
                Square (1:1)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filterBySize === "4:3"}
                onCheckedChange={(checked) => checked && setFilterBySize("4:3")}
              >
                Landscape (4:3)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filterBySize === "3:4"}
                onCheckedChange={(checked) => checked && setFilterBySize("3:4")}
              >
                Portrait (3:4)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filterBySize === "16:9"}
                onCheckedChange={(checked) => checked && setFilterBySize("16:9")}
              >
                Widescreen (16:9)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filterBySize === "custom"}
                onCheckedChange={(checked) => checked && setFilterBySize("custom")}
              >
                Custom Size
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {sortOrder === "desc" ? <SortDesc className="w-4 h-4 mr-2" /> : <SortAsc className="w-4 h-4 mr-2" />}
                {sortBy === "date" ? "Date" : "Cost"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => {
                  setSortBy("date")
                  setSortOrder("desc")
                }}
              >
                Newest First
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSortBy("date")
                  setSortOrder("asc")
                }}
              >
                Oldest First
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setSortBy("cost")
                  setSortOrder("desc")
                }}
              >
                Highest Cost
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSortBy("cost")
                  setSortOrder("asc")
                }}
              >
                Lowest Cost
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {itemsPerPage} per page
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setItemsPerPage(6)}>6 per page</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setItemsPerPage(12)}>12 per page</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setItemsPerPage(24)}>24 per page</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setItemsPerPage(48)}>48 per page</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={() => setShowBulkActions(!showBulkActions)}>
            <CheckSquare className="w-4 h-4 mr-2" />
            Select
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {showBulkActions && (
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {selectedItems.size === paginatedItems.length ? "Deselect All" : "Select All"}
            </Button>
            <span className="text-sm text-muted-foreground">{selectedItems.size} selected</span>
          </div>

          {selectedItems.size > 0 && (
            <div className="flex items-center gap-2">
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowBulkActions(false)
              setSelectedItems(new Set())
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Showing {startIndex + 1}-{Math.min(endIndex, filteredAndSortedItems.length)} of{" "}
            {filteredAndSortedItems.length} results
          </div>
          <div>
            Page {currentPage} of {totalPages}
          </div>
        </div>
      )}

      {/* Masonry Gallery */}
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
        {paginatedItems.map((item) => (
          <div key={item.id} className="break-inside-avoid">
            <div className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
              {/* Selection checkbox */}
              {showBulkActions && (
                <div className="absolute top-3 left-3 z-10">
                  <button
                    onClick={() => handleToggleSelect(item.id)}
                    className="w-6 h-6 bg-background/80 backdrop-blur-sm border border-border rounded flex items-center justify-center hover:bg-background transition-colors"
                  >
                    {selectedItems.has(item.id) ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              )}

              {/* Images */}
              <div className="relative group">
                {item.images.map((image, imageIndex) => (
                  <div key={imageIndex} className="relative">
                    <img
                      src={image.url || "/placeholder.svg"}
                      alt={`Generated image ${imageIndex + 1}`}
                      className="w-full h-auto object-cover"
                      loading="lazy"
                    />

                    {/* Image overlay actions */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDownloadImage(image.url, `generated-${item.id}-${imageIndex + 1}.png`)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>

                      <Button size="sm" variant="secondary" onClick={() => handleToggleFavorite(item.id)}>
                        {item.favorite ? (
                          <Heart className="w-4 h-4 text-red-500 fill-current" />
                        ) : (
                          <HeartOff className="w-4 h-4" />
                        )}
                      </Button>

                      <Button size="sm" variant="destructive" onClick={() => handleDeleteItem(item.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                {/* Prompt */}
                <p className="text-sm text-foreground line-clamp-3 leading-relaxed">{item.prompt}</p>

                {/* Metadata */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{getImageSizeLabel(item.settings.aspectRatio)}</span>
                  <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      console.log("[v0] Remix button clicked for item:", item.id)
                      onRemix?.(item)
                    }}
                    className="flex-1"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Remix
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      console.log("[v0] Reuse prompt button clicked:", item.prompt)
                      onReusePrompt?.(item.prompt)
                    }}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Reuse
                  </Button>

                  <Button size="sm" variant="outline" onClick={() => handleCopyPromptClick(item.prompt, item.id)}>
                    {copiedPrompts.has(item.id) ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = currentPage - 2 + i
              }

              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className="w-8 h-8 p-0"
                >
                  {pageNum}
                </Button>
              )
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {filteredAndSortedItems.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No results found</h3>
          <p className="text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  )
}
