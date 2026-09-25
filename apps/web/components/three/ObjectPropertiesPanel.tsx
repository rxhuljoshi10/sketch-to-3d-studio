"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { useAppStore, useObjectStore } from '@/store/appStore'

// ── Types ──────────────────────────────────────────────────────────────────
type MaterialPreset = 'standard' | 'metal' | 'glass' | 'emissive' | 'plastic' | 'matte'

interface MaterialPresetConfig {
  label: string
  emoji: string
  metalness: number
  roughness: number
  transparent: boolean
  opacity: number
  emissiveIntensity: number
}

const MATERIAL_PRESETS: Record<MaterialPreset, MaterialPresetConfig> = {
  standard: { label: 'Standard', emoji: '🔲', metalness: 0.1, roughness: 0.7,  transparent: false, opacity: 1,    emissiveIntensity: 0 },
  plastic:  { label: 'Plastic',  emoji: '🧩', metalness: 0,   roughness: 0.4,  transparent: false, opacity: 1,    emissiveIntensity: 0 },
  matte:    { label: 'Matte',    emoji: '🪨', metalness: 0,   roughness: 1.0,  transparent: false, opacity: 1,    emissiveIntensity: 0 },
  metal:    { label: 'Metal',    emoji: '⚙️', metalness: 1.0, roughness: 0.15, transparent: false, opacity: 1,    emissiveIntensity: 0 },
  glass:    { label: 'Glass',    emoji: '🪟', metalness: 0,   roughness: 0,    transparent: true,  opacity: 0.35, emissiveIntensity: 0 },
  emissive: { label: 'Glow',     emoji: '💡', metalness: 0,   roughness: 0.5,  transparent: false, opacity: 1,    emissiveIntensity: 2 },
}

const QUICK_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#a855f7', '#ec4899',
  '#ffffff', '#94a3b8', '#334155', '#0f172a',
]

// ── Helpers ────────────────────────────────────────────────────────────────
function collectMeshes(obj: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = []
  obj.traverse(child => { if (child instanceof THREE.Mesh) meshes.push(child) })
  return meshes
}

function getObjectColor(obj: THREE.Object3D): string {
  const meshes = collectMeshes(obj)
  if (meshes.length === 0) return '#ffffff'
  const mat = Array.isArray(meshes[0].material) ? meshes[0].material[0] : meshes[0].material
  if (mat && 'color' in mat) return '#' + (mat as THREE.MeshStandardMaterial).color.getHexString()
  return '#ffffff'
}

const snap = (v: number, d = 3) => parseFloat(v.toFixed(d))

type TransformField = 'px'|'py'|'pz'|'rx'|'ry'|'rz'|'sx'|'sy'|'sz'

// ── Styles ─────────────────────────────────────────────────────────────────
const btnStyle = (bg: string): React.CSSProperties => ({
  background: bg, border: 'none', borderRadius: '5px', padding: '4px 7px',
  color: 'white', cursor: 'pointer', fontSize: '13px', lineHeight: 1, transition: 'opacity 0.15s',
})

const smallActionBtn: React.CSSProperties = {
  flex: 1, padding: '4px 2px',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '4px', color: '#64748b', cursor: 'pointer', fontSize: '10px', transition: 'all 0.15s',
}

// ── Sub-components ─────────────────────────────────────────────────────────
function Section({
  label, sectionKey, collapsed, toggle, children
}: {
  label: string; sectionKey: string; collapsed: Record<string, boolean>
  toggle: (k: string) => void; children: React.ReactNode
}) {
  const isCollapsed = collapsed[sectionKey]
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <button
        onClick={() => toggle(sectionKey)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '9px 14px', background: 'transparent',
          border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '11px',
          fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
        onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
      >
        <span>{label}</span>
        <span style={{ fontSize: '10px', opacity: 0.6 }}>{isCollapsed ? '▶' : '▼'}</span>
      </button>
      {!isCollapsed && <div style={{ padding: '4px 14px 12px' }}>{children}</div>}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
      <span style={{ color: '#64748b', fontSize: '11px', flexShrink: 0, marginRight: '8px' }}>{label}</span>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>{children}</div>
    </div>
  )
}

