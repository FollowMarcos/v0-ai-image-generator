"use client"

import { useState, useEffect } from "react"
import { PromptStorage, type SavedPrompt } from "@/lib/prompt-storage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Plus, Trash2, Copy, Clock } from "lucide-react"

interface PromptManagerProps {
  onUsePrompt: (prompt: string) => void
  currentPrompt?: string
}

export function PromptManager({ onUsePrompt, currentPrompt }: PromptManagerProps) {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newPromptName, setNewPromptName] = useState("")
  const [newPromptDescription, setNewPromptDescription] = useState("")
  const [newPromptTags, setNewPromptTags] = useState("")

  useEffect(() => {
    setPrompts(PromptStorage.getPrompts())
  }, [])

  const filteredPrompts = searchQuery
    ? PromptStorage.searchPrompts(searchQuery)
    : prompts.sort((a, b) => b.usageCount - a.usageCount)

  const handleSaveCurrentPrompt = () => {
    if (!currentPrompt?.trim()) return

    const newPrompt = PromptStorage.addPrompt({
      text: currentPrompt,
      name: newPromptName || `Prompt ${Date.now()}`,
      description: newPromptDescription || undefined,
      tags: newPromptTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    })

    setPrompts(PromptStorage.getPrompts())
    setIsCreateDialogOpen(false)
    setNewPromptName("")
    setNewPromptDescription("")
    setNewPromptTags("")
  }

  const handleDeletePrompt = (id: string) => {
    PromptStorage.deletePrompt(id)
    setPrompts(PromptStorage.getPrompts())
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const handleUsePrompt = (prompt: SavedPrompt) => {
    PromptStorage.usePrompt(prompt.id)
    onUsePrompt(prompt.text)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Saved Prompts</CardTitle>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={!currentPrompt?.trim()}>
                <Plus className="h-4 w-4 mr-1" />
                Save Current
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Current Prompt</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="prompt-preview">Prompt</Label>
                  <Textarea id="prompt-preview" value={currentPrompt || ""} readOnly className="bg-muted" rows={3} />
                </div>
                <div>
                  <Label htmlFor="prompt-name">Name</Label>
                  <Input
                    id="prompt-name"
                    value={newPromptName}
                    onChange={(e) => setNewPromptName(e.target.value)}
                    placeholder="My awesome prompt"
                  />
                </div>
                <div>
                  <Label htmlFor="prompt-description">Description (optional)</Label>
                  <Input
                    id="prompt-description"
                    value={newPromptDescription}
                    onChange={(e) => setNewPromptDescription(e.target.value)}
                    placeholder="What this prompt is good for..."
                  />
                </div>
                <div>
                  <Label htmlFor="prompt-tags">Tags (comma-separated)</Label>
                  <Input
                    id="prompt-tags"
                    value={newPromptTags}
                    onChange={(e) => setNewPromptTags(e.target.value)}
                    placeholder="portrait, realistic, art"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveCurrentPrompt}>Save Prompt</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-3">
            {filteredPrompts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No saved prompts yet</p>
                <p className="text-xs mt-1">Save your current prompt to get started</p>
              </div>
            ) : (
              filteredPrompts.map((prompt) => (
                <div key={prompt.id} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{prompt.name}</h4>
                      {prompt.description && <p className="text-xs text-muted-foreground mt-1">{prompt.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(prompt.text)}
                        className="h-7 w-7 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeletePrompt(prompt.id)}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{prompt.text}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 flex-wrap">
                      {prompt.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {prompt.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{prompt.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {prompt.usageCount > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {prompt.usageCount}
                        </div>
                      )}
                      <Button size="sm" onClick={() => handleUsePrompt(prompt)} className="h-7 px-2 text-xs">
                        Use
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
