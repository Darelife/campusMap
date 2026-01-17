'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { Viewer } from '@photo-sphere-viewer/core'
import { VirtualTourPlugin } from '@photo-sphere-viewer/virtual-tour-plugin'
import Fuse from 'fuse.js'

import '@photo-sphere-viewer/core/index.css'
import '@photo-sphere-viewer/virtual-tour-plugin/index.css'

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
      links: [{ nodeId: 'A13' }],
    },
    {
      id: 'A13',
      panorama: '/A13.jpg',
      caption: 'Library Entrance',
      gps: [73.880232, 15.391779, 0],
      locations: ['Library', 'Books Section', 'Reading Hall', 'Main Building'],
      sphereCorrection: { pan: '251.69deg' },
      links: [{ nodeId: 'A14' }],
    },
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

    const viewer = new Viewer({
      container: containerRef.current,
      navbar: false,
      plugins: [
        VirtualTourPlugin.withConfig({
          positionMode: 'gps',
          renderMode: '3d',
          nodes,
          startNodeId: 'A13',
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

    return () => viewer.destroy()
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
