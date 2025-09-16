"use client"

import type React from "react"
import { formatFileSize } from "@/lib/image-compression"
import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Upload, X, AlertCircle } from "lucide-react"

interface UploadedImage {
  id: string
  file: File
  url: string
  name: string
}

interface ImageUploadProps {
  onImagesChange: (images: UploadedImage[]) => void
  maxImages?: number
}

export function ImageUpload({ onImagesChange, maxImages = 5 }: ImageUploadProps) {
  const [images, setImages] = useState<UploadedImage[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB limit
  const RECOMMENDED_SIZE = 2 * 1024 * 1024 // Reduced from 5MB to 2MB for better API compatibility

  const handleFileUpload = useCallback(
    (files: FileList) => {
      const newImages: UploadedImage[] = []
      let hasError = false
      let errorMessage = ""

      Array.from(files).forEach((file) => {
        if (!file.type.startsWith("image/")) {
          hasError = true
          errorMessage = "Please upload only image files"
          return
        }

        if (file.size > MAX_FILE_SIZE) {
          hasError = true
          errorMessage = `File "${file.name}" is too large. Maximum size is 10MB.`
          return
        }

        if (images.length + newImages.length >= maxImages) {
          hasError = true
          errorMessage = `Maximum ${maxImages} images allowed`
          return
        }

        const id = Math.random().toString(36).substr(2, 9)
        const url = URL.createObjectURL(file)
        newImages.push({ id, file, url, name: file.name })
      })

      if (hasError) {
        setUploadError(errorMessage)
        setTimeout(() => setUploadError(null), 5000)
        return
      }

      const largeFiles = newImages.filter((img) => img.file.size > RECOMMENDED_SIZE)
      if (largeFiles.length > 0) {
        setUploadError(
          `Large files detected (${largeFiles.map((f) => formatFileSize(f.file.size)).join(", ")}). They will be automatically compressed before generation.`,
        )
        setTimeout(() => setUploadError(null), 8000)
      } else {
        setUploadError(null)
      }

      const updatedImages = [...images, ...newImages]
      setImages(updatedImages)
      onImagesChange(updatedImages)
    },
    [images, maxImages, onImagesChange],
  )

  const removeImage = (id: string) => {
    const updatedImages = images.filter((img) => img.id !== id)
    setImages(updatedImages)
    onImagesChange(updatedImages)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  return (
    <div className="space-y-4">
      {uploadError && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <div className="p-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
            <p className="text-sm text-orange-800 dark:text-orange-200">{uploadError}</p>
          </div>
        </Card>
      )}

      <Card
        className={cn(
          "border-2 border-dashed p-8 text-center transition-all duration-200",
          isDragOver
            ? "border-primary bg-primary/5 scale-[1.02] shadow-lg"
            : "border-border hover:border-muted-foreground/50",
          images.length >= maxImages && "opacity-50 pointer-events-none",
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className={cn(
              "transition-all duration-200",
              isDragOver ? "scale-110 text-primary" : "text-muted-foreground",
            )}
          >
            <Upload className="h-12 w-12" />
          </div>
          <div>
            <p className="text-lg font-medium text-card-foreground">
              {isDragOver ? "Drop images here!" : "Upload Images"}
            </p>
            <p className="text-sm text-muted-foreground">
              Drag and drop images here, or click to select (Max: <span className="font-medium">{maxImages}</span>)
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Max 10MB per file • Files over 2MB will be automatically compressed
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              const input = document.createElement("input")
              input.type = "file"
              input.multiple = true
              input.accept = "image/*"
              input.onchange = (e) => {
                const files = (e.target as HTMLInputElement).files
                if (files) handleFileUpload(files)
              }
              input.click()
            }}
            disabled={images.length >= maxImages}
            className={cn("transition-all duration-200", isDragOver && "bg-primary text-primary-foreground")}
          >
            <Upload className="h-4 w-4 mr-2" />
            Select Images
          </Button>
        </div>
      </Card>

      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {images.map((image, index) => (
            <Card key={image.id} className="relative group overflow-hidden hover:shadow-md transition-shadow">
              <img src={image.url || "/placeholder.svg"} alt={image.name} className="w-full h-24 object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => removeImage(image.id)}
                  className="h-8 w-8 p-0 rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/75 text-white text-xs p-1 text-center">
                @img{index + 1}
                <span className="block text-[10px] opacity-75">
                  {formatFileSize(image.file.size)}
                  {image.file.size > RECOMMENDED_SIZE && " • Will compress"}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
