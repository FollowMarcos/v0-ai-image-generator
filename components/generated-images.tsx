"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ImageComparison } from "@/components/image-comparison"
import { LayoutGrid, Eye } from "lucide-react"

interface GeneratedImage {
  url: string
  width?: number
  height?: number
}

interface GeneratedImagesProps {
  images: GeneratedImage[]
  isLoading: boolean
}

export function GeneratedImages({ images, isLoading }: GeneratedImagesProps) {
  const [viewMode, setViewMode] = useState<"simple" | "comparison">("simple")

  const downloadImage = async (url: string, index: number) => {
    try {
      console.log("[v0] Starting download for:", url)

      const response = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`)
      }

      const blob = await response.blob()
      console.log("[v0] Blob created, size:", blob.size)

      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.style.display = "none"

      // Get file extension from URL or default to png
      const urlParts = url.split(".")
      const extension = urlParts.length > 1 ? urlParts[urlParts.length - 1].split("?")[0] : "png"
      link.download = `ai-generated-${Date.now()}-${index + 1}.${extension}`

      link.setAttribute("download", link.download)
      document.body.appendChild(link)
      link.click()

      // Clean up
      setTimeout(() => {
        document.body.removeChild(link)
        window.URL.revokeObjectURL(downloadUrl)
      }, 100)

      console.log("[v0] Download triggered successfully")
    } catch (error) {
      console.error("[v0] Download error:", error)
      alert("Failed to download image. Please try right-clicking the image and selecting 'Save image as...'")
    }
  }

  const downloadAllImages = async () => {
    if (images.length === 0) return

    try {
      console.log("[v0] Starting bulk download for", images.length, "images")

      for (let i = 0; i < images.length; i++) {
        await downloadImage(images[i].url, i)
        // Small delay between downloads to prevent overwhelming the browser
        if (i < images.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }

      console.log("[v0] Bulk download completed")
    } catch (error) {
      console.error("[v0] Bulk download error:", error)
      alert("Failed to download some images. Please try downloading individually.")
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-card-foreground">
            <span className="text-xl">🖼️</span>
            Generated Images
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
              <p className="text-muted-foreground">Generating your images...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (images.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-card-foreground">
            <span className="text-xl">🖼️</span>
            Generated Images
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <div className="text-6xl text-muted-foreground mb-4">🖼️</div>
              <p className="text-muted-foreground">Your generated images will appear here</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 text-card-foreground">
            <span className="text-xl">🖼️</span>
            Generated Images ({images.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            {images.length > 1 && (
              <Button variant="secondary" size="sm" onClick={downloadAllImages} className="mr-2">
                <span className="mr-2">⬇</span>
                Download All
              </Button>
            )}
            {images.length > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant={viewMode === "simple" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("simple")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "comparison" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("comparison")}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {viewMode === "simple" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {images.map((image, index) => (
              <div key={index} className="relative group">
                <img
                  src={image.url || "/placeholder.svg"}
                  alt={`Generated image ${index + 1}`}
                  className="w-full h-auto rounded-lg shadow-md"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                  <Button onClick={() => downloadImage(image.url, index)} variant="secondary" size="sm">
                    <span className="mr-2">⬇</span>
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ImageComparison images={images} onDownload={downloadImage} />
        )}
      </CardContent>
    </Card>
  )
}
