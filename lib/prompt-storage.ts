export interface SavedPrompt {
  id: string
  text: string
  name: string
  description?: string
  tags: string[]
  usageCount: number
  createdAt: Date
  lastUsed?: Date
}

export class PromptStorage {
  private static readonly STORAGE_KEY = "ai-generator-saved-prompts"

  static getPrompts(): SavedPrompt[] {
    if (typeof window === "undefined") return []

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return []

      const parsed = JSON.parse(stored)
      return parsed.map((prompt: any) => ({
        ...prompt,
        createdAt: new Date(prompt.createdAt),
        lastUsed: prompt.lastUsed ? new Date(prompt.lastUsed) : undefined,
      }))
    } catch (error) {
      console.error("Error loading saved prompts:", error)
      return []
    }
  }

  static savePrompts(prompts: SavedPrompt[]): void {
    if (typeof window === "undefined") return

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(prompts))
    } catch (error) {
      console.error("Error saving prompts:", error)
    }
  }

  static addPrompt(prompt: Omit<SavedPrompt, "id" | "createdAt" | "usageCount">): SavedPrompt {
    const newPrompt: SavedPrompt = {
      ...prompt,
      id: `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      usageCount: 0,
    }

    const prompts = this.getPrompts()
    prompts.unshift(newPrompt)
    this.savePrompts(prompts)

    return newPrompt
  }

  static updatePrompt(id: string, updates: Partial<SavedPrompt>): void {
    const prompts = this.getPrompts()
    const index = prompts.findIndex((p) => p.id === id)

    if (index !== -1) {
      prompts[index] = { ...prompts[index], ...updates }
      this.savePrompts(prompts)
    }
  }

  static deletePrompt(id: string): void {
    const prompts = this.getPrompts()
    const filtered = prompts.filter((p) => p.id !== id)
    this.savePrompts(filtered)
  }

  static usePrompt(id: string): void {
    const prompts = this.getPrompts()
    const index = prompts.findIndex((p) => p.id === id)

    if (index !== -1) {
      prompts[index].usageCount += 1
      prompts[index].lastUsed = new Date()
      this.savePrompts(prompts)
    }
  }

  static searchPrompts(query: string): SavedPrompt[] {
    const prompts = this.getPrompts()
    const lowercaseQuery = query.toLowerCase()

    return prompts.filter(
      (prompt) =>
        prompt.name.toLowerCase().includes(lowercaseQuery) ||
        prompt.text.toLowerCase().includes(lowercaseQuery) ||
        prompt.description?.toLowerCase().includes(lowercaseQuery) ||
        prompt.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery)),
    )
  }
}
