"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { PromptManager } from "@/components/prompt-manager"
import { GenerationSettings } from "@/components/generation-settings"
import { GeneratedImages } from "@/components/generated-images"
import { CostTracker } from "@/components/cost-tracker"
import { StylePresets } from "@/components/style-presets"
import { Button } from "@/components/ui/button"
import { HistoryGallery } from "@/components/history-gallery"
import {
  Settings,
  Palette,
  BookOpen,
  DollarSign,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  X,
  Shield,
  Send as Sync,
  GripVertical,
  Info,
} from "lucide-react"
import type { StylePreset } from "@/lib/style-presets"
import { compressImage, formatFileSize } from "@/lib/image-compression"
import { AuthGuard } from "@/components/auth-guard"
import { HistoryStorage } from "@/lib/history-storage"

interface UploadedImage {
  id: string
  file: File
  url: string
  name: string
}

interface GeneratedImage {
  url: string
  width?: number
  height?: number
}

const aspectRatios = [
  { value: "1:1", label: "Square (1:1) - 2048×2048" },
  { value: "4:3", label: "Landscape (4:3) - 2304×1728" },
  { value: "3:4", label: "Portrait (3:4) - 1728×2304" },
  { value: "16:9", label: "Widescreen (16:9) - 2560×1440" },
  { value: "9:16", label: "Vertical (9:16) - 1440×2560" },
  { value: "3:2", label: "Photo (3:2) - 2496×1664" },
  { value: "2:3", label: "Portrait Photo (2:3) - 1664×2496" },
  { value: "21:9", label: "Ultrawide (21:9) - 3024×1296" },
  { value: "custom", label: "Custom Size" },
]

