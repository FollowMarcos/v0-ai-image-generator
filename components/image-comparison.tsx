"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { X, Download, Eye, Grid, Maximize2 } from "lucide-react"

interface GeneratedImage {
  url: string
  width?: number
  height?: number
}

interface ComparisonImage extends GeneratedImage {
  id: string
  prompt?: string
  timestamp?: Date
}

interface ImageComparisonProps {
  images: GeneratedImage[]
  onDownload: (url: string, index: number) => void
}

export function ImageComparison({ images, onDownload }: ImageComparisonProps) {
  const [selectedImages, setSelectedImages] = useState<number[]>([])
  const [viewMode, setViewMode] = useState<"grid" | "comparison">("grid")
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)

  const toggleImageSelection = (index: number) => {
    setSelectedImages((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index)
      } else if (prev.length < 4) {
        // Limit to 4 images for comparison
        return [...prev, index]
      }
      return prev
    })
  }

  const clearSelection = () => {
    setSelectedImages([])
  }

  const selectedImageData = selectedImages.map((index) => images[index])

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant={viewMode === "grid" ? "default" : "outline"} size="sm" onClick={() => setViewMode("grid")}>
            <Grid className="h-4 w-4 mr-1" />
            Grid
          </Button>
          <Button
            variant={viewMode === "comparison" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("comparison")}
            disabled={selectedImages.length < 2}
          >
            <Eye className="h-4 w-4 mr-1" />
            Compare ({selectedImages.length})
          </Button>
        </div>
        {selectedImages.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearSelection}>
            <X className="h-4 w-4 mr-1" />
            Clear Selection
          </Button>
        )}
      </div>

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {images.map((image, index) => (
            <div key={index} className="relative group">
              <div
                className={`relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                  selectedImages.includes(index)
                    ? "border-primary shadow-lg scale-[1.02]"
                    : "border-transparent hover:border-muted-foreground/50"
                }`}
                onClick={() => toggleImageSelection(index)}
              >
                <img
                  src={image.url || "/placeholder.svg"}
                  alt={`Generated image ${index + 1}`}
                  className="w-full h-auto"
                />
                {selectedImages.includes(index) && (
                  <div className="absolute top-2 left-2">
                    <Badge variant="default" className="bg-primary text-primary-foreground">
                      {selectedImages.indexOf(index) + 1}
                    </Badge>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation()
                      setFullscreenImage(image.url)
                    }}
                    variant="secondary"
                    size="sm"
                  >
                    <Maximize2 className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDownload(image.url, index)
                    }}
                    variant="secondary"
                    size="sm"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comparison View */}
      {viewMode === "comparison" && selectedImages.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Image Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-4 ${selectedImages.length === 2 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"}`}>
              {selectedImageData.map((image, compIndex) => {
                const originalIndex = selectedImages[compIndex]
                return (
                  <div key={originalIndex} className="space-y-2">
                    <div className="relative group">
                      <img
                        src={image.url || "/placeholder.svg"}
                        alt={`Comparison image ${compIndex + 1}`}
                        className="w-full h-auto rounded-lg border"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                        <Button onClick={() => setFullscreenImage(image.url)} variant="secondary" size="sm">
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                        <Button onClick={() => onDownload(image.url, originalIndex)} variant="secondary" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-center">
                      <Badge variant="outline">Image {originalIndex + 1}</Badge>
                      {image.width && image.height && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {image.width} × {image.height}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fullscreen Dialog */}
      <Dialog open={!!fullscreenImage} onOpenChange={() => setFullscreenImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center">
            <img
              src={fullscreenImage || "/placeholder.svg"}
              alt="Fullscreen preview"
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
