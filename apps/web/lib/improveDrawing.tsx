import { Editor, createShapeId, getSvgAsImage, TLImageShape, AssetRecordType } from '@tldraw/tldraw'
import { getSelectionAsText } from './getSelectionAsText'
import { blobToBase64 } from './blobToBase64'

interface GeneratedImageData {
  image: string
  mimeType: string
  svg?: string
  width: number
  height: number
}

export async function improveDrawing(editor: Editor) {
  // Get the selected shapes (we need at least one)
  const selectedShapes = editor.getSelectedShapes()
  if (selectedShapes.length === 0) throw Error('First select something to improve.')

  // Filter out non-drawable shapes if needed
  const drawableShapes = selectedShapes.filter((shape) => shape.type !== 'model3d')

  if (drawableShapes.length === 0) throw Error('No drawable shapes selected.')

  // Get the selection bounds to preserve position and dimensions
  const selectionBounds = editor.getSelectionPageBounds()
  if (!selectionBounds) {
    throw Error('Could not determine selection bounds.')
  }

  const { minX, minY, width, height } = selectionBounds
  const roundedWidth = Math.max(100, Math.round(width))
  const roundedHeight = Math.max(100, Math.round(height))
  const selectedShapeIds = drawableShapes.map((s) => s.id)

  // Get an SVG based on the selected shapes
  const svg = await editor.getSvg(drawableShapes, {
    scale: 1,
    background: true,
  })

  if (!svg) {
    throw Error('Could not generate SVG from selection.')
  }

  // Turn the SVG into a DataUrl
  const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  const blob = await getSvgAsImage(svg, IS_SAFARI, {
    type: 'png',
    quality: 0.8,
    scale: 1,
  })

  if (!blob) {
    throw Error('Could not generate image from SVG.')
  }

  const dataUrl = await blobToBase64(blob)

  // Get any text from the selection
  const selectionText = getSelectionAsText(editor)

  try {
    // Send the image, prompt, and exact selection dimensions to the backend
    const response = await fetch('http://localhost:8000/api/queue/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: selectionText,
        image_base64: dataUrl,
        width: roundedWidth,
        height: roundedHeight,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw Error(`API error: ${errorData.detail || response.statusText}`)
    }

    // Get the response with task ID
    const jsonResponse = await response.json()

    // Now wait for the completed vector/image via SSE
    const generatedImageData = await waitForImageGeneration(jsonResponse.task_id)

    // If we have an improved image, replace the rough sketch in-place
    if (generatedImageData) {
      const newShapeId = createShapeId()
      const assetId = AssetRecordType.createId()

      const mimeType = generatedImageData.mimeType || 'image/svg+xml'
      const imageSrc = mimeType.includes('svg')
        ? `data:image/svg+xml;base64,${generatedImageData.image}`
        : `data:image/png;base64,${generatedImageData.image}`

      // Create an asset first
      editor.createAssets([
        {
          id: assetId,
          type: 'image',
          typeName: 'asset',
          props: {
            name: 'improved-vector-drawing.svg',
            src: imageSrc,
            w: width,
            h: height,
            mimeType: mimeType,
            isAnimated: false,
          },
          meta: {},
        },
      ])

      // Start an undo/redo history mark so user can Ctrl+Z if they prefer the original
      editor.mark('improve-drawing')

      // Remove the old rough scribble shapes
      editor.deleteShapes(selectedShapeIds)

      // Create the improved vector shape at the EXACT location and size of the selection
      editor.createShape<TLImageShape>({
        id: newShapeId,
        type: 'image',
        x: minX,
        y: minY,
        props: {
          assetId: assetId,
          w: width,
          h: height,
        },
      })

      // Select the newly improved shape
      editor.select(newShapeId)

      return newShapeId
    } else {
      throw Error('No image was generated')
    }
  } catch (e) {
    console.error('Error in improveDrawing:', e)
    throw e
  }
}

// Function to wait for the image generation to complete via SSE with polling fallback
async function waitForImageGeneration(taskId: string): Promise<GeneratedImageData | null> {
  return new Promise((resolve, reject) => {
    let timeout: NodeJS.Timeout | null = null
    let pollInterval: NodeJS.Timeout | null = null
    let eventSource: EventSource | null = null
    let isSettled = false

    const cleanup = () => {
      isSettled = true
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
      }
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }
    }

    const handlePayload = (data: any) => {
      if (isSettled || !data) return

      if (data.status === 'completed') {
        const image = data.image || (data.images && data.images[0]?.image_base64)
        if (image) {
          cleanup()
          resolve({
            image,
            mimeType: data.mime_type || (data.svg ? 'image/svg+xml' : 'image/png'),
            svg: data.svg,
            width: data.width || 500,
            height: data.height || 500,
          })
        }
      } else if (data.status === 'failed' || data.status === 'error') {
        cleanup()
        reject(new Error(data.message || data.error || 'Vector improvement failed'))
      }
    }

    // 1. Set a safety timeout (90 seconds)
    timeout = setTimeout(() => {
      if (!isSettled) {
        cleanup()
        reject(new Error('Vector improvement timed out. Please try again.'))
      }
    }, 90000)

    // 2. Poll /api/task/{taskId} every 1s as a reliable fallback
    pollInterval = setInterval(async () => {
      if (isSettled) return
      try {
        const res = await fetch(`http://localhost:8000/api/task/${taskId}`)
        if (res.ok) {
          const taskData = await res.json()
          handlePayload(taskData)
        }
      } catch (err) {
        // Ignore transient poll fetch errors while task is running
      }
    }, 1200)

    // 3. Connect to SSE
    try {
      eventSource = new EventSource(`http://localhost:8000/api/subscribe/${taskId}`)

      // Handle standard message events (how completed events are emitted by TaskManager)
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handlePayload(data)
        } catch (e) {
          console.warn('Could not parse SSE message:', e)
        }
      }

      // Handle named "complete" events
      eventSource.addEventListener('complete', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data)
          handlePayload(data)
        } catch (e) {
          console.warn('Could not parse complete event:', e)
        }
      })

      // Handle named "error" events
      eventSource.addEventListener('error', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data)
          handlePayload(data)
        } catch {
          // Normal SSE reconnect or close, pollInterval will continue
        }
      })

      eventSource.onerror = () => {
        // SSE network error or auto-reconnect; let fallback polling handle it
        console.log('SSE connection issue, relying on fallback polling...')
      }
    } catch (err) {
      console.warn('EventSource initialization failed, fallback polling is active:', err)
    }
  })
}