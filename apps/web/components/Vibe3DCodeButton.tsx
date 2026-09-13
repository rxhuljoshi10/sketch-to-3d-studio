import { useEditor, useToasts } from '@tldraw/tldraw'
import { useCallback, useState, useEffect } from 'react'
import { vibe3DCode } from '../lib/vibe3DCode'
import { edit3DCode } from '../lib/edit3DCode'
import { Model3DPreviewShape } from '../PreviewShape/Model3DPreviewShape'

export function Vibe3DCodeButton() {
  const editor = useEditor()
  const { addToast } = useToasts()
  const [is3DModelSelected, setIs3DModelSelected] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Update state whenever selection changes
  useEffect(() => {
    const handleSelectionChange = () => {
      const selectedShapes = editor.getSelectedShapes()
      const has3DModel = selectedShapes.some(shape => shape.type === 'model3d')
      setIs3DModelSelected(has3DModel)
    }

    // Check initially
    handleSelectionChange()

    // Subscribe to selection changes
    editor.addListener('change', handleSelectionChange)

    // Cleanup
    return () => {
      editor.removeListener('change', handleSelectionChange)
    }
  }, [editor])

  const handleClick = useCallback(async () => {
    if (isProcessing) return; // Prevent multiple clicks

    // Check that something is selected first
    const selectedShapes = editor.getSelectedShapes();
    if (selectedShapes.length === 0) {
      addToast({
        icon: 'warning-triangle',
        title: 'Nothing selected',
        description: 'Select your sketch first, then click Make 3D.',
      });
      return;
    }

    try {
      setIsProcessing(true);

      const model3dShape = selectedShapes.find(shape => shape.type === 'model3d') as Model3DPreviewShape;

      if (is3DModelSelected) {
        // Use edit3DCode for editing existing models
        if (!model3dShape) {
          throw Error('Could not find the selected 3D model.');
        }

        await edit3DCode(editor, (isEditing) => {
          const elementId = model3dShape.id;
          const event = new CustomEvent('model3d-editing-state-change', {
            detail: { isEditing, elementId }
          });
          window.dispatchEvent(event);
        });
      } else {
        // Generate new 3D model from sketch via Gemini AI
        await vibe3DCode(editor, model3dShape?.id || undefined, false);
      }
    } catch (e) {
      console.error(e)
      addToast({
        icon: 'cross-2',
        title: 'Something went wrong',
        description: (e as Error).message.slice(0, 100),
      })
    } finally {
      setIsProcessing(false);
    }
  }, [editor, addToast, is3DModelSelected, isProcessing]);

  // 3D cube icon as an SVG
  const CubeIcon = () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  )

  return (
    <button
      className="vibe3DCodeButton"
      onClick={handleClick}
      disabled={isProcessing}
      title="Convert selected sketch into interactive 3D model using Gemini AI"
      style={{
        marginLeft: '-3px',
        padding: '6px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        cursor: isProcessing ? 'wait' : 'pointer',
      }}
    >
      {isProcessing ? (
        <>
          <div
            style={{
              width: '14px',
              height: '14px',
              border: '2px solid rgba(255,255,255,0.3)',
              borderRadius: '50%',
              borderTop: '2px solid white',
              animation: 'spin 1s linear infinite',
            }}
          />
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <span>{is3DModelSelected ? 'Editing...' : 'Creating 3D...'}</span>
        </>
      ) : (
        <>
          <CubeIcon />
          <span style={{ fontWeight: 500 }}>
            {is3DModelSelected ? 'Edit 3D' : 'Make 3D'}
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: '#ffffff',
              letterSpacing: '0.02em',
            }}
          >
            Gemini AI
          </span>
        </>
      )}
    </button>
  )
}
