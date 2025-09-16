"use client"

import { useState, useEffect } from "react"
import { GenerationQueue, type GenerationJob } from "@/lib/generation-queue"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock, CheckCircle, XCircle, RotateCcw, Trash2 } from "lucide-react"

interface GenerationQueueProps {
  onJobCompleted?: (job: GenerationJob) => void
}

export function GenerationQueueComponent({ onJobCompleted }: GenerationQueueProps) {
  const [jobs, setJobs] = useState<GenerationJob[]>([])

  useEffect(() => {
    const unsubscribe = GenerationQueue.subscribe((updatedJobs) => {
      setJobs(updatedJobs)

      // Check for newly completed jobs
      const completedJobs = updatedJobs.filter(
        (job) => job.status === "completed" && !jobs.find((j) => j.id === job.id && j.status === "completed"),
      )

      completedJobs.forEach((job) => {
        onJobCompleted?.(job)
      })
    })

    setJobs(GenerationQueue.getJobs())
    return unsubscribe
  }, [jobs, onJobCompleted])

  const getStatusIcon = (status: GenerationJob["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-muted-foreground" />
      case "processing":
        return <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "retrying":
        return <RotateCcw className="h-4 w-4 text-orange-500 animate-spin" />
    }
  }

  const getStatusColor = (status: GenerationJob["status"]) => {
    switch (status) {
      case "pending":
        return "secondary"
      case "processing":
        return "default"
      case "completed":
        return "default"
      case "failed":
        return "destructive"
      case "retrying":
        return "secondary"
    }
  }

  const formatDuration = (start: Date, end?: Date) => {
    const duration = (end || new Date()).getTime() - start.getTime()
    return `${Math.round(duration / 1000)}s`
  }

  if (jobs.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Generation Queue</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => GenerationQueue.clearCompleted()}
              disabled={!jobs.some((job) => job.status === "completed")}
            >
              Clear Completed
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="p-3 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(job.status)}
                    <Badge variant={getStatusColor(job.status)} className="text-xs">
                      {job.status}
                    </Badge>
                    {job.status === "failed" && job.retryCount < job.maxRetries && (
                      <Badge variant="outline" className="text-xs">
                        Retry {job.retryCount + 1}/{job.maxRetries}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {job.status === "failed" && job.retryCount < job.maxRetries && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => GenerationQueue.retryJob(job.id)}
                        className="h-7 w-7 p-0"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => GenerationQueue.removeJob(job.id)}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2">{job.prompt}</p>

                {job.status === "processing" && (
                  <div className="space-y-1">
                    <Progress value={job.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">{Math.round(job.progress)}% complete</p>
                  </div>
                )}

                {job.error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">{job.error}</p>}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>{job.settings.model}</span>
                    <span>•</span>
                    <span>
                      {job.settings.numImages} image{job.settings.numImages > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div>{job.startedAt && <span>{formatDuration(job.startedAt, job.completedAt)}</span>}</div>
                </div>

                {job.status === "completed" && job.result && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <div className="flex -space-x-2">
                      {job.result.images.slice(0, 3).map((image, index) => (
                        <img
                          key={index}
                          src={image.url || "/placeholder.svg"}
                          alt={`Result ${index + 1}`}
                          className="h-8 w-8 rounded border-2 border-background object-cover"
                        />
                      ))}
                      {job.result.images.length > 3 && (
                        <div className="h-8 w-8 rounded border-2 border-background bg-muted flex items-center justify-center text-xs">
                          +{job.result.images.length - 3}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {job.result.images.length} generated
                    </Badge>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
