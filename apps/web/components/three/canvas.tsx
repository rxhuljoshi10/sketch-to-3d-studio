"use client"

import './App.css'
import { Canvas } from '@react-three/fiber'
import { Sky, GizmoHelper, GizmoViewport, Bvh } from '@react-three/drei'
import { InfiniteGrid } from '@/components/three/InfiniteGrid'
import { FirstPersonController } from '@/components/three/FirstPersonController'
import { Perf } from 'r3f-perf'
import { MeshCreator } from '@/components/three/MeshCreator'
import { useAppStore } from '@/store/appStore'
import { useEffect, useRef, useState } from 'react'
import { Crosshair } from '@/components/three/Crosshair'
import * as THREE from 'three'
import { StoredObjects } from '@/components/three/StoredObjects'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { useThree } from '@react-three/fiber'
import { Ocean } from '@/components/three/Ocean'
import { useObjectStore } from '@/store/appStore'
import { ObjectPropertiesPanel } from '@/components/three/ObjectPropertiesPanel'

const FocusDetector = () => {
  const { setUIFocused } = useAppStore()

  useEffect(() => {
    const handleFocusChange = () => {
      const activeElement = document.activeElement
      const isInput =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        // Treat number inputs inside the properties panel as UI-focused too
        (activeElement?.tagName === 'INPUT' &&
          (activeElement as HTMLInputElement).closest('#object-properties-panel') !== null)
      setUIFocused(!!isInput)
    }

    document.addEventListener('focusin', handleFocusChange)
    document.addEventListener('focusout', handleFocusChange)

    handleFocusChange()

    return () => {
      document.removeEventListener('focusin', handleFocusChange)
      document.removeEventListener('focusout', handleFocusChange)
    }
  }, [setUIFocused])

  return null
}

// Component to manage ocean visibility and grid visibility
function OceanAndGridManager() {
  const [showOcean, setShowOcean] = useState(false)

  useEffect(() => {
    // Check for environment settings on each render
    const checkSettings = () => {
      // @ts-ignore - Accessing custom window property
      const settings = window.__environmentSettings
      if (settings && typeof settings.showOcean === 'boolean') {
        setShowOcean(settings.showOcean)
      }
    }

    // Initial check
    checkSettings()

    // Set up interval to check periodically for changes
    const intervalId = setInterval(checkSettings, 500)

    return () => clearInterval(intervalId)
  }, [])

  return (
    <>
      {/* Show Ocean only when enabled */}
      {showOcean ? <Ocean /> : <InfiniteGrid />}
    </>
  )
}

function ExampleCube() {
  const meshRef = useRef<THREE.Mesh>(null)

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.userData = {
        isUserCreated: true,
        name: "Example Cube"
      }
    }
  }, [])

  return (
    <mesh
      ref={meshRef}
      position={[2, 1, 0]}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  )
}

