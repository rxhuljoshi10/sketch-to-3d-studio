'use client'

import dynamic from 'next/dynamic'
import './tldraw.css'
import { Vibe3DCodeButton } from '@/components/Vibe3DCodeButton'
import { AutoDrawButton } from '@/components/AutoDrawButton'
import { ImproveDrawingButton } from '@/components/ImproveDrawingButton'
import { PreviewShapeUtil } from '@/PreviewShape/PreviewShape'
import { Model3DPreviewShapeUtil } from '@/PreviewShape/Model3DPreviewShape'
import { useTabStore, useObjectStore } from '@/store/appStore'
import { TldrawLogo } from '@/components/TldrawLogo'

const ThreeJSCanvas = dynamic(() => import('@/components/three/canvas'), {
	ssr: false,
})

const Tldraw = dynamic(async () => (await import('@tldraw/tldraw')).Tldraw, {
	ssr: false,
})

const shapeUtils = [PreviewShapeUtil, Model3DPreviewShapeUtil]

type TabType = 'tldraw' | 'threejs'

interface TabGroupProps {
	activeTab: TabType;
	setActiveTab: (tab: TabType) => void;
}

const TabGroup = ({ activeTab, setActiveTab }: TabGroupProps) => {
	return (
		<div style={{
			position: 'fixed',
			top: '20px',
			left: '50%',
			transform: 'translateX(-50%)',
			zIndex: 9999999,
			display: 'flex',
			gap: '6px',
			padding: '6px',
			borderRadius: '8px',
			backgroundColor: 'white',
			boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
		}}>
			<button
				style={{
					padding: '6px 12px',
					border: 'none',
					borderRadius: '4px',
					backgroundColor: activeTab === 'tldraw' ? '#007bff' : '#f0f0f0',
					color: activeTab === 'tldraw' ? 'white' : 'black',
					cursor: 'pointer',
					transition: 'background-color 0.2s'
				}}
				onClick={() => setActiveTab('tldraw')}
			>
				2D Canvas
			</button>
			<button
				style={{
					padding: '6px 12px',
					border: 'none',
					borderRadius: '4px',
					backgroundColor: activeTab === 'threejs' ? '#007bff' : '#f0f0f0',
					color: activeTab === 'threejs' ? 'white' : 'black',
					cursor: 'pointer',
					transition: 'background-color 0.2s'
				}}
				onClick={() => setActiveTab('threejs')}
			>
				3D World
			</button>
		</div>
	)
}

export default function App() {
	const { activeTab, setActiveTab } = useTabStore()

	return (
		<>
			<TabGroup activeTab={activeTab} setActiveTab={setActiveTab} />
			<div className="editor">
				<div style={{
					position: 'absolute',
					width: '100%',
					height: '100%',
					visibility: activeTab === 'tldraw' ? 'visible' : 'hidden',
					zIndex: activeTab === 'tldraw' ? 2 : 1
				}}>
					<Tldraw
						persistenceKey="vibe-3d-code"
						onMount={(editor) => {
							editor.setCurrentTool('draw');
							(window as any).__tldraw_editor = editor;

							// Global deletion sync: when a model3d shape is deleted, remove corresponding 3D object
							editor.store.listen((entry) => {
								if (entry.changes && entry.changes.removed) {
									const removedRecords = Object.values(entry.changes.removed);
									for (const record of removedRecords) {
										if (record && record.typeName === 'shape' && (record as any).type === 'model3d') {
											const shapeId = record.id;
											console.log("tldraw deleted 2D model3d shape:", shapeId);
											const objectStore = useObjectStore.getState();
											const map = (window as any).__shapeToObjectMap;
											const mappedId = map ? map.get(shapeId) : null;
											const targetObj = objectStore.objects.find(
												o => o.id === (record as any).props?.objectId || 
												     o.id === mappedId || 
												     (o as any).uuid === mappedId || 
												     o.userData?.tldrawShapeId === shapeId
											);
											if (targetObj) {
												console.log("Syncing deletion to 3D world:", targetObj.id);
												objectStore.removeObject(targetObj.id);
											} else if ((record as any).props?.objectId) {
												objectStore.removeObject((record as any).props.objectId);
											} else if (mappedId) {
												objectStore.removeObject(mappedId);
											}
											if (map) map.delete(shapeId);
										}
									}
								}
							});
						}}
						shareZone={
							<div style={{ display: 'flex' }}>
								<Vibe3DCodeButton />
								<ImproveDrawingButton />
								<AutoDrawButton />
							</div>
						}
						shapeUtils={shapeUtils}
					>
						<TldrawLogo />
					</Tldraw>
				</div>
				<ThreeJSCanvas visible={activeTab === 'threejs'} />
			</div>
		</>
	)
}
