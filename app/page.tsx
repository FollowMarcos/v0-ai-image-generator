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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

      const payload = {
        prompt: processedPrompt,
        imageUrls,
        aspectRatio,
        numImages,
        model: "edit", // Force model to be "edit" since we only do image-to-image
        seed,
        maxImages,
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
        <TopNavbar />

        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="xl:col-span-1">
              <Card className="sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-card-foreground">Quick Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ImageUpload onImagesChange={setUploadedImages} maxImages={5} />

                  <CostTracker onNewGeneration={() => {}} />
                </CardContent>
              </Card>
            </div>

            <div className="xl:col-span-3 space-y-6">
              <PromptInput
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
                uploadedImagesCount={uploadedImages.length}
                prompt={prompt}
                onPromptChange={setPrompt}
              />

              <Card>
                <Tabs defaultValue="presets" className="w-full">
                  <CardHeader className="pb-3">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="presets">Presets</TabsTrigger>
                      <TabsTrigger value="prompts">Saved Prompts</TabsTrigger>
                      <TabsTrigger value="advanced">Advanced</TabsTrigger>
                    </TabsList>
                  </CardHeader>
                  <CardContent>
                    <TabsContent value="presets" className="mt-0">
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
                    </TabsContent>
                    <TabsContent value="prompts" className="mt-0">
                      <PromptManager onUsePrompt={setPrompt} currentPrompt={prompt} />
                    </TabsContent>
                    <TabsContent value="advanced" className="mt-0">
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
                    </TabsContent>
                  </CardContent>
                </Tabs>
              </Card>

              <GeneratedImages images={generatedImages} isLoading={isGenerating} />
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
