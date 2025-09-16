"use client"

import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Home, History } from "lucide-react"

export function TopNavbar() {
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <a href="/" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Home
              </a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                History
              </a>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  )
}