export default function Home() {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [aspectRatio, setAspectRatio] = useState("1:1")
  const [numImages, setNumImages] = useState(1)
  const [model, setModel] = useState("edit")
  const [prompt, setPrompt] = useState("")

  const [seed, setSeed] = useState<number | undefined>(undefined)
  const [maxImages, setMaxImages] = useState(1)
  const [syncMode, setSyncMode] = useState(false)
  const [enableSafetyChecker, setEnableSafetyChecker] = useState(true)
  const [customWidth, setCustomWidth] = useState<number | undefined>(undefined)
  const [customHeight, setCustomHeight] = useState<number | undefined>(undefined)

  const [showSettings, setShowSettings] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [showPrompts, setShowPrompts] = useState(false)
  const [showCost, setShowCost] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith("image/"))

    if (files.length > 0) {
      const newImages = files.map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        url: URL.createObjectURL(file),
        name: file.name,
      }))
      setUploadedImages((prev) => [...prev, ...newImages].slice(0, 5))
    }
  }, [])

  const removeUploadedImage = (id: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id))
  }

  const uploadImagesToFAL = async (images: UploadedImage[]): Promise<string[]> => {
    const uploadPromises = images.map(async (image) => {
      let fileToProcess = image.file

      if (image.file.size > 2 * 1024 * 1024) {
        console.log(`[v0] Compressing ${image.file.name} (${formatFileSize(image.file.size)})`)
        try {
          fileToProcess = await compressImage(image.file, {
            maxWidth: 1024,
            maxHeight: 1024,
            quality: 0.8,
            maxSizeKB: 2048,
          })
          console.log(`[v0] Compressed to ${formatFileSize(fileToProcess.size)}`)
        } catch (error) {
          console.warn(`[v0] Failed to compress ${image.file.name}, using original:`, error)
          fileToProcess = image.file
        }
      }

      return new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(fileToProcess)
      })
    })

    return Promise.all(uploadPromises)
  }

  const handleApplyPreset = (preset: StylePreset) => {
    console.log("[v0] Applying preset:", preset)
    console.log("[v0] Current settings before:", { model, aspectRatio, seed, enableSafetyChecker, syncMode, prompt })

    if (prompt.trim() === "") {
      setPrompt(preset.promptTemplate)
    } else {
      const styleKeywords = ["style", "art", "painting", "digital", "realistic", "cartoon", "anime"]
      const hasStyleKeywords = styleKeywords.some(
        (keyword) => prompt.toLowerCase().includes(keyword) || preset.promptTemplate.toLowerCase().includes(keyword),
      )

      if (!hasStyleKeywords) {
        setPrompt(`${prompt}, ${preset.promptTemplate}`)
      }
    }

    setModel(preset.settings.model)
    setAspectRatio(preset.settings.aspectRatio)
    setSeed(preset.settings.seed)
    setEnableSafetyChecker(preset.settings.enableSafetyChecker)
    setSyncMode(preset.settings.syncMode)
    setCustomWidth(preset.settings.customWidth)
    setCustomHeight(preset.settings.customHeight)

    console.log("[v0] Settings after applying preset:", {
      prompt: prompt,
      model: preset.settings.model,
      aspectRatio: preset.settings.aspectRatio,
      seed: preset.settings.seed,
      enableSafetyChecker: preset.settings.enableSafetyChecker,
      syncMode: preset.settings.syncMode,
    })
  }

  const handleGenerate = async (promptText: string) => {
    const currentSettings = {
      aspectRatio,
      numImages,
      model,
      seed,
      maxImages,
      syncMode,
      enableSafetyChecker,
      customWidth,
      customHeight,
    }

    console.log("[v0] Preserving settings before generation:", currentSettings)

    setIsGenerating(true)
    setGeneratedImages([])

    try {
      console.log("[v0] Starting generation with:", {
        prompt: promptText,
        model,
        uploadedImages: uploadedImages.length,
      })

      console.log("[v0] CLIENT: Aspect ratio selected:", aspectRatio)
      console.log("[v0] CLIENT: Custom dimensions:", { customWidth, customHeight })

      if (uploadedImages.length === 0) {
        throw new Error("Please upload at least one image for image editing")
      }

      let processedPrompt = promptText
      let imageUrls: string[] = []

      imageUrls = await uploadImagesToFAL(uploadedImages)

      uploadedImages.forEach((_, index) => {
        const reference = `@img${index + 1}`
        // Remove the @img reference entirely since fal API uses image_urls parameter
        processedPrompt = processedPrompt.replace(new RegExp(reference, "g"), "").trim()
      })

      // Clean up any double spaces left from removing references
      processedPrompt = processedPrompt.replace(/\s+/g, " ").trim()

      console.log("[v0] Processed prompt:", processedPrompt)
      console.log("[v0] Image URLs count:", imageUrls.length)

      const effectiveMaxImages = Math.max(numImages, maxImages)

      const payload = {
        prompt: processedPrompt,
        imageUrls,
        aspectRatio,
        numImages,
        model: "edit",
        seed,
        maxImages: effectiveMaxImages,
        syncMode,
        enableSafetyChecker,
        customWidth,
        customHeight,
      }
      console.log("[v0] CLIENT: Sending payload to API:", payload)

      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate images")
      }

      const data = await response.json()
      console.log("[v0] Generation successful:", data)

      if (data.images) {
        data.images.forEach((img: any, index: number) => {
          console.log(`[v0] CLIENT: Generated image ${index + 1} - URL:`, img.url)
          console.log(`[v0] CLIENT: Generated image ${index + 1} - Dimensions:`, img.width, "x", img.height)
          console.log(`[v0] CLIENT: Generated image ${index + 1} - Full object:`, img)
        })
      }

      setGeneratedImages(data.images || [])

      if (data.images && data.images.length > 0) {
        HistoryStorage.addHistoryItem({
          prompt: promptText, // Use original prompt instead of processedPrompt
          images: data.images.map((img: any) => ({
            url: img.url,
            width: img.width,
            height: img.height,
          })),
          settings: {
            model: "edit",
            aspectRatio,
            imageCount: numImages,
            seed,
            enableSafetyChecker,
            syncMode,
            customWidth,
            customHeight,
          },
          uploadedImages: uploadedImages.map((img) => ({
            name: img.name,
            url: img.url,
          })),
          cost: 0.01 * (data.images?.length || 1),
        })
        console.log("[v0] Generation saved to history")
      }
    } catch (error) {
      console.error("Error generating images:", error)

      console.log("[v0] Restoring settings after error:", currentSettings)
      setAspectRatio(currentSettings.aspectRatio)
      setNumImages(currentSettings.numImages)
      setModel(currentSettings.model)
      setSeed(currentSettings.seed)
      setMaxImages(currentSettings.maxImages)
      setSyncMode(currentSettings.syncMode)
      setEnableSafetyChecker(currentSettings.enableSafetyChecker)
      setCustomWidth(currentSettings.customWidth)
      setCustomHeight(currentSettings.customHeight)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCustomSizeChange = (width: number | undefined, height: number | undefined) => {
    setCustomWidth(width)
    setCustomHeight(height)
  }

  const handleRemix = (historyItem: any) => {
    // Set the prompt
    setPrompt(historyItem.prompt)

    // Apply the settings
    setAspectRatio(historyItem.settings.aspectRatio)
    setNumImages(historyItem.settings.imageCount)
    setModel(historyItem.settings.model)
    setSeed(historyItem.settings.seed)
    setEnableSafetyChecker(historyItem.settings.enableSafetyChecker)
    setSyncMode(historyItem.settings.syncMode)
    setCustomWidth(historyItem.settings.customWidth)
    setCustomHeight(historyItem.settings.customHeight)

    // If there were uploaded images, we'd need to recreate them
    // For now, we'll just clear the uploaded images since we can't recreate them from URLs
    setUploadedImages([])

    console.log("[v0] Remixed generation with settings:", historyItem.settings)
  }

  const handleReusePrompt = (prompt: string) => {
    setPrompt(prompt)
    console.log("[v0] Reused prompt:", prompt)
  }

  const handleCopyPrompt = (prompt: string) => {
    console.log("[v0] Copied prompt to clipboard:", prompt)
    // Could add a toast notification here
  }

  const handleImageDragStart = (e: React.DragEvent, index: number) => {
    setDraggedImageIndex(index)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleImageDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleImageDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedImageIndex === null) return

    const newImages = [...uploadedImages]
    const draggedImage = newImages[draggedImageIndex]
    newImages.splice(draggedImageIndex, 1)
    newImages.splice(dropIndex, 0, draggedImage)

    setUploadedImages(newImages)
    setDraggedImageIndex(null)
  }

  const handleImageDragEnd = () => {
    setDraggedImageIndex(null)
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-12 max-w-7xl">
          <div className="space-y-8">
            <div className="prompt-container border border-border rounded-xl overflow-hidden">
              <div
                className={`relative ${isDragOver ? "image-upload-zone drag-over" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    {/* Left side - Uploaded images */}
                    <div className="flex-1">
                      {uploadedImages.length > 0 && (
                        <div className="flex flex-wrap gap-3">
                          {uploadedImages.map((image, index) => (
                            <div
                              key={image.id}
                              className="relative group cursor-move"
                              draggable
                              onDragStart={(e) => handleImageDragStart(e, index)}
                              onDragOver={(e) => handleImageDragOver(e, index)}
                              onDrop={(e) => handleImageDrop(e, index)}
                              onDragEnd={handleImageDragEnd}
                            >
                              <div className="relative">
                                <img
                                  src={image.url || "/placeholder.svg"}
                                  alt={image.name}
                                  className="w-16 h-16 object-cover rounded-lg border-2 border-border"
                                />
                                <div className="absolute -top-2 -left-2 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                                  {index + 1}
                                </div>
                                <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <GripVertical className="w-3 h-3 text-white drop-shadow-lg" />
                                </div>
                                <button
                                  onClick={() => removeUploadedImage(image.id)}
                                  className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {uploadedImages.length > 0 && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Info className="w-3 h-3" />
                          <span>Use @img1, @img2, etc. in your prompt to reference specific images</span>
                        </div>
                      )}
                    </div>

                    {/* Right side - Upload and Generate buttons */}
                    <div className="flex items-center gap-2 ml-4">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || [])
                          const newImages = files.map((file) => ({
                            id: Math.random().toString(36).substr(2, 9),
                            file,
                            url: URL.createObjectURL(file),
                            name: file.name,
                          }))
                          setUploadedImages((prev) => [...prev, ...newImages].slice(0, 5))
                        }}
                        className="hidden"
                        id="image-upload"
                      />
                      <label
                        htmlFor="image-upload"
                        className="cursor-pointer p-2 hover:bg-muted/50 rounded-lg transition-colors"
                      >
                        <ImageIcon className="w-5 h-5 text-muted-foreground" />
                      </label>

                      <Button
                        onClick={() => handleGenerate(prompt)}
                        disabled={!prompt.trim() || isGenerating || uploadedImages.length === 0}
                        className="px-6 py-2 bg-primary hover:bg-primary/90"
                      >
                        {isGenerating ? "Generating..." : "Generate"}
                      </Button>
                    </div>
                  </div>

                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe your image transformation... or drag & drop images here"
                      className="w-full min-h-[120px] p-4 bg-transparent border-0 resize-none focus:outline-none text-lg placeholder:text-muted-foreground"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          if (prompt.trim() && !isGenerating) {
                            handleGenerate(prompt)
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-border bg-muted/20 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-foreground">Size</label>
                      <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                      >
                        {aspectRatios.map((ratio) => (
                          <option key={ratio.value} value={ratio.value}>
                            {ratio.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {aspectRatio === "custom" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1024}
                          max={4096}
                          value={customWidth || 1024}
                          onChange={(e) => setCustomWidth(Number.parseInt(e.target.value))}
                          placeholder="Width"
                          className="w-20 px-2 py-1 bg-background border border-border rounded text-sm font-mono"
                        />
                        <span className="text-muted-foreground">×</span>
                        <input
                          type="number"
                          min={1024}
                          max={4096}
                          value={customHeight || 1024}
                          onChange={(e) => setCustomHeight(Number.parseInt(e.target.value))}
                          placeholder="Height"
                          className="w-20 px-2 py-1 bg-background border border-border rounded text-sm font-mono"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-foreground">Count</label>
                      <select
                        value={numImages}
                        onChange={(e) => setNumImages(Number(e.target.value))}
                        className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-3">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <button
                        onClick={() => setEnableSafetyChecker(!enableSafetyChecker)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          enableSafetyChecker ? "bg-primary" : "bg-muted-foreground/30"
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                            enableSafetyChecker ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <Sync className="w-4 h-4 text-muted-foreground" />
                      <button
                        onClick={() => setSyncMode(!syncMode)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          syncMode ? "bg-primary" : "bg-muted-foreground/30"
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                            syncMode ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSettings(!showSettings)}
                      className="px-3 py-2"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Advanced
                      {showSettings ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPresets(!showPresets)}
                      className="px-3 py-2"
                    >
                      <Palette className="w-4 h-4 mr-2" />
                      Presets
                      {showPresets ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPrompts(!showPrompts)}
                      className="px-3 py-2"
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      Saved
                      {showPrompts ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
                    </Button>

                    <Button variant="ghost" size="sm" onClick={() => setShowCost(!showCost)} className="px-3 py-2">
                      <DollarSign className="w-4 h-4 mr-2" />
                      Usage
                      {showCost ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {showSettings && (
              <div className="border border-border rounded-xl p-6 bg-card/50">
                <GenerationSettings
                  aspectRatio={aspectRatio}
                  numImages={numImages}
                  model={model}
                  seed={seed}
                  maxImages={maxImages}
                  syncMode={syncMode}
                  enableSafetyChecker={enableSafetyChecker}
                  customWidth={customWidth}
                  customHeight={customHeight}
                  onAspectRatioChange={setAspectRatio}
                  onNumImagesChange={setNumImages}
                  onModelChange={setModel}
                  onSeedChange={setSeed}
                  onMaxImagesChange={setMaxImages}
                  onSyncModeChange={setSyncMode}
                  onSafetyCheckerChange={setEnableSafetyChecker}
                  onCustomSizeChange={handleCustomSizeChange}
                />
              </div>
            )}

            {showPresets && (
              <div className="border border-border rounded-xl p-6 bg-card/50">
                <StylePresets
                  onApplyPreset={handleApplyPreset}
                  currentSettings={{
                    model,
                    aspectRatio,
                    seed,
                    enableSafetyChecker,
                    syncMode,
                    customWidth,
                    customHeight,
                    prompt,
                  }}
                />
              </div>
            )}

            {showPrompts && (
              <div className="border border-border rounded-xl p-6 bg-card/50">
                <PromptManager onUsePrompt={setPrompt} currentPrompt={prompt} />
              </div>
            )}

            {showCost && (
              <div className="border border-border rounded-xl p-6 bg-card/50">
                <CostTracker onNewGeneration={() => {}} />
              </div>
            )}

            <GeneratedImages images={generatedImages} isLoading={isGenerating} />

            <HistoryGallery onRemix={handleRemix} onReusePrompt={handleReusePrompt} onCopyPrompt={handleCopyPrompt} />
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
