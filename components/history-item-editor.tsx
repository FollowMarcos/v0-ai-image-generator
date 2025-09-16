"use client"

import { useState } from "react"
import { HistoryStorage, type HistoryItem, type HistoryFolder } from "@/lib/history-storage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Heart, X, Plus } from "lucide-react"

interface HistoryItemEditorProps {
  item: HistoryItem
  folders: HistoryFolder[]
  isOpen: boolean
  onClose: () => void
  onUpdate: (item: HistoryItem) => void
}

export function HistoryItemEditor({ item, folders, isOpen, onClose, onUpdate }: HistoryItemEditorProps) {
  const [tags, setTags] = useState<string[]>(item.tags)
  const [newTag, setNewTag] = useState("")
  const [folder, setFolder] = useState<string | undefined>(item.folder)
  const [notes, setNotes] = useState(item.notes || "")
  const [favorite, setFavorite] = useState(item.favorite)

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag("")
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleSave = () => {
    const updates = {
      tags,
      folder,
      notes: notes.trim() || undefined,
      favorite,
    }

    HistoryStorage.updateHistoryItem(item.id, updates)
    onUpdate({ ...item, ...updates })
    onClose()
  }

  const allTags = HistoryStorage.getAllTags()
  const suggestedTags = allTags.filter((tag) => !tags.includes(tag))

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Generation</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Prompt Preview */}
          <div>
            <Label>Prompt</Label>
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg mt-1">{item.prompt}</p>
          </div>

          {/* Favorite Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={favorite ? "default" : "outline"}
              size="sm"
              onClick={() => setFavorite(!favorite)}
              className="flex items-center gap-2"
            >
              <Heart className={`h-4 w-4 ${favorite ? "fill-current" : ""}`} />
              {favorite ? "Favorited" : "Add to Favorites"}
            </Button>
          </div>

          {/* Folder Selection */}
          <div>
            <Label>Folder</Label>
            <Select value={folder || "none"} onValueChange={(value) => setFolder(value === "none" ? undefined : value)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Folder</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: f.color }} />
                      {f.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div>
            <Label>Tags</Label>
            <div className="mt-1 space-y-3">
              {/* Current Tags */}
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveTag(tag)}
                      className="h-4 w-4 p-0 hover:bg-transparent"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>

              {/* Add New Tag */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add a tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddTag()}
                  className="flex-1"
                />
                <Button onClick={handleAddTag} size="sm" disabled={!newTag.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Suggested Tags */}
              {suggestedTags.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Suggested tags:</p>
                  <div className="flex flex-wrap gap-1">
                    {suggestedTags.slice(0, 10).map((tag) => (
                      <Button
                        key={tag}
                        variant="outline"
                        size="sm"
                        onClick={() => setTags([...tags, tag])}
                        className="h-6 px-2 text-xs"
                      >
                        {tag}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add notes about this generation..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
