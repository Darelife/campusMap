'use client'

import { useEffect, useRef } from 'react'
import { Viewer } from '@photo-sphere-viewer/core'
import { VirtualTourPlugin } from '@photo-sphere-viewer/virtual-tour-plugin'

import '@photo-sphere-viewer/core/index.css'
import '@photo-sphere-viewer/virtual-tour-plugin/index.css'

export default function PanoramaViewer() {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    const nodes = [
      {
        id: 'A14',
        panorama: '/A14.jpg',
        caption: 'D Spine Entrance',
        gps: [73.880465, 15.391935, 0],
        sphereCorrection: {
          pan: '280.70deg',
        },
        links: [{ nodeId: 'A13', gps: [73.880232, 15.391779 , 0] }],
      },
      {
        id: 'A13',
        panorama: '/A13.jpg',
        caption: 'Corridor',
        gps: [73.880232, 15.391779 , 0],
        sphereCorrection: {
          pan: '251.69deg',
        },
        links: [{ nodeId: 'A14' , gps: [73.880465, 15.391935, 0]}],
      },
    ]


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
    viewer.addEventListener('click', (e) => {
      const yawRad = e.data.yaw
      const yawDeg = yawRad * 180 / Math.PI

      const panDeg = yawDeg

      console.log({
        yawRad,
        yawDeg: yawDeg.toFixed(2),
        suggestedPan: `${panDeg.toFixed(2)}deg`,
      })
    })



    return () => viewer.destroy()
  }, [])

  

  return (
    <div
      ref={containerRef}
      style={{ width: '100vw', height: '100vh' }}
    />
  )
}