function TransformGroup({
  label, suffix, values, setters, fields, applyTransform
}: {
  label: string; suffix: string; values: [string, string, string]
  setters: [(v: string) => void, (v: string) => void, (v: string) => void]
  fields: [TransformField, TransformField, TransformField]
  applyTransform: (field: TransformField, raw: string) => void
}) {
  const axes = ['X', 'Y', 'Z']
  const axisColors = ['#f87171', '#4ade80', '#60a5fa']

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        {axes.map((axis, i) => (
          <div key={axis} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <span style={{ color: axisColors[i], fontSize: '9px', fontWeight: 700, flexShrink: 0 }}>{axis}</span>
              <input
                type="number"
                value={values[i]}
                onChange={e => setters[i](e.target.value)}
                onBlur={e => applyTransform(fields[i], e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') applyTransform(fields[i], (e.target as HTMLInputElement).value)
                }}
                onClick={e => e.stopPropagation()}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
                  color: '#e2e8f0', fontSize: '11px', padding: '3px 4px',
                  outline: 'none', minWidth: 0, fontFamily: 'monospace',
                }}
                onFocus={e => { e.target.style.borderColor = axisColors[i]; e.target.style.background = 'rgba(255,255,255,0.1)' }}
                onBlurCapture={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(255,255,255,0.06)' }}
              />
            </div>
          </div>
        ))}
        <span style={{ color: '#475569', fontSize: '9px', alignSelf: 'center', flexShrink: 0 }}>{suffix}</span>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export function ObjectPropertiesPanel() {
  const { selectedObject, setSelectedObject } = useAppStore()
  const { updateObject, removeObject } = useObjectStore()

  const [color, setColor]             = useState('#ffffff')
  const [opacity, setOpacity]         = useState(1)
  const [wireframe, setWireframe]     = useState(false)
  const [preset, setPreset]           = useState<MaterialPreset>('standard')
  const [name, setName]               = useState('')
  const [nameEditing, setNameEditing] = useState(false)
  const [collapsed, setCollapsed]     = useState<Record<string, boolean>>({
    transform: false, material: false,
  })

  const [posX, setPosX] = useState('0'); const [posY, setPosY] = useState('0'); const [posZ, setPosZ] = useState('0')
  const [rotX, setRotX] = useState('0'); const [rotY, setRotY] = useState('0'); const [rotZ, setRotZ] = useState('0')
  const [scaX, setScaX] = useState('1'); const [scaY, setScaY] = useState('1'); const [scaZ, setScaZ] = useState('1')

  const objRef = useRef<THREE.Object3D | null>(null)

  // Sync local state when selection changes
  useEffect(() => {
    if (!selectedObject) { objRef.current = null; return }
    objRef.current = selectedObject
    setColor(getObjectColor(selectedObject))
    setName(selectedObject.userData?.name || selectedObject.name || 'Object')
    setNameEditing(false)

    const meshes = collectMeshes(selectedObject)
    if (meshes.length > 0) {
      const mat = Array.isArray(meshes[0].material) ? meshes[0].material[0] : meshes[0].material
      if (mat instanceof THREE.MeshStandardMaterial) {
        setOpacity(mat.opacity ?? 1)
        setWireframe(mat.wireframe ?? false)
      }
    }

    const p = selectedObject.position, r = selectedObject.rotation, s = selectedObject.scale
    setPosX(snap(p.x).toString()); setPosY(snap(p.y).toString()); setPosZ(snap(p.z).toString())
    setRotX(snap(THREE.MathUtils.radToDeg(r.x)).toString())
    setRotY(snap(THREE.MathUtils.radToDeg(r.y)).toString())
    setRotZ(snap(THREE.MathUtils.radToDeg(r.z)).toString())
    setScaX(snap(s.x).toString()); setScaY(snap(s.y).toString()); setScaZ(snap(s.z).toString())
    setPreset('standard')
  }, [selectedObject])

  // Poll transform to keep panel in sync with gizmo moves
  useEffect(() => {
    if (!selectedObject) return
    const interval = setInterval(() => {
      const o = objRef.current; if (!o) return
      const p = o.position, r = o.rotation, s = o.scale
      setPosX(snap(p.x).toString()); setPosY(snap(p.y).toString()); setPosZ(snap(p.z).toString())
      setRotX(snap(THREE.MathUtils.radToDeg(r.x)).toString())
      setRotY(snap(THREE.MathUtils.radToDeg(r.y)).toString())
      setRotZ(snap(THREE.MathUtils.radToDeg(r.z)).toString())
      setScaX(snap(s.x).toString()); setScaY(snap(s.y).toString()); setScaZ(snap(s.z).toString())
    }, 150)
    return () => clearInterval(interval)
  }, [selectedObject])

  // ── material helpers ────────────────────────────────────────────────────
  const persistMaterial = useCallback((o: THREE.Object3D) => {
    const id = o.userData?.id || o.uuid
    const meshes = collectMeshes(o); if (meshes.length === 0) return
    const mat = Array.isArray(meshes[0].material) ? meshes[0].material[0] : meshes[0].material
    if (mat instanceof THREE.MeshStandardMaterial) {
      updateObject(id, {
        material: {
          type: mat.type, color: mat.color.getHexString(),
          parameters: { metalness: mat.metalness, roughness: mat.roughness, opacity: mat.opacity, transparent: mat.transparent }
        }
      })
    }
  }, [updateObject])

  const applyColor = useCallback((hex: string) => {
    const o = objRef.current; if (!o) return
    const c = new THREE.Color(hex)
    collectMeshes(o).forEach(mesh => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach(mat => { if ('color' in mat) (mat as THREE.MeshStandardMaterial).color.copy(c); mat.needsUpdate = true })
    })
    setColor(hex)
    persistMaterial(o)
  }, [persistMaterial])

  const applyOpacity = useCallback((val: number) => {
    const o = objRef.current; if (!o) return
    collectMeshes(o).forEach(mesh => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach(mat => { mat.transparent = val < 1; mat.opacity = val; mat.needsUpdate = true })
    })
    setOpacity(val)
    persistMaterial(o)
  }, [persistMaterial])

  const applyWireframe = useCallback((val: boolean) => {
    const o = objRef.current; if (!o) return
    collectMeshes(o).forEach(mesh => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach(mat => { if ('wireframe' in mat) (mat as THREE.MeshStandardMaterial).wireframe = val; mat.needsUpdate = true })
    })
    setWireframe(val)
    persistMaterial(o)
  }, [persistMaterial])

  const applyPreset = useCallback((p: MaterialPreset) => {
    const o = objRef.current; if (!o) return
    const cfg = MATERIAL_PRESETS[p]
    const currentColor = new THREE.Color(color)
    collectMeshes(o).forEach(mesh => {
      const newMat = new THREE.MeshStandardMaterial({
        color: currentColor, metalness: cfg.metalness, roughness: cfg.roughness,
        transparent: cfg.transparent, opacity: cfg.opacity, side: THREE.DoubleSide, wireframe: wireframe,
      })
      if (cfg.emissiveIntensity > 0) {
        newMat.emissive = currentColor.clone().multiplyScalar(0.5)
        newMat.emissiveIntensity = cfg.emissiveIntensity
      }
      mesh.material = newMat
    })
    setOpacity(cfg.opacity)
    setPreset(p)
    persistMaterial(o)
  }, [color, wireframe, persistMaterial])

  // ── transform helpers ───────────────────────────────────────────────────
  const applyTransform = useCallback((field: TransformField, raw: string) => {
    const num = parseFloat(raw); if (isNaN(num)) return
    const o = objRef.current; if (!o) return
    switch (field) {
      case 'px': o.position.x = num; break; case 'py': o.position.y = num; break; case 'pz': o.position.z = num; break
      case 'rx': o.rotation.x = THREE.MathUtils.degToRad(num); break
      case 'ry': o.rotation.y = THREE.MathUtils.degToRad(num); break
      case 'rz': o.rotation.z = THREE.MathUtils.degToRad(num); break
      case 'sx': o.scale.x = num; break; case 'sy': o.scale.y = num; break; case 'sz': o.scale.z = num; break
    }
    const id = o.userData?.id || o.uuid
    updateObject(id, {
      position: [o.position.x, o.position.y, o.position.z],
      rotation: [o.rotation.x, o.rotation.y, o.rotation.z],
      scale: [o.scale.x, o.scale.y, o.scale.z],
    })
  }, [updateObject])

  const applyName = useCallback((newName: string) => {
    const o = objRef.current; if (!o) return
    o.userData.name = newName; o.name = newName
    const id = o.userData?.id || o.uuid
    updateObject(id, { name: newName, userData: { ...o.userData } })
    setName(newName); setNameEditing(false)
  }, [updateObject])

  const toggle = (key: string) => setCollapsed(c => ({ ...c, [key]: !c[key] }))

  if (!selectedObject) return null

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div
      id="object-properties-panel"
      style={{
        position: 'fixed', top: '80px', right: '16px',
        width: '260px', maxHeight: 'calc(100vh - 100px)', overflowY: 'auto',
        background: 'rgba(8, 14, 30, 0.92)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(99, 179, 237, 0.2)', borderRadius: '14px', padding: '0',
        color: '#e2e8f0', zIndex: 9990,
        boxShadow: '0 25px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,179,237,0.08)',
        fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '12px',
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,179,237,0.2) transparent',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(99,179,237,0.06)', borderRadius: '14px 14px 0 0',
        position: 'sticky', top: 0, zIndex: 1, backdropFilter: 'blur(20px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
          <span style={{ fontSize: '16px' }}>🎨</span>
          {nameEditing ? (
            <input
              autoFocus value={name}
              onChange={e => setName(e.target.value)}
              onBlur={() => applyName(name)}
              onKeyDown={e => e.key === 'Enter' && applyName(name)}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(99,179,237,0.5)',
                borderRadius: '4px', color: '#e2e8f0', fontSize: '12px', fontWeight: 700,
                padding: '2px 6px', width: '100%', outline: 'none',
              }}
            />
          ) : (
            <span
              title="Click to rename" onClick={() => setNameEditing(true)}
              style={{
                fontWeight: 700, fontSize: '13px', color: '#63b3ed', cursor: 'pointer',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px',
                borderBottom: '1px dashed rgba(99,179,237,0.4)',
              }}
            >{name}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button
            title="Delete object"
            onClick={() => { const id = selectedObject.userData?.id || selectedObject.uuid; removeObject(id); setSelectedObject(null) }}
            style={btnStyle('#dc2626')}
          >🗑️</button>
          <button title="Deselect" onClick={() => setSelectedObject(null)} style={btnStyle('rgba(255,255,255,0.08)')}>✕</button>
        </div>
      </div>

      {/* Material Section */}
      <Section label="🎨 Material" sectionKey="material" collapsed={collapsed} toggle={toggle}>
        {/* Color row */}
        <Row label="Color">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="color" value={color} onChange={e => applyColor(e.target.value)}
              style={{ width: '32px', height: '24px', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '1px', background: 'transparent' }}
            />
            <span style={{ color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace' }}>{color}</span>
          </div>
        </Row>

        {/* Quick swatches */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
          {QUICK_COLORS.map(c => (
            <button
              key={c} title={c} onClick={() => applyColor(c)}
              style={{
                width: '20px', height: '20px', borderRadius: '4px', background: c,
                border: color === c ? '2px solid #63b3ed' : '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer', flexShrink: 0, boxShadow: color === c ? '0 0 0 1px #63b3ed' : 'none',
              }}
            />
          ))}
        </div>

        {/* Preset chips */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>
            Material Preset
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {(Object.keys(MATERIAL_PRESETS) as MaterialPreset[]).map(p => (
              <button
                key={p} onClick={() => applyPreset(p)}
                style={{
                  padding: '3px 8px', fontSize: '11px',
                  background: preset === p ? 'rgba(99,179,237,0.25)' : 'rgba(255,255,255,0.06)',
                  border: preset === p ? '1px solid rgba(99,179,237,0.6)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '20px', color: preset === p ? '#63b3ed' : '#94a3b8',
                  cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: '3px',
                }}
              >
                <span>{MATERIAL_PRESETS[p].emoji}</span>
                <span>{MATERIAL_PRESETS[p].label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Opacity */}
        <Row label={`Opacity ${Math.round(opacity * 100)}%`}>
          <input
            type="range" min="0" max="1" step="0.01" value={opacity}
            onChange={e => applyOpacity(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#63b3ed' }}
          />
        </Row>

        {/* Wireframe */}
        <Row label="Wireframe">
          <button
            onClick={() => applyWireframe(!wireframe)}
            style={{
              padding: '2px 10px', fontSize: '11px', borderRadius: '20px',
              background: wireframe ? 'rgba(99,179,237,0.25)' : 'rgba(255,255,255,0.06)',
              border: wireframe ? '1px solid rgba(99,179,237,0.6)' : '1px solid rgba(255,255,255,0.1)',
              color: wireframe ? '#63b3ed' : '#94a3b8', cursor: 'pointer', transition: 'all 0.15s',
            }}
          >{wireframe ? '✓ ON' : 'OFF'}</button>
        </Row>
      </Section>

      {/* Transform Section */}
      <Section label="📐 Transform" sectionKey="transform" collapsed={collapsed} toggle={toggle}>
        <TransformGroup
          label="Position" suffix="m"
          values={[posX, posY, posZ]} setters={[setPosX, setPosY, setPosZ]}
          fields={['px','py','pz']} applyTransform={applyTransform}
        />
        <TransformGroup
          label="Rotation" suffix="°"
          values={[rotX, rotY, rotZ]} setters={[setRotX, setRotY, setRotZ]}
          fields={['rx','ry','rz']} applyTransform={applyTransform}
        />
        <TransformGroup
          label="Scale" suffix="×"
          values={[scaX, scaY, scaZ]} setters={[setScaX, setScaY, setScaZ]}
          fields={['sx','sy','sz']} applyTransform={applyTransform}
        />

        {/* Quick reset row */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
          <button
            onClick={() => { const o = objRef.current; if (!o) return; o.position.set(0,0,0); updateObject(o.userData?.id||o.uuid,{position:[0,0,0]}) }}
            style={smallActionBtn}
          >↺ Pos</button>
          <button
            onClick={() => { const o = objRef.current; if (!o) return; o.rotation.set(0,0,0); updateObject(o.userData?.id||o.uuid,{rotation:[0,0,0]}) }}
            style={smallActionBtn}
          >↺ Rot</button>
          <button
            onClick={() => { const o = objRef.current; if (!o) return; o.scale.set(1,1,1); updateObject(o.userData?.id||o.uuid,{scale:[1,1,1]}) }}
            style={smallActionBtn}
          >↺ Scale</button>
        </div>
      </Section>

      <div style={{ height: '8px' }} />
    </div>
  )
}
