"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

interface CostTrackerProps {
  onNewGeneration: (cost: number) => void
}

interface CostData {
  totalSpent: number
  generationCount: number
  dailySpent: number
  lastResetDate: string
  monthlySpent: number
  lastMonthReset: string
}

export function CostTracker({ onNewGeneration }: CostTrackerProps) {
  const [costData, setCostData] = useState<CostData>({
    totalSpent: 0,
    generationCount: 0,
    dailySpent: 0,
    lastResetDate: new Date().toDateString(),
    monthlySpent: 0,
    lastMonthReset: new Date().toISOString().slice(0, 7), // YYYY-MM format
  })

  useEffect(() => {
    // Load saved data from localStorage
    const saved = localStorage.getItem("fal-cost-tracker")
    if (saved) {
      const data = JSON.parse(saved)
      const today = new Date().toDateString()
      const currentMonth = new Date().toISOString().slice(0, 7)

      // Reset daily counter if it's a new day
      if (data.lastResetDate !== today) {
        data.dailySpent = 0
        data.lastResetDate = today
      }

      // Reset monthly counter if it's a new month
      if (data.lastMonthReset !== currentMonth) {
        data.monthlySpent = 0
        data.lastMonthReset = currentMonth
      }

      setCostData({
        totalSpent: data.totalSpent || 0,
        generationCount: data.generationCount || 0,
        dailySpent: data.dailySpent || 0,
        lastResetDate: data.lastResetDate || today,
        monthlySpent: data.monthlySpent || 0,
        lastMonthReset: data.lastMonthReset || currentMonth,
      })
    }
  }, [])

  useEffect(() => {
    // Save to localStorage whenever values change
    localStorage.setItem("fal-cost-tracker", JSON.stringify(costData))
  }, [costData])

  const addGeneration = (numImages: number) => {
    const cost = numImages * 0.03 // $0.03 per image
    setCostData((prev) => ({
      ...prev,
      totalSpent: prev.totalSpent + cost,
      generationCount: prev.generationCount + 1,
      dailySpent: prev.dailySpent + cost,
      monthlySpent: prev.monthlySpent + cost,
    }))
    onNewGeneration(cost)
  }

  const resetTracker = () => {
    const today = new Date().toDateString()
    const currentMonth = new Date().toISOString().slice(0, 7)
    setCostData({
      totalSpent: 0,
      generationCount: 0,
      dailySpent: 0,
      lastResetDate: today,
      monthlySpent: 0,
      lastMonthReset: currentMonth,
    })
    localStorage.removeItem("fal-cost-tracker")
  }

  // Expose the addGeneration function to parent
  useEffect(() => {
    ;(window as any).addGenerationCost = addGeneration
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-card-foreground flex items-center gap-2">
          💰 Cost Tracker
          <span className="text-xs text-muted-foreground font-normal">(Local Estimate)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Today:</span>
            <span className="font-medium text-card-foreground">${costData.dailySpent.toFixed(3)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">This Month:</span>
            <span className="font-medium text-card-foreground">${costData.monthlySpent.toFixed(3)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Spent:</span>
            <span className="font-medium text-card-foreground">${costData.totalSpent.toFixed(3)}</span>
          </div>
        </div>

        <hr className="border-border" />

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Generations:</span>
            <span className="font-medium text-card-foreground">{costData.generationCount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Avg per gen:</span>
            <span className="font-medium text-card-foreground">
              ${costData.generationCount > 0 ? (costData.totalSpent / costData.generationCount).toFixed(3) : "0.000"}
            </span>
          </div>
        </div>

        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded space-y-1">
          <div>💡 Billing is handled through your Vercel account via FAL integration.</div>
          <div>
            📊 Check actual usage: <strong>Vercel Dashboard → Project Settings → Integrations → FAL</strong>
          </div>
          <div className="text-muted-foreground/80">This tracker shows local usage estimates only.</div>
        </div>

        <Button variant="outline" size="sm" onClick={resetTracker} className="w-full mt-2 bg-transparent">
          Reset All
        </Button>
      </CardContent>
    </Card>
  )
}
