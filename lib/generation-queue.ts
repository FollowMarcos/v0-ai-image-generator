export interface GenerationJob {
  id: string
  prompt: string
  settings: {
    model: string
    aspectRatio: string
    numImages: number
    seed?: number
    enableSafetyChecker: boolean
    syncMode: boolean
    customWidth?: number
    customHeight?: number
  }
  imageUrls?: string[]
  status: "pending" | "processing" | "completed" | "failed" | "retrying"
  progress: number
  error?: string
  retryCount: number
  maxRetries: number
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  result?: {
    images: Array<{ url: string; width?: number; height?: number }>
    numImagesGenerated: number
  }
}

export class GenerationQueue {
  private static jobs: GenerationJob[] = []
  private static listeners: Array<(jobs: GenerationJob[]) => void> = []
  private static isProcessing = false

  static addJob(prompt: string, settings: GenerationJob["settings"], imageUrls?: string[]): GenerationJob {
    const job: GenerationJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      prompt,
      settings,
      imageUrls,
      status: "pending",
      progress: 0,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
    }

    this.jobs.unshift(job)
    this.notifyListeners()
    this.processQueue()

    return job
  }

  static getJobs(): GenerationJob[] {
    return [...this.jobs]
  }

  static getJob(id: string): GenerationJob | undefined {
    return this.jobs.find((job) => job.id === id)
  }

  static removeJob(id: string): void {
    this.jobs = this.jobs.filter((job) => job.id !== id)
    this.notifyListeners()
  }

  static retryJob(id: string): void {
    const job = this.jobs.find((job) => job.id === id)
    if (job && job.status === "failed" && job.retryCount < job.maxRetries) {
      job.status = "pending"
      job.error = undefined
      this.notifyListeners()
      this.processQueue()
    }
  }

  static clearCompleted(): void {
    this.jobs = this.jobs.filter((job) => job.status !== "completed")
    this.notifyListeners()
  }

  static subscribe(listener: (jobs: GenerationJob[]) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private static notifyListeners(): void {
    this.listeners.forEach((listener) => listener([...this.jobs]))
  }

  private static async processQueue(): Promise<void> {
    if (this.isProcessing) return

    const pendingJob = this.jobs.find((job) => job.status === "pending")
    if (!pendingJob) return

    this.isProcessing = true
    pendingJob.status = "processing"
    pendingJob.startedAt = new Date()
    pendingJob.progress = 10
    this.notifyListeners()

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        if (pendingJob.status === "processing" && pendingJob.progress < 90) {
          pendingJob.progress += Math.random() * 20
          this.notifyListeners()
        }
      }, 1000)

      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: pendingJob.prompt,
          imageUrls: pendingJob.imageUrls || [],
          aspectRatio: pendingJob.settings.aspectRatio,
          numImages: pendingJob.settings.numImages,
          model: pendingJob.settings.model,
          seed: pendingJob.settings.seed,
          maxImages: pendingJob.settings.numImages,
          syncMode: pendingJob.settings.syncMode,
          enableSafetyChecker: pendingJob.settings.enableSafetyChecker,
          customWidth: pendingJob.settings.customWidth,
          customHeight: pendingJob.settings.customHeight,
        }),
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate images")
      }

      const data = await response.json()
      pendingJob.status = "completed"
      pendingJob.progress = 100
      pendingJob.completedAt = new Date()
      pendingJob.result = data
      this.notifyListeners()
    } catch (error) {
      pendingJob.status = "failed"
      pendingJob.error = error instanceof Error ? error.message : "Unknown error"
      pendingJob.retryCount += 1
      this.notifyListeners()

      // Auto-retry if under max retries
      if (pendingJob.retryCount < pendingJob.maxRetries) {
        setTimeout(() => {
          this.retryJob(pendingJob.id)
        }, 2000)
      }
    } finally {
      this.isProcessing = false
      // Process next job
      setTimeout(() => this.processQueue(), 500)
    }
  }
}
