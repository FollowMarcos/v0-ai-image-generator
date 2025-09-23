import { type NextRequest, NextResponse } from "next/server"
import * as fal from "@fal-ai/serverless-client"

// Configure fal client
fal.config({
  credentials: process.env.FAL_KEY,
})

async function getImageDimensions(imageUrl: string): Promise<{ width: number; height: number } | null> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) return null

    const buffer = await response.arrayBuffer()
    const uint8Array = new Uint8Array(buffer)

    // Check for PNG signature
    if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4e && uint8Array[3] === 0x47) {
      // PNG format - IHDR chunk starts at byte 16
      const width = (uint8Array[16] << 24) | (uint8Array[17] << 16) | (uint8Array[18] << 8) | uint8Array[19]
      const height = (uint8Array[20] << 24) | (uint8Array[21] << 16) | (uint8Array[22] << 8) | uint8Array[23]
      return { width, height }
    }

    // Check for JPEG signature
    if (uint8Array[0] === 0xff && uint8Array[1] === 0xd8) {
      // JPEG format - scan for SOF0 marker
      for (let i = 2; i < uint8Array.length - 8; i++) {
        if (uint8Array[i] === 0xff && uint8Array[i + 1] === 0xc0) {
          const height = (uint8Array[i + 5] << 8) | uint8Array[i + 6]
          const width = (uint8Array[i + 7] << 8) | uint8Array[i + 8]
          return { width, height }
        }
      }
    }

    return null
  } catch (error) {
    console.error("[v0] Error getting image dimensions:", error)
    return null
  }
}

