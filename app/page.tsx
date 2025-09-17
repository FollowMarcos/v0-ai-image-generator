"use client"

import { useState } from "react"
import { ImageUpload } from "@/components/image-upload"
import { PromptInput } from "@/components/prompt-input"
import { PromptManager } from "@/components/prompt-manager"
import { GeneratedImages } from "@/components/generated-images"
import { CostTracker } from "@/components/cost-tracker"
import { StylePresets } from "@/components/style-presets"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Palette, BookOpen, Upload, DollarSign, Hash, Shield, Send as Sync, ImageIcon, Maximize } from "lucide-react"
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
  const [width, setWidth] = useState(1024)
  const [height, setHeight] = useState(1024)
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
    console.log("[v0] Current settings before:", { model, width, height, seed, enableSafetyChecker, syncMode, prompt })

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
    if (preset.settings.customWidth) setWidth(preset.settings.customWidth)
    if (preset.settings.customHeight) setHeight(preset.settings.customHeight)
    setSeed(preset.settings.seed)
    setEnableSafetyChecker(preset.settings.enableSafetyChecker)
    setSyncMode(preset.settings.syncMode)
    setCustomWidth(preset.settings.customWidth)
    setCustomHeight(preset.settings.customHeight)

    console.log("[v0] Settings after applying preset:", {
      prompt: prompt,
      model: preset.settings.model,
      width,
      height,
      seed: preset.settings.seed,
      enableSafetyChecker: preset.settings.enableSafetyChecker,
      syncMode: preset.settings.syncMode,
    })
  }

  const handleGenerate = async (promptText: string) => {
    const currentSettings = {
      width,
      height,
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

      console.log("[v0] CLIENT: Image dimensions:", { width, height })
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
        width,
        height,
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
          prompt: processedPrompt,
          images: data.images.map((img: any) => ({
            url: img.url,
            width: img.width,
            height: img.height,
          })),
          settings: {
            model: "edit",
            width,
            height,
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
      setWidth(currentSettings.width)
      setHeight(currentSettings.height)
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
              <PromptInput
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
                uploadedImagesCount={uploadedImages.length}
                prompt={prompt}
                onPromptChange={setPrompt}
              />

              <div className="border-t border-border p-3 bg-muted/10">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Maximize className="w-3 h-3" />
                    <Input
                      type="number"
                      placeholder="width"
                      value={width}
                      onChange={(e) => setWidth(Number.parseInt(e.target.value) || 1024)}
                      className="h-7 text-xs"
                      min="256"
                      max="2048"
                      step="64"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Maximize className="w-3 h-3" />
                    <Input
                      type="number"
                      placeholder="height"
                      value={height}
                      onChange={(e) => setHeight(Number.parseInt(e.target.value) || 1024)}
                      className="h-7 text-xs"
                      min="256"
                      max="2048"
                      step="64"
                    />
                  </div>

                  {/* Number of Images */}
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-3 h-3" />
                    <Select value={numImages.toString()} onValueChange={(v) => setNumImages(Number.parseInt(v))}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="4">4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Seed */}
                  <div className="flex items-center gap-2">
                    <Hash className="w-3 h-3" />
                    <Input
                      type="number"
                      placeholder="seed"
                      value={seed || ""}
                      onChange={(e) => setSeed(e.target.value ? Number.parseInt(e.target.value) : undefined)}
                      className="h-7 text-xs"
                    />
                  </div>

                  {/* Safety Checker */}
                  <div className="flex items-center gap-2">
                    <Shield className="w-3 h-3" />
                    <Switch
                      checked={enableSafetyChecker}
                      onCheckedChange={setEnableSafetyChecker}
                      className="scale-75"
                    />
                  </div>

                  {/* Sync Mode */}
                  <div className="flex items-center gap-2">
                    <Sync className="w-3 h-3" />
                    <Switch checked={syncMode} onCheckedChange={setSyncMode} className="scale-75" />
                  </div>

                  {/* Upload Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowUpload(!showUpload)}
                    className="h-7 px-2 text-xs justify-start"
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    upload
                  </Button>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPresets(!showPresets)}
                    className="h-6 px-2 text-xs"
                  >
                    <Palette className="w-3 h-3 mr-1" />
                    presets
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPrompts(!showPrompts)}
                    className="h-6 px-2 text-xs"
                  >
                    <BookOpen className="w-3 h-3 mr-1" />
                    saved
                  </Button>

                  <Button variant="ghost" size="sm" onClick={() => setShowCost(!showCost)} className="h-6 px-2 text-xs">
                    <DollarSign className="w-3 h-3 mr-1" />
                    cost
                  </Button>
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

            {showPresets && (
              <div className="border border-border rounded-md p-4 bg-muted/10">
                <StylePresets
                  onApplyPreset={handleApplyPreset}
                  currentSettings={{
                    model,
                    width,
                    height,
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
