"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Upload } from "lucide-react"

interface GlobalDropZoneProps {
  onFilesDropped: (files: FileList) => void
  children: React.ReactNode
}

export function GlobalDropZone({ onFilesDropped, children }: GlobalDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      setDragCounter((prev) => prev + 1)
      if (e.dataTransfer?.types.includes("Files")) {
        setIsDragOver(true)
      }
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      setDragCounter((prev) => prev - 1)
      if (dragCounter <= 1) {
        setIsDragOver(false)
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      setDragCounter(0)

      if (e.dataTransfer?.files) {
        onFilesDropped(e.dataTransfer.files)
      }
    }

    document.addEventListener("dragenter", handleDragEnter)
    document.addEventListener("dragleave", handleDragLeave)
    document.addEventListener("dragover", handleDragOver)
    document.addEventListener("drop", handleDrop)

    return () => {
      document.removeEventListener("dragenter", handleDragEnter)
      document.removeEventListener("dragleave", handleDragLeave)
      document.removeEventListener("dragover", handleDragOver)
      document.removeEventListener("drop", handleDrop)
    }
  }, [dragCounter, onFilesDropped])

  return (
    <div className="relative">
      {children}
      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-card border-2 border-dashed border-primary rounded-lg p-12 text-center animate-in fade-in-0 zoom-in-95">
            <Upload className="h-16 w-16 text-primary mx-auto mb-4" />
            <h3 className="text-2xl font-semibold text-card-foreground mb-2">Drop Images Here</h3>
            <p className="text-muted-foreground">Release to upload your images</p>
          </div>
        </div>
      )}
    </div>
  )
}
