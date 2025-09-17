"use client"

import { useState } from "react"
import { ImageUpload } from "@/components/image-upload"
import { PromptInput } from "@/components/prompt-input"
import { PromptManager } from "@/components/prompt-manager"
import { GenerationSettings } from "@/components/generation-settings"
import { GeneratedImages } from "@/components/generated-images"
import { CostTracker } from "@/components/cost-tracker"
import { StylePresets } from "@/components/style-presets"
import { Button } from "@/components/ui/button"
import { Settings, Palette, BookOpen, Upload, DollarSign, ChevronDown, ChevronUp } from "lucide-react"
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

export default function Home() {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [aspectRatio, setAspectRatio] = useState("square_hd")
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
  const [showUpload, setShowUpload] = useState(false)
  const [showCost, setShowCost] = useState(false)

  const uploadImagesToFAL = async (images: UploadedImage[]): Promise<string[]> => {
    const uploadPromises = images.map(async (image) => {
      let fileToProcess = image.file

      // Compress if file is larger than 2MB
      if (image.file.size > 2 * 1024 * 1024) {
        console.log(`[v0] Compressing ${image.file.name} (${formatFileSize(image.file.size)})`)
        try {
          fileToProcess = await compressImage(image.file, {
            maxWidth: 1024,
            maxHeight: 1024,
            quality: 0.8,
            maxSizeKB: 2048, // 2MB max
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

    // Only append style information if the prompt is empty or doesn't already contain style keywords
    if (prompt.trim() === "") {
      setPrompt(preset.promptTemplate)
    } else {
      // Check if the prompt already contains style-related keywords to avoid duplication
      const styleKeywords = ["style", "art", "painting", "digital", "realistic", "cartoon", "anime"]
      const hasStyleKeywords = styleKeywords.some(
        (keyword) => prompt.toLowerCase().includes(keyword) || preset.promptTemplate.toLowerCase().includes(keyword),
      )

      if (!hasStyleKeywords) {
        // Append the style template to the existing prompt
        setPrompt(`${prompt}, ${preset.promptTemplate}`)
      }
      // If style keywords already exist, don't modify the prompt to avoid redundancy
    }

    setModel(preset.settings.model)
    setAspectRatio(preset.settings.aspectRatio)
    setSeed(preset.settings.seed)
    setEnableSafetyChecker(preset.settings.enableSafetyChecker)
    setSyncMode(preset.settings.syncMode)
    setCustomWidth(preset.settings.customWidth)
    setCustomHeight(preset.settings.customHeight)

    console.log("[v0] Settings after applying preset:", {
      prompt: prompt, // Log the preserved/enhanced prompt
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
        if (processedPrompt.includes(reference)) {
          processedPrompt = processedPrompt.replace(new RegExp(reference, "g"), `[uploaded image ${index + 1}]`)
        }
      })

      console.log("[v0] Processed prompt:", processedPrompt)
      console.log("[v0] Image URLs count:", imageUrls.length)

      const effectiveMaxImages = Math.max(numImages, maxImages)

      const payload = {
        prompt: processedPrompt,
        imageUrls,
        aspectRatio,
        numImages,
        model: "edit", // Force model to be "edit" since we only do image-to-image
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
          prompt: processedPrompt,
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
          cost: 0.01 * (data.images?.length || 1), // Estimate cost per image
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

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="space-y-4">
            <div className="border border-border rounded-md">
              <div className="relative">
                <PromptInput
                  onGenerate={handleGenerate}
                  isGenerating={isGenerating}
                  uploadedImagesCount={uploadedImages.length}
                  prompt={prompt}
                  onPromptChange={setPrompt}
                />

                <div className="absolute left-3 bottom-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowUpload(!showUpload)}
                    className="h-8 w-8 p-0 hover:bg-muted/50"
                  >
                    <Upload className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="border-t border-border p-3 bg-muted/30">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Image Size Dropdown */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">Size:</label>
                    <select
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                      className="h-8 px-2 text-xs bg-background border border-border rounded"
                    >
                      <option value="square_hd">Square HD (1024×1024)</option>
                      <option value="square">Square (512×512)</option>
                      <option value="portrait_4_3">Portrait 4:3 (768×1024)</option>
                      <option value="portrait_16_9">Portrait 16:9 (576×1024)</option>
                      <option value="landscape_4_3">Landscape 4:3 (1024×768)</option>
                      <option value="landscape_16_9">Landscape 16:9 (1024×576)</option>
                    </select>
                  </div>

                  {/* Safety Checker Switch */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">Safe:</label>
                    <button
                      onClick={() => setEnableSafetyChecker(!enableSafetyChecker)}
                      className={`w-8 h-4 rounded-full transition-colors ${
                        enableSafetyChecker ? "bg-primary" : "bg-muted-foreground/30"
                      }`}
                    >
                      <div
                        className={`w-3 h-3 bg-white rounded-full transition-transform ${
                          enableSafetyChecker ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Sync Mode Switch */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">Sync:</label>
                    <button
                      onClick={() => setSyncMode(!syncMode)}
                      className={`w-8 h-4 rounded-full transition-colors ${
                        syncMode ? "bg-primary" : "bg-muted-foreground/30"
                      }`}
                    >
                      <div
                        className={`w-3 h-3 bg-white rounded-full transition-transform ${
                          syncMode ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Remaining buttons moved to right */}
                  <div className="ml-auto flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSettings(!showSettings)}
                      className="h-8 px-3 text-xs"
                    >
                      <Settings className="w-3 h-3 mr-1" />
                      settings
                      {showSettings ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPresets(!showPresets)}
                      className="h-8 px-3 text-xs"
                    >
                      <Palette className="w-3 h-3 mr-1" />
                      presets
                      {showPresets ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPrompts(!showPrompts)}
                      className="h-8 px-3 text-xs"
                    >
                      <BookOpen className="w-3 h-3 mr-1" />
                      saved
                      {showPrompts ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCost(!showCost)}
                      className="h-8 px-3 text-xs"
                    >
                      <DollarSign className="w-3 h-3 mr-1" />
                      cost
                      {showCost ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {showUpload && (
              <div className="border border-border rounded-md p-4 bg-muted/10">
                <ImageUpload onImagesChange={setUploadedImages} maxImages={5} />
                {uploadedImages.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {uploadedImages.length} image{uploadedImages.length !== 1 ? "s" : ""} ready
                  </div>
                )}
              </div>
            )}

            {showSettings && (
              <div className="border border-border rounded-md p-4 bg-muted/10">
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
              <div className="border border-border rounded-md p-4 bg-muted/10">
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
              <div className="border border-border rounded-md p-4 bg-muted/10">
                <PromptManager onUsePrompt={setPrompt} currentPrompt={prompt} />
              </div>
            )}

            {showCost && (
              <div className="border border-border rounded-md p-4 bg-muted/10">
                <CostTracker onNewGeneration={() => {}} />
              </div>
            )}

            <GeneratedImages images={generatedImages} isLoading={isGenerating} />
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