function ExampleGroup() {
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.userData = {
        isUserCreated: true,
        name: "Example Group"
      }
    }
  }, [])

  return (
    <group
      ref={groupRef}
      position={[-2, 1, 0]}
    >
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="cyan" />
      </mesh>
      <mesh position={[0.7, 0, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="yellow" />
      </mesh>
      <mesh position={[0.35, 0.7, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.3, 0.3, 0.8]} />
        <meshStandardMaterial color="lime" />
      </mesh>
    </group>
  )
}

// Component to handle scene export
function SceneExporter() {
  const { scene } = useThree()

  // Store scene reference in a global variable for external access
  useEffect(() => {
    // @ts-ignore - We're adding a custom property to window
    window.__threeScene = scene
  }, [scene])

  return null
}

export default function ThreeJSCanvas({
  visible = true
}: {
  visible?: boolean
}) {
  const { objects, clearObjects } = useObjectStore()
  const { selectedObject, setSelectedObject } = useAppStore()
  const [showObjectsManager, setShowObjectsManager] = useState(false)

  const exportScene = () => {
    // @ts-ignore - Access the scene from the global variable
    const scene = window.__threeScene
    if (!scene) return

    console.log('Original scene:', scene);

    // Create a temporary scene with only user-created objects
    const exportScene = new THREE.Scene();

    // Clone only user-created objects
    scene.traverse((object: THREE.Object3D) => {
      if (object.userData && object.userData.isUserCreated === true) {
        console.log('Found user object to export:', object.userData.name || 'Unnamed object');
        const clonedObject = object.clone();
        exportScene.add(clonedObject);
      }
    });

    // Check if we found any user objects
    if (exportScene.children.length === 0) {
      console.warn('No user-created objects found to export');
      alert('No user-created objects found to export. Try creating some objects first.');
      return;
    }

    console.log('Export scene with filtered objects:', exportScene);

    const exporter = new GLTFExporter();
    exporter.parse(
      exportScene,
      (gltf: any) => {
        console.log('GLTF export successful:', gltf);
        const blob = new Blob([JSON.stringify(gltf)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'scene.gltf';
        link.click();
      },
      (error: ErrorEvent) => {
        console.error('An error happened during export:', error);
        alert('Failed to export scene: ' + error.message);
      },
      { binary: false }
    );
  }

  return (
    <>
      <Canvas
        style={{
          display: visible ? 'block' : 'none',
        }}
        gl={{
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true,
          antialias: true,
          failIfMajorPerformanceCaveat: false,
        }}
      >
        <ambientLight intensity={Math.PI / 2} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={Math.PI * 2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight
          position={[-5, 5, -2]}
          intensity={Math.PI}
          color="#8088ff"
        />
        <hemisphereLight
          args={["#ffffff", "#8888ff", 0.7]}
          position={[0, 10, 0]}
        />
        <Sky
          distance={450000}
          sunPosition={[5, 1, 2]}
          inclination={0.1}
          azimuth={0.5}
          rayleigh={0.5}
          turbidity={10}
          mieCoefficient={0.005}
          mieDirectionalG={0.8}
        />
        {visible && <FirstPersonController />}
        {visible && <OceanAndGridManager />}
        <Bvh>
          <StoredObjects />
        </Bvh>
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport labelColor="black" />
        </GizmoHelper>
        {visible && <MeshCreator />}
        {visible && <SceneExporter />}
      </Canvas>

      {visible && (
        <>
          <FocusDetector />
          <Crosshair />
          <ObjectPropertiesPanel />

          {/* Floating Action Buttons */}
          <div style={{ position: 'absolute', bottom: '20px', left: '20px', display: 'flex', gap: '8px', zIndex: 100 }}>
            {/* Button to export scene as gltf */}
            <button
              onClick={exportScene}
              style={{
                padding: '8px 14px',
                background: '#334155',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '12px',
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                transition: 'all 0.15s ease'
              }}
            >
              Export Scene
            </button>

            {/* Button to open Scene Objects manager */}
            <button
              onClick={() => setShowObjectsManager(prev => !prev)}
              style={{
                padding: '8px 14px',
                background: showObjectsManager ? '#0284c7' : '#1e293b',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                transition: 'all 0.15s ease'
              }}
            >
              <span>📦 Objects ({objects.length})</span>
            </button>
          </div>

          {/* Scene Objects Manager Panel */}
          {showObjectsManager && (
            <div
              style={{
                position: 'absolute',
                bottom: '68px',
                left: '20px',
                width: '320px',
                maxHeight: '380px',
                background: 'rgba(15, 23, 42, 0.94)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '14px',
                color: '#f8fafc',
                zIndex: 150,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#38bdf8' }}>
                  📦 Scene Objects ({objects.length})
                </div>
                <button
                  onClick={() => setShowObjectsManager(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}
                >
                  ✕
                </button>
              </div>

              {objects.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '12px', padding: '16px 0', textAlign: 'center', lineHeight: 1.5 }}>
                  No 3D objects in the scene.<br />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>In the 2D Canvas, click the '+' icon on a preview card to add it here.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', maxHeight: '230px', paddingRight: '4px' }}>
                  {objects.map((obj, index) => {
                    const isSelected = selectedObject?.uuid === obj.id || selectedObject?.userData?.id === obj.id;
                    return (
                      <div
                        key={obj.id || index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(30, 41, 59, 0.6)',
                          border: isSelected ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          fontSize: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: '170px' }}>
                          <span style={{ fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {obj.name || `Object ${index + 1}`}
                          </span>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>
                            {obj.type || 'model'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            onClick={() => {
                              const threeObj = window.__objectReferences?.get(obj.id);
                              if (threeObj) setSelectedObject(threeObj);
                            }}
                            style={{
                              background: isSelected ? '#0284c7' : '#334155',
                              border: 'none',
                              color: 'white',
                              borderRadius: '4px',
                              padding: '3px 7px',
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                          >
                            {isSelected ? 'Selected' : 'Select'}
                          </button>
                          <button
                            onClick={() => removeObject(obj.id)}
                            title="Remove object from 3D World"
                            style={{
                              background: '#dc2626',
                              border: 'none',
                              color: 'white',
                              borderRadius: '4px',
                              padding: '3px 7px',
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {objects.length > 0 && (
                <button
                  onClick={() => {
                    clearObjects();
                    setSelectedObject(null);
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#fca5a5',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    width: '100%',
                    marginTop: '2px'
                  }}
                >
                  Clear All Objects
                </button>
              )}
            </div>
          )}


          {/* 3D World Controls Guide HUD */}
          <div
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '260px',
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '8px 14px',
              color: '#e2e8f0',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              zIndex: 100,
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
            <div><span style={{ color: '#38bdf8', fontWeight: 600 }}>🖱️ Click Viewport:</span> Mouse Look (<kbd style={{ background: '#334155', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>Esc</kbd> exit)</div>
            <div style={{ color: '#475569' }}>|</div>
            <div><span style={{ color: '#a78bfa', fontWeight: 600 }}>Move:</span> <kbd style={{ background: '#334155', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>W</kbd> <kbd style={{ background: '#334155', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>A</kbd> <kbd style={{ background: '#334155', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>S</kbd> <kbd style={{ background: '#334155', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>D</kbd></div>
            <div style={{ color: '#475569' }}>|</div>
            <div><span style={{ color: '#34d399', fontWeight: 600 }}>Up:</span> <kbd style={{ background: '#334155', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>Space</kbd> / <kbd style={{ background: '#334155', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>E</kbd></div>
            <div style={{ color: '#475569' }}>|</div>
            <div><span style={{ color: '#f472b6', fontWeight: 600 }}>Down:</span> <kbd style={{ background: '#334155', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>Shift</kbd> / <kbd style={{ background: '#334155', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>Q</kbd></div>
          </div>
        </>
      )}
    </>
  )
}