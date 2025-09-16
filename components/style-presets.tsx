"use client"

import { useState, useEffect } from "react"
import { StylePresetsStorage, type StylePreset } from "@/lib/style-presets"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2 } from "lucide-react"

interface StylePresetsProps {
  onApplyPreset: (preset: StylePreset) => void
  currentSettings: {
    model: string
    aspectRatio: string
    seed?: number
    enableSafetyChecker: boolean
    syncMode: boolean
    customWidth?: number
    customHeight?: number
  }
}

export function StylePresets({ onApplyPreset, currentSettings }: StylePresetsProps) {
  const [presets, setPresets] = useState<StylePreset[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newPresetName, setNewPresetName] = useState("")
  const [newPresetDescription, setNewPresetDescription] = useState("")
  const [newPresetTemplate, setNewPresetTemplate] = useState("")

  useEffect(() => {
    setPresets(StylePresetsStorage.getPresets())
  }, [])

  const handleCreatePreset = () => {
    if (!newPresetName.trim()) return

    const newPreset = StylePresetsStorage.addPreset({
      name: newPresetName,
      description: newPresetDescription || undefined,
      settings: currentSettings,
      promptTemplate: newPresetTemplate || undefined,
    })

    setPresets(StylePresetsStorage.getPresets())
    setIsCreateDialogOpen(false)
    setNewPresetName("")
    setNewPresetDescription("")
    setNewPresetTemplate("")
  }

  const handleDeletePreset = (id: string) => {
    StylePresetsStorage.deletePreset(id)
    setPresets(StylePresetsStorage.getPresets())
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Style Presets</CardTitle>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Create
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Style Preset</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="preset-name">Name</Label>
                  <Input
                    id="preset-name"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="My Custom Style"
                  />
                </div>
                <div>
                  <Label htmlFor="preset-description">Description (optional)</Label>
                  <Input
                    id="preset-description"
                    value={newPresetDescription}
                    onChange={(e) => setNewPresetDescription(e.target.value)}
                    placeholder="Perfect for..."
                  />
                </div>
                <div>
                  <Label htmlFor="preset-template">Prompt Template (optional)</Label>
                  <Textarea
                    id="preset-template"
                    value={newPresetTemplate}
                    onChange={(e) => setNewPresetTemplate(e.target.value)}
                    placeholder="Add keywords that will be appended to prompts"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreatePreset}>Create Preset</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-sm truncate">{preset.name}</h4>
                  {preset.isDefault && (
                    <Badge variant="secondary" className="text-xs">
                      Default
                    </Badge>
                  )}
                </div>
                {preset.description && <p className="text-xs text-muted-foreground truncate">{preset.description}</p>}
                <div className="flex items-center gap-1 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {preset.settings.model}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {preset.settings.aspectRatio}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <Button size="sm" variant="ghost" onClick={() => onApplyPreset(preset)} className="h-8 px-2">
                  Apply
                </Button>
                {!preset.isDefault && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeletePreset(preset.id)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
