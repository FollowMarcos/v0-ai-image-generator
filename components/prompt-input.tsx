"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface PromptInputProps {
  onGenerate: (prompt: string) => void
  isGenerating: boolean
  uploadedImagesCount: number
  prompt: string
  onPromptChange: (prompt: string) => void
}

export function PromptInput({
  onGenerate,
  isGenerating,
  uploadedImagesCount,
  prompt,
  onPromptChange,
}: PromptInputProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (prompt.trim()) {
      onGenerate(prompt.trim())
    }
  }

  const canGenerate = prompt.trim().length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-card-foreground">
          <span className="text-xl">✨</span>
          AI Prompt
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt" className="text-card-foreground">
              Describe what you want to generate
            </Label>
            <Textarea
              id="prompt"
              placeholder={`Enter your prompt here${uploadedImagesCount > 0 ? ". Use @img1, @img2, etc. to reference uploaded images." : ""}`}
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              className="min-h-[100px] resize-none"
            />
            {uploadedImagesCount > 0 && (
              <p className="text-sm text-muted-foreground">
                💡 Tip: Reference your uploaded images using @img1, @img2, etc. in your prompt
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={!canGenerate || isGenerating} size="lg">
            {isGenerating ? (
              <>
                <span className="mr-2 animate-spin">⟳</span>
                Generating Images...
              </>
            ) : (
              <>
                <span className="mr-2">✨</span>
                Generate Images
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