export async function POST(request: NextRequest) {
  let requestData
  try {
    requestData = await request.json()
  } catch (parseError) {
    console.error("[v0] Error parsing request JSON:", parseError)
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
  }

  try {
    const {
      prompt,
      imageUrls,
      aspectRatio,
      numImages,
      model,
      seed,
      maxImages,
      syncMode,
      enableSafetyChecker,
      customWidth,
      customHeight,
    } = requestData

    console.log("[v0] API received request:", {
      prompt: prompt?.substring(0, 100) + "...",
      aspectRatio,
      numImages,
      model,
    })

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    console.log("[v0] FAL_KEY exists:", !!process.env.FAL_KEY)
    console.log("[v0] FAL_KEY length:", process.env.FAL_KEY?.length || 0)

    if (!process.env.FAL_KEY) {
      console.error("[v0] FAL_KEY environment variable is not set")
      return NextResponse.json(
        { error: "API configuration error. Please check your fal integration." },
        { status: 500 },
      )
    }

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ error: "Image upload is required for image editing" }, { status: 400 })
    }

    const modelEndpoint = "fal-ai/flux/dev/image-to-image"

    const getImageSize = (ratio: string, customW?: number, customH?: number) => {
      if (ratio === "custom" && customW && customH) {
        return { width: customW, height: customH }
      }

      // Use standard FLUX dimensions
      switch (ratio) {
        case "1:1":
        case "square":
          return { width: 1024, height: 1024 }
        case "4:3":
        case "landscape_4_3":
          return { width: 1152, height: 896 }
        case "3:4":
        case "portrait_4_3":
          return { width: 896, height: 1152 }
        case "16:9":
        case "landscape_16_9":
          return { width: 1344, height: 768 }
        case "9:16":
        case "portrait_16_9":
          return { width: 768, height: 1344 }
        case "3:2":
        case "landscape_3_2":
          return { width: 1216, height: 832 }
        case "2:3":
        case "portrait_3_2":
          return { width: 832, height: 1216 }
        case "21:9":
        case "landscape_21_9":
          return { width: 1568, height: 672 }
        default:
          return { width: 1024, height: 1024 } // Default to square
      }
    }

    const input: any = {
      prompt,
      image_url: imageUrls[0], // FLUX uses single image_url instead of image_urls array
      ...getImageSize(aspectRatio || "1:1", customWidth, customHeight),
      num_images: numImages || 1,
      guidance_scale: 3.5,
      num_inference_steps: 28,
      strength: 0.95,
      enable_safety_checker: enableSafetyChecker !== false,
    }

    if (seed !== undefined && seed !== null) {
      input.seed = seed
    }

    console.log("[v0] Calling FAL API with:", { modelEndpoint, input })
    console.log("[v0] FAL client config:", { hasCredentials: !!process.env.FAL_KEY })

    let result
    try {
      console.log("[v0] About to call fal.subscribe...")
      result = await Promise.race([
        fal.subscribe(modelEndpoint, {
          input,
          logs: true,
          onQueueUpdate: (update) => {
            console.log("[v0] Queue update:", update.status)
            if (update.status === "IN_PROGRESS") {
              console.log(
                "[v0] Generation in progress:",
                update.logs?.map((log) => log.message),
              )
            }
          },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Request timeout after 5 minutes")), 300000)),
      ])
      console.log("[v0] fal.subscribe completed successfully")
    } catch (falError) {
      console.error("[v0] FAL API error details:", {
        message: falError instanceof Error ? falError.message : String(falError),
        stack: falError instanceof Error ? falError.stack : undefined,
        name: falError instanceof Error ? falError.name : undefined,
      })

      if (falError instanceof Error) {
        const errorStr = falError.message.toLowerCase()

        if (
          errorStr.includes("forbidden") ||
          errorStr.includes("unauthorized") ||
          errorStr.includes("authentication")
        ) {
          return NextResponse.json(
            {
              error: "Authentication failed. Please check your fal integration in Project Settings.",
            },
            { status: 403 },
          )
        }

        if (errorStr.includes("content policy") || errorStr.includes("safety") || errorStr.includes("inappropriate")) {
          return NextResponse.json(
            {
              error: "Content blocked by safety checker. Please try a different prompt or disable the safety checker.",
            },
            { status: 400 },
          )
        }

        if (errorStr.includes("quota") || errorStr.includes("limit")) {
          return NextResponse.json(
            {
              error: "API quota exceeded. Please check your FAL account limits.",
            },
            { status: 429 },
          )
        }

        if (errorStr.includes("timeout")) {
          return NextResponse.json(
            {
              error: "Request timed out. Please try again with fewer images or a simpler prompt.",
            },
            { status: 408 },
          )
        }
      }

      // Re-throw to be caught by outer try-catch
      throw falError
    }

    console.log("[v0] FAL API result:", result)

    const generatedImages = result.images || []

    if (generatedImages.length === 0) {
      throw new Error("No images generated")
    }

    const imagesWithDimensions = await Promise.all(
      generatedImages.map(async (img: any, index: number) => {
        const dimensions = await getImageDimensions(img.url)
        console.log(
          `[v0] Generated image ${index + 1} actual dimensions:`,
          dimensions ? `${dimensions.width} x ${dimensions.height}` : "Could not determine",
        )

        return {
          ...img,
          width: dimensions?.width || null,
          height: dimensions?.height || null,
        }
      }),
    )

    return NextResponse.json({
      images: imagesWithDimensions,
      seed: result.seed,
      numImagesGenerated: imagesWithDimensions.length,
    })
  } catch (error) {
    console.error("[v0] Outer catch - Error generating image:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    let errorMessage = "Failed to generate image"

    if (error instanceof Error) {
      const errorStr = error.message.toLowerCase()

      if (errorStr.includes("forbidden") || errorStr.includes("unauthorized")) {
        errorMessage = "Authentication failed. Please check your fal integration in Project Settings."
      } else if (errorStr.includes("file too large") || errorStr.includes("size limit")) {
        errorMessage = "Image file is too large. Please use images under 10MB for best results."
      } else if (errorStr.includes("invalid image") || errorStr.includes("unsupported format")) {
        errorMessage = "Invalid image format. Please use JPG, PNG, or WebP images."
      } else if (errorStr.includes("quota") || errorStr.includes("limit exceeded")) {
        errorMessage = "Generation limit reached. Please check your Vercel dashboard for usage details."
      } else if (errorStr.includes("safety") || errorStr.includes("content policy")) {
        errorMessage = "Content blocked by safety checker. Please try a different prompt or image."
      } else if (errorStr.includes("timeout")) {
        errorMessage = "Request timed out. Please try again with a simpler prompt or fewer images."
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
