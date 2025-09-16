"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"

interface GenerationSettingsProps {
  aspectRatio: string
  numImages: number
  model: string
  seed?: number
  maxImages: number
  syncMode: boolean
  enableSafetyChecker: boolean
  customWidth?: number
  customHeight?: number
  onAspectRatioChange: (value: string) => void
  onNumImagesChange: (value: number) => void
  onModelChange: (value: string) => void
  onSeedChange: (value: number | undefined) => void
  onMaxImagesChange: (value: number) => void
  onSyncModeChange: (value: boolean) => void
  onSafetyCheckerChange: (value: boolean) => void
  onCustomSizeChange: (width: number | undefined, height: number | undefined) => void
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

const models = [{ value: "edit", label: "Image Editing" }]

export function GenerationSettings({
  aspectRatio,
  numImages,
  model,
  seed,
  maxImages,
  syncMode,
  enableSafetyChecker,
  customWidth,
  customHeight,
  onAspectRatioChange,
  onNumImagesChange,
  onModelChange,
  onSeedChange,
  onMaxImagesChange,
  onSyncModeChange,
  onSafetyCheckerChange,
  onCustomSizeChange,
}: GenerationSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg text-card-foreground">Generation Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="model" className="text-card-foreground">
            Model
          </Label>
          <Select value={model} onValueChange={onModelChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((modelOption) => (
                <SelectItem key={modelOption.value} value={modelOption.value}>
                  {modelOption.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="aspect-ratio" className="text-card-foreground">
            Image Size
          </Label>
          <Select value={aspectRatio} onValueChange={onAspectRatioChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select image size" />
            </SelectTrigger>
            <SelectContent>
              {aspectRatios.map((ratio) => (
                <SelectItem key={ratio.value} value={ratio.value}>
                  {ratio.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {aspectRatio === "custom" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="custom-width" className="text-card-foreground">
                Width (1024-4096)
              </Label>
              <Input
                id="custom-width"
                type="number"
                min={1024}
                max={4096}
                value={customWidth || 1024}
                onChange={(e) => onCustomSizeChange(Number.parseInt(e.target.value), customHeight)}
                placeholder="1024"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-height" className="text-card-foreground">
                Height (1024-4096)
              </Label>
              <Input
                id="custom-height"
                type="number"
                min={1024}
                max={4096}
                value={customHeight || 1024}
                onChange={(e) => onCustomSizeChange(customWidth, Number.parseInt(e.target.value))}
                placeholder="1024"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="num-images" className="text-card-foreground">
            Number of Images: {numImages}
          </Label>
          <Slider
            id="num-images"
            min={1}
            max={4}
            step={1}
            value={[numImages]}
            onValueChange={(value) => onNumImagesChange(value[0])}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1</span>
            <span>2</span>
            <span>3</span>
            <span>4</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-images" className="text-card-foreground">
            Max Images per Generation: {maxImages}
          </Label>
          <Slider
            id="max-images"
            min={1}
            max={4}
            step={1}
            value={[maxImages]}
            onValueChange={(value) => onMaxImagesChange(value[0])}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Enables multi-image generation. Total images will be between num_images and max_images × num_images.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="seed" className="text-card-foreground">
            Seed (optional)
          </Label>
          <Input
            id="seed"
            type="number"
            value={seed || ""}
            onChange={(e) => onSeedChange(e.target.value ? Number.parseInt(e.target.value) : undefined)}
            placeholder="Random seed for reproducible results"
          />
          <p className="text-xs text-muted-foreground">
            Leave empty for random generation, or enter a number for reproducible results.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="safety-checker" className="text-card-foreground">
              Enable Safety Checker
            </Label>
            <p className="text-xs text-muted-foreground">Filters potentially harmful content</p>
          </div>
          <Switch id="safety-checker" checked={enableSafetyChecker} onCheckedChange={onSafetyCheckerChange} />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="sync-mode" className="text-card-foreground">
              Sync Mode
            </Label>
            <p className="text-xs text-muted-foreground">Wait for upload completion (slower but direct response)</p>
          </div>
          <Switch id="sync-mode" checked={syncMode} onCheckedChange={onSyncModeChange} />
        </div>
      </CardContent>
    </Card>
  )
}
