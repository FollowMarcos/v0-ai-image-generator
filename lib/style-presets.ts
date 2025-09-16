export interface StylePreset {
  id: string
  name: string
  description?: string
  settings: {
    model: string
    aspectRatio: string
    seed?: number
    enableSafetyChecker: boolean
    syncMode: boolean
    customWidth?: number
    customHeight?: number
  }
  promptTemplate?: string
  createdAt: Date
  isDefault?: boolean
}

const DEFAULT_PRESETS: StylePreset[] = [
  {
    id: "photorealistic",
    name: "Photorealistic",
    description: "High-quality realistic photos",
    settings: {
      model: "edit",
      aspectRatio: "4:3", // Updated to use new aspect ratio format
      enableSafetyChecker: true,
      syncMode: false,
    },
    promptTemplate: "photorealistic, high quality, detailed, professional photography",
    createdAt: new Date(),
    isDefault: true,
  },
  {
    id: "artistic",
    name: "Artistic",
    description: "Creative and artistic style",
    settings: {
      model: "edit",
      aspectRatio: "1:1", // Updated to use new aspect ratio format
      enableSafetyChecker: true,
      syncMode: false,
    },
    promptTemplate: "artistic, creative, beautiful, masterpiece",
    createdAt: new Date(),
    isDefault: true,
  },
  {
    id: "portrait",
    name: "Portrait",
    description: "Perfect for portrait photography",
    settings: {
      model: "edit",
      aspectRatio: "3:4", // Updated to use new aspect ratio format
      enableSafetyChecker: true,
      syncMode: false,
    },
    promptTemplate: "portrait, professional headshot, studio lighting",
    createdAt: new Date(),
    isDefault: true,
  },
]

export class StylePresetsStorage {
  private static readonly STORAGE_KEY = "ai-generator-style-presets"

  static getPresets(): StylePreset[] {
    if (typeof window === "undefined") return DEFAULT_PRESETS

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) {
        this.savePresets(DEFAULT_PRESETS)
        return DEFAULT_PRESETS
      }

      const parsed = JSON.parse(stored)
      return parsed.map((preset: any) => ({
        ...preset,
        createdAt: new Date(preset.createdAt),
      }))
    } catch (error) {
      console.error("Error loading style presets:", error)
      return DEFAULT_PRESETS
    }
  }

  static savePresets(presets: StylePreset[]): void {
    if (typeof window === "undefined") return

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(presets))
    } catch (error) {
      console.error("Error saving style presets:", error)
    }
  }

  static addPreset(preset: Omit<StylePreset, "id" | "createdAt">): StylePreset {
    const newPreset: StylePreset = {
      ...preset,
      id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    }

    const presets = this.getPresets()
    presets.push(newPreset)
    this.savePresets(presets)

    return newPreset
  }

  static updatePreset(id: string, updates: Partial<StylePreset>): void {
    const presets = this.getPresets()
    const index = presets.findIndex((p) => p.id === id)

    if (index !== -1) {
      presets[index] = { ...presets[index], ...updates }
      this.savePresets(presets)
    }
  }

  static deletePreset(id: string): void {
    const presets = this.getPresets()
    const filtered = presets.filter((p) => p.id !== id && !p.isDefault)
    this.savePresets(filtered)
  }
}
