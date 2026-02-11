'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import Fuse from 'fuse.js'

import '@photo-sphere-viewer/core/index.css'
import '@photo-sphere-viewer/virtual-tour-plugin/index.css'
import '@photo-sphere-viewer/plan-plugin/index.css'
import 'leaflet/dist/leaflet.css'

export default function PanoramaViewer() {
  const containerRef = useRef(null)
  const viewerRef = useRef(null)
  const vtRef = useRef(null)

  const [query, setQuery] = useState('')

  const nodes = useMemo(() => ([
    {
      id: 'A14',
      panorama: '/A14.jpg',
      caption: 'D Spine Entrance',
      gps: [73.880465, 15.391935, 0],
      locations: ['D Spine', 'Entrance', 'Hostel Road', 'Main Corridor'],
      sphereCorrection: { pan: '280.70deg' },
      links: [{ nodeId: 'A13' }, { nodeId: 'A15' }],
    },
    {
      id: 'A13',
      panorama: '/A13.jpg',
      caption: 'Library Entrance',
      gps: [73.880232, 15.391779, 0],
      locations: ['Library', 'Books Section', 'Reading Hall', 'Main Building'],
      sphereCorrection: { pan: '251.69deg' },
      links: [{ nodeId: 'A14' }, { nodeId: 'A12' }],
    },
    {
      id: 'A12',
      panorama: '/A12.jpg',
      caption: 'B Dome Front',
      gps: [73.879949, 15.392390, 0],
      locations: ['Main Building', 'BDome', 'B Dome', 'Central'],
      sphereCorrection: { pan: '-59.69deg' },
      links: [{ nodeId: 'A13' }, { nodeId: 'A11' }],
    },
    {
      id: 'A11',
      panorama: '/A11.jpg',
      caption: 'B Dome Side',
      gps: [73.879439, 15.392513, 0],
      locations: ['BDome', 'AH1', 'INS'],
      sphereCorrection: { pan: '220.04deg' },
      links: [{ nodeId: 'A12' }],
    },
    {
      id: 'A15',
      panorama: '/A15.jpg',
      caption: 'D Spine Library-Bdome Intersection',
      gps: [73.880739, 15.391952, 0],
      locations: ['D Spine', 'Library', 'Bdome', 'Intersection'],
      sphereCorrection: { pan: '12.70deg' },
      links: [{ nodeId: 'A14' }, { nodeId: 'A16' }],
    },
    {
      id: 'A16',
      panorama: '/A16.jpg',
      caption: 'D Spine CC Intersection',
      gps: [73.880944, 15.391997, 0],
      locations: ['D Spine', 'CC', 'Subspot', 'Amul', 'CC Lab'],
      sphereCorrection: { pan: '349.26deg' },
      links: [{ nodeId: 'A15' }, { nodeId: 'A17' }],
    },
    {
      id: 'A17',
      panorama: '/A17.jpg',
      caption: 'D Spine Center',
      gps: [73.881381, 15.392110, 0],
      locations: ['D Spine', 'Center', 'Plant'],
      sphereCorrection: { pan: '250.36deg' },
      links: [{ nodeId: 'A16' }, { nodeId: 'A18' }],
    },
    {
      id: 'A18',
      panorama: '/A18.jpg',
      caption: 'D Spine Phoenix',
      gps: [73.881876, 15.392236, 0],
      locations: ['D Spine', 'Phoenix Dept'],
      sphereCorrection: { pan: '200.60deg' },
      links: [{ nodeId: 'A17' }, { nodeId: 'A19' }],
    },
    {
      id: 'A19',
      panorama: '/A19.jpg',
      caption: 'D Spine Snake Path',
      gps: [73.882161, 15.392325, 0],
      locations: ['D Spine', 'Snake Path'],
      sphereCorrection: { pan: '20.00deg' },
      links: [{ nodeId: 'A18' }, { nodeId: 'A20' }],
    },
    {
      id: 'A20',
      panorama: '/A20.jpg',
      caption: 'D Spine CS Dept',
      gps: [73.882419, 15.392385, 0],
      locations: ['D Spine', 'CS Dept'],
      sphereCorrection: { pan: '284.98deg' },
      links: [{ nodeId: 'A19' }, { nodeId: 'A21' }, { nodeId: 'A22' }],
    },
    {
      id: 'A21',
      panorama: '/A21.jpg',
      caption: 'D Spine Hostel Intersection',
      gps: [73.882750, 15.392481, 0],
      locations: ['D Spine', 'Hostel Intersection', 'Hostel Road'],
      sphereCorrection: { pan: '284.98deg' },
      links: [{ nodeId: 'A20' }],
    },
    {
      id: 'A22',
      panorama: '/A22.jpg',
      caption: 'CS Dept Imaginarium',
      gps: [73.882533, 15.392142, 0],
      locations: ['CS Dept', 'Imaginarium', 'DLT 7', 'DLT 8'],
      sphereCorrection: { pan: '180.14deg' },
      links: [{ nodeId: 'A20' }, { nodeId: 'A23' }],
    },
    {
      id: 'A23',
      panorama: '/A23.jpg',
      caption: 'CS Dept D151',
      gps: [73.88258659294941, 15.392057935008628, 0],
      locations: ['CS Dept', 'D151', 'Washroom', 'D 151'],
      sphereCorrection: { pan: '200.14deg' },
      links: [{ nodeId: 'A22' }, { nodeId: 'A24' }],
    },
    {
      id: 'A24',
      panorama: '/A24.jpg',
      caption: 'CS Dept D153',
      gps: [73.88263889602477, 15.391859459103431, 0],
      locations: ['CS Dept', 'D153', 'Washroom', 'D 153'],
      sphereCorrection: { pan: '210.14deg' },
      links: [{ nodeId: 'A23' }, { nodeId: 'A25' }],
    },
    {
      id: 'A25',
      panorama: '/A25.jpg',
      caption: 'CS Dept D153',
      gps: [73.88251886717195, 15.391843943063517, 0],
      locations: ['CS Dept', 'CSIS Conference Room', 'Conference Room', 'Hemant Rathore', 'D155', 'D 155', 'D156', 'D 156'],
      sphereCorrection: { pan: '160.14deg' },
      links: [{ nodeId: 'A24' }],
    }
  ]), [])

  const fuse = useMemo(() => {
    return new Fuse(nodes, {
      keys: [
        { name: 'caption', weight: 0.5 },
        { name: 'locations', weight: 0.4 },
        { name: 'id', weight: 0.1 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
    })
  }, [nodes])


  const results = useMemo(() => {
    if (!query) return []
    return fuse.search(query).map(r => r.item)
  }, [query, fuse])

  useEffect(() => {
    if (!containerRef.current) return

    let viewer; // Define viewer in scope for cleanup

    (async () => {
      const { Viewer } = await import('@photo-sphere-viewer/core')
      const { VirtualTourPlugin } = await import('@photo-sphere-viewer/virtual-tour-plugin')
      const { PlanPlugin } = await import('@photo-sphere-viewer/plan-plugin')
      await import('leaflet') // Ensure leaflet is loaded

      viewer = new Viewer({
        container: containerRef.current,
        navbar: false,
        plugins: [
          VirtualTourPlugin.withConfig({
            positionMode: 'gps',
            renderMode: '3d',
            nodes,
            startNodeId: 'A12',
          }),
          PlanPlugin.withConfig({
            coordinates: [15.392390, 73.879949],
            layers: [
              {
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                attribution: '&copy; OpenStreetMap',
              },
            ],
            hotspots: nodes.map(node => ({
              id: node.id,
              coordinates: [node.gps[1], node.gps[0]],
              tooltip: { content: node.caption },
            })),
          }),
        ],
      })

      viewerRef.current = viewer
      vtRef.current = viewer.getPlugin(VirtualTourPlugin)

      viewer.addEventListener('click', (e) => {
        const yawDeg = e.data.yaw * 180 / Math.PI
        console.log({
          yawRad: e.data.yaw,
          yawDeg: yawDeg.toFixed(2),
          suggestedPan: `${yawDeg.toFixed(2)}deg`,
        })
      })
    })()

    return () => viewer?.destroy()
  }, [nodes])

  const jumpToNode = (nodeId) => {
    vtRef.current?.setCurrentNode(nodeId)
    setQuery('')
  }

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          zIndex: 10,
          width: 320,
          background: '#111',
          borderRadius: 10,
          padding: 12,
          color: '#fff',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search locations..."
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: 6,
            border: 'none',
            outline: 'none',
            fontSize: 14,
          }}
        />

        {results.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {results.map(node => (
              <div
                key={node.id}
                onClick={() => jumpToNode(node.id)}
                style={{
                  padding: '8px',
                  cursor: 'pointer',
                  borderRadius: 6,
                  marginBottom: 6,
                  background: '#1e1e1e',
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {node.caption}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {node.locations.join(', ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      <div
        ref={containerRef}
        style={{ width: '100vw', height: '100vh' }}
      />
    </>
  )
}
