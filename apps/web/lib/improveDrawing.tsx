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

// Function to wait for the image generation to complete via SSE
async function waitForImageGeneration(taskId: string): Promise<GeneratedImageData | null> {
  return new Promise((resolve, reject) => {
    let timeout: NodeJS.Timeout | null = null

    try {
      const eventSource = new EventSource(`http://localhost:8000/api/subscribe/${taskId}`)

      // 60-second timeout
      timeout = setTimeout(() => {
        console.warn('Image generation timed out, closing SSE connection')
        eventSource.close()
        reject(new Error('Vector improvement timed out. Please try again.'))
      }, 60000)

      const cleanup = () => {
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
        }
        eventSource.close()
      }

      eventSource.addEventListener('start', () => {
        console.log('Vector sketch improvement started')
      })

      eventSource.addEventListener('complete', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data)
          console.log('Complete event received:', data)

          if (data.image) {
            resolve({
              image: data.image,
              mimeType: data.mime_type || (data.svg ? 'image/svg+xml' : 'image/png'),
              svg: data.svg,
              width: data.width || 500,
              height: data.height || 500,
            })
          } else if (data.images && data.images.length > 0) {
            const img = data.images[0]
            resolve({
              image: img.image_base64,
              mimeType: img.mime_type || data.mime_type || 'image/png',
              width: img.width || 500,
              height: img.height || 500,
            })
          } else {
            resolve(null)
          }
        } catch (error) {
          console.error('Error parsing complete event:', error)
          reject(error)
        } finally {
          cleanup()
        }
      })

      eventSource.addEventListener('error', (event) => {
        console.error('SSE error event received')
        try {
          const data = JSON.parse((event as MessageEvent).data)
          reject(new Error(data.error || data.message || 'Error improving sketch'))
        } catch {
          reject(new Error('Error during vector sketch improvement'))
        } finally {
          cleanup()
        }
      })

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        reject(new Error('Error connecting to AI backend'))
        cleanup()
      }
    } catch (err) {
      console.error('Error setting up SSE connection:', err)
      if (timeout) clearTimeout(timeout)
      reject(err)
    }
  })
}