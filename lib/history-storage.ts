export interface HistoryItem {
  id: string
  prompt: string
  images: Array<{
    url: string
    width?: number
    height?: number
  }>
  settings: {
    model: string
    aspectRatio: string
    imageCount: number
    seed?: number
    enableSafetyChecker: boolean
    syncMode: boolean
    customWidth?: number
    customHeight?: number
  }
  uploadedImages?: Array<{
    name: string
    url: string
  }>
  cost: number
  timestamp: number
  tags: string[]
  folder?: string
  favorite: boolean
  notes?: string
}

export interface HistoryFolder {
  id: string
  name: string
  color: string
  createdAt: number
  itemCount: number
}

const HISTORY_KEY = "ai-generator-history"
const FOLDERS_KEY = "ai-generator-folders"
const MAX_HISTORY_ITEMS = 1000

export class HistoryStorage {
  static getHistory(): HistoryItem[] {
    if (typeof window === "undefined") return []

    try {
      const stored = localStorage.getItem(HISTORY_KEY)
      const history = stored ? JSON.parse(stored) : []

      return history.map((item: any) => ({
        ...item,
        tags: item.tags || [],
        favorite: item.favorite || false,
        folder: item.folder || undefined,
        notes: item.notes || undefined,
      }))
    } catch (error) {
      console.error("Error loading history:", error)
      return []
    }
  }

  static addHistoryItem(item: Omit<HistoryItem, "id" | "timestamp" | "tags" | "favorite">): HistoryItem {
    const historyItem: HistoryItem = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      tags: [],
      favorite: false,
    }

    const history = this.getHistory()
    history.unshift(historyItem) // Add to beginning

    // Keep only the most recent items
    if (history.length > MAX_HISTORY_ITEMS) {
      history.splice(MAX_HISTORY_ITEMS)
    }

    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    } catch (error) {
      console.error("Error saving history:", error)
      // If storage is full, try removing older items
      if (error instanceof DOMException && error.code === 22) {
        const reducedHistory = history.slice(0, Math.floor(MAX_HISTORY_ITEMS / 2))
        localStorage.setItem(HISTORY_KEY, JSON.stringify(reducedHistory))
      }
    }

    return historyItem
  }

  static updateHistoryItem(id: string, updates: Partial<HistoryItem>): void {
    const history = this.getHistory()
    const index = history.findIndex((item) => item.id === id)

    if (index !== -1) {
      history[index] = { ...history[index], ...updates }
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    }
  }

  static deleteHistoryItem(id: string): void {
    const history = this.getHistory().filter((item) => item.id !== id)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  }

  static clearHistory(): void {
    localStorage.removeItem(HISTORY_KEY)
  }

  static searchHistory(query: string): HistoryItem[] {
    const history = this.getHistory()
    const lowerQuery = query.toLowerCase()

    return history.filter(
      (item) =>
        item.prompt.toLowerCase().includes(lowerQuery) ||
        item.settings.model.toLowerCase().includes(lowerQuery) ||
        item.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
        item.notes?.toLowerCase().includes(lowerQuery) ||
        item.folder?.toLowerCase().includes(lowerQuery),
    )
  }

  static filterHistory(filters: {
    model?: string
    dateRange?: { start: number; end: number }
    minCost?: number
    maxCost?: number
    tags?: string[]
    folder?: string
    favorites?: boolean
  }): HistoryItem[] {
    const history = this.getHistory()

    return history.filter((item) => {
      if (filters.model && item.settings.model !== filters.model) return false
      if (filters.dateRange) {
        if (item.timestamp < filters.dateRange.start || item.timestamp > filters.dateRange.end) {
          return false
        }
      }
      if (filters.minCost && item.cost < filters.minCost) return false
      if (filters.maxCost && item.cost > filters.maxCost) return false
      if (filters.tags && filters.tags.length > 0) {
        if (!filters.tags.some((tag) => item.tags.includes(tag))) return false
      }
      if (filters.folder && item.folder !== filters.folder) return false
      if (filters.favorites && !item.favorite) return false
      return true
    })
  }

  static getFolders(): HistoryFolder[] {
    if (typeof window === "undefined") return []

    try {
      const stored = localStorage.getItem(FOLDERS_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error("Error loading folders:", error)
      return []
    }
  }

  static addFolder(name: string, color: string): HistoryFolder {
    const folder: HistoryFolder = {
      id: crypto.randomUUID(),
      name,
      color,
      createdAt: Date.now(),
      itemCount: 0,
    }

    const folders = this.getFolders()
    folders.push(folder)
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))

    return folder
  }

  static updateFolder(id: string, updates: Partial<HistoryFolder>): void {
    const folders = this.getFolders()
    const index = folders.findIndex((folder) => folder.id === id)

    if (index !== -1) {
      folders[index] = { ...folders[index], ...updates }
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
    }
  }

  static deleteFolder(id: string): void {
    const folders = this.getFolders().filter((folder) => folder.id !== id)
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))

    // Remove folder from all history items
    const history = this.getHistory()
    const updatedHistory = history.map((item) => ({
      ...item,
      folder: item.folder === id ? undefined : item.folder,
    }))
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory))
  }

  static getAllTags(): string[] {
    const history = this.getHistory()
    const allTags = history.flatMap((item) => item.tags)
    return [...new Set(allTags)].sort()
  }

  static getStats() {
    const history = this.getHistory()
    const totalCost = history.reduce((sum, item) => sum + item.cost, 0)
    const totalImages = history.reduce((sum, item) => sum + item.images.length, 0)
    const folders = this.getFolders()

    return {
      totalGenerations: history.length,
      totalImages,
      totalCost,
      averageCost: history.length > 0 ? totalCost / history.length : 0,
      totalFavorites: history.filter((item) => item.favorite).length,
      totalFolders: folders.length,
      totalTags: this.getAllTags().length,
    }
  }
}
