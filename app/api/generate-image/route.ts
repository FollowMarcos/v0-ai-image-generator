import { type NextRequest, NextResponse } from "next/server"

// Configure fal client
// Removed fal.config as it's no longer needed

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

    console.log("[v0] FREEPIK_API_KEY exists:", !!process.env.FREEPIK_API_KEY)
    console.log("[v0] FREEPIK_API_KEY length:", process.env.FREEPIK_API_KEY?.length || 0)

    if (!process.env.FREEPIK_API_KEY) {
      console.error("[v0] FREEPIK_API_KEY environment variable is not set")
      return NextResponse.json(
        { error: "API configuration error. Please add FREEPIK_API_KEY to your environment variables." },
        { status: 500 },
      )
    }

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ error: "Image upload is required for image editing" }, { status: 400 })
    }

    const apiEndpoint = "https://api.freepik.com/v1/ai/text-to-image/seedream-v4-edit"

    const requestBody = {
      prompt,
      reference_images: imageUrls, // Use reference_images as per Freepik API docs
      aspect_ratio: aspectRatio === "1:1" ? "square_1_1" : aspectRatio || "square_1_1",
      guidance_scale: 2.5,
    }

    if (seed !== undefined && seed !== null) {
      requestBody.seed = seed
    }

    console.log("[v0] Calling Freepik API with:", { apiEndpoint, requestBody })

    let result
    try {
      console.log("[v0] About to call Freepik API...")

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-freepik-api-key": process.env.FREEPIK_API_KEY,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] Freepik API error response:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        })

        if (response.status === 403 || response.status === 401) {
          return NextResponse.json(
            {
              error: "Authentication failed. Please check your Freepik API key in environment variables.",
            },
            { status: 403 },
          )
        }

        throw new Error(`Freepik API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      result = await response.json()
      console.log("[v0] Freepik API initial response:", result)
    } catch (freepikError) {
      console.error("[v0] Freepik API error details:", {
        message: freepikError instanceof Error ? freepikError.message : String(freepikError),
        stack: freepikError instanceof Error ? freepikError.stack : undefined,
        name: freepikError instanceof Error ? freepikError.name : undefined,
      })

      if (freepikError instanceof Error) {
        const errorStr = freepikError.message.toLowerCase()

        if (
          errorStr.includes("forbidden") ||
          errorStr.includes("unauthorized") ||
          errorStr.includes("authentication")
        ) {
          return NextResponse.json(
            {
              error: "Authentication failed. Please check your Freepik API key in environment variables.",
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
              error: "API quota exceeded. Please check your Freepik account limits.",
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

      throw freepikError
    }

    if (result.data?.task_id && result.data?.status === "IN_PROGRESS") {
      const taskId = result.data.task_id
      console.log("[v0] Task started, polling for results. Task ID:", taskId)

      const maxAttempts = 30 // 30 attempts = ~60 seconds max wait time
      let attempts = 0

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000)) // Wait 2 seconds between polls
        attempts++

        try {
          const statusResponse = await fetch(`https://api.freepik.com/v1/ai/text-to-image/seedream-v4-edit/${taskId}`, {
            method: "GET",
            headers: {
              "x-freepik-api-key": process.env.FREEPIK_API_KEY,
            },
          })

          if (!statusResponse.ok) {
            console.error("[v0] Status check failed:", statusResponse.status, statusResponse.statusText)
            break
          }

          const statusResult = await statusResponse.json()
          console.log(`[v0] Poll attempt ${attempts}, status:`, statusResult.data?.status)

          if (statusResult.data?.status === "COMPLETED" && statusResult.data?.generated?.length > 0) {
            result = statusResult
            break
          } else if (statusResult.data?.status === "FAILED") {
            throw new Error("Image generation failed")
          }
        } catch (pollError) {
          console.error("[v0] Error polling for results:", pollError)
          break
        }
      }

      if (attempts >= maxAttempts) {
        throw new Error("Image generation timed out. Please try again.")
      }
    }

    console.log("[v0] Final Freepik API result:", result)

    let generatedImages = []

    if (result.data?.generated && Array.isArray(result.data.generated)) {
      generatedImages = result.data.generated
      console.log("[v0] Found images in result.data.generated")
    } else if (result.images) {
      generatedImages = result.images
      console.log("[v0] Found images in result.images")
    } else if (result.data?.images) {
      generatedImages = result.data.images
      console.log("[v0] Found images in result.data.images")
    } else {
      console.log("[v0] Could not find images in response, available keys:", Object.keys(result?.data || result || {}))
    }

    console.log("[v0] Extracted images:", generatedImages)

    if (generatedImages.length === 0) {
      console.error("[v0] No images found in response. Full response:", result)
      throw new Error("No images generated")
    }

    const imagesWithDimensions = await Promise.all(
      generatedImages.map(async (img: any, index: number) => {
        const imageUrl = img.url || img.image_url || img
        const dimensions = await getImageDimensions(imageUrl)
        console.log(
          `[v0] Generated image ${index + 1} actual dimensions:`,
          dimensions ? `${dimensions.width} x ${dimensions.height}` : "Could not determine",
        )

        return {
          url: imageUrl,
          width: dimensions?.width || null,
          height: dimensions?.height || null,
        }
      }),
    )

    return NextResponse.json({
      images: imagesWithDimensions,
      seed: result.data?.seed || result.seed,
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
        errorMessage = "Authentication failed. Please add FREEPIK_API_KEY to your environment variables."
      } else if (errorStr.includes("file too large") || errorStr.includes("size limit")) {
        errorMessage = "Image file is too large. Please use images under 10MB for best results."
      } else if (errorStr.includes("invalid image") || errorStr.includes("unsupported format")) {
        errorMessage = "Invalid image format. Please use JPG, PNG, or WebP images."
      } else if (errorStr.includes("quota") || errorStr.includes("limit exceeded")) {
        errorMessage = "Generation limit reached. Please check your Freepik account for usage details."
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
