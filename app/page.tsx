"use client"

import { useState } from "react"
import { ImageUpload } from "@/components/image-upload"
import { PromptInput } from "@/components/prompt-input"
import { PromptManager } from "@/components/prompt-manager"
import { GenerationSettings } from "@/components/generation-settings"
import { GeneratedImages } from "@/components/generated-images"
import { CostTracker } from "@/components/cost-tracker"
import { StylePresets } from "@/components/style-presets"
import { TopNavbar } from "@/components/top-navbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, Settings, Palette, BookOpen, Sparkles } from "lucide-react"
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

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [showPrompts, setShowPrompts] = useState(false)

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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-card/30">
        <TopNavbar />

        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              AI-Powered Image Generation
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-balance mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Transform Your Images with AI
            </h1>
            <p className="text-xl text-muted-foreground text-balance max-w-2xl mx-auto">
              Upload your images and let AI transform them into stunning creations with advanced editing capabilities.
            </p>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Sidebar - Upload & Quick Actions */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="border-2 border-dashed border-primary/20 hover:border-primary/40 transition-colors">
                <CardHeader className="text-center pb-4">
                  <CardTitle className="flex items-center justify-center gap-2 text-primary">
                    <Sparkles className="w-5 h-5" />
                    Upload Images
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ImageUpload onImagesChange={setUploadedImages} maxImages={5} />
                  {uploadedImages.length > 0 && (
                    <Badge variant="secondary" className="mt-3 w-full justify-center">
                      {uploadedImages.length} image{uploadedImages.length !== 1 ? "s" : ""} ready
                    </Badge>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Cost Tracker</CardTitle>
                </CardHeader>
                <CardContent>
                  <CostTracker onNewGeneration={() => {}} />
                </CardContent>
              </Card>
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-2 space-y-6">
              {/* Prompt Input - Now more prominent */}
              <Card className="border-primary/20">
                <CardContent className="p-6">
                  <PromptInput
                    onGenerate={handleGenerate}
                    isGenerating={isGenerating}
                    uploadedImagesCount={uploadedImages.length}
                    prompt={prompt}
                    onPromptChange={setPrompt}
                  />
                </CardContent>
              </Card>

              {/* Collapsible Options - Clean integration */}
              <div className="space-y-4">
                {/* Style Presets */}
                <Collapsible open={showPresets} onOpenChange={setShowPresets}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-12 text-left bg-transparent">
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4" />
                        <span className="font-medium">Style Presets</span>
                        <Badge variant="secondary" className="ml-2">
                          Quick Apply
                        </Badge>
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showPresets ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Card className="mt-2 border-l-4 border-l-secondary">
                      <CardContent className="p-4">
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
                      </CardContent>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>

                {/* Saved Prompts */}
                <Collapsible open={showPrompts} onOpenChange={setShowPrompts}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-12 text-left bg-transparent">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        <span className="font-medium">Saved Prompts</span>
                        <Badge variant="secondary" className="ml-2">
                          Library
                        </Badge>
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showPrompts ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Card className="mt-2 border-l-4 border-l-accent">
                      <CardContent className="p-4">
                        <PromptManager onUsePrompt={setPrompt} currentPrompt={prompt} />
                      </CardContent>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>

                {/* Advanced Settings */}
                <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-12 text-left bg-transparent">
                      <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        <span className="font-medium">Advanced Settings</span>
                        <Badge variant="secondary" className="ml-2">
                          Fine-tune
                        </Badge>
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Card className="mt-2 border-l-4 border-l-primary">
                      <CardContent className="p-4">
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
                      </CardContent>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Generated Images */}
              <GeneratedImages images={generatedImages} isLoading={isGenerating} />
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
