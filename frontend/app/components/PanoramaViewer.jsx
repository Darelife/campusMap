"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Fuse from "fuse.js";

import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/virtual-tour-plugin/index.css";
import "@photo-sphere-viewer/plan-plugin/index.css";
import "leaflet/dist/leaflet.css";
import { nodes } from "../data/nodes";

export default function PanoramaViewer() {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const vtRef = useRef(null);

  const [query, setQuery] = useState("");

  const fuse = useMemo(() => {
    return new Fuse(nodes, {
      keys: [
        { name: "caption", weight: 0.5 },
        { name: "locations", weight: 0.4 },
        { name: "id", weight: 0.1 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
    });
  }, [nodes]);

  const results = useMemo(() => {
    if (!query) return [];
    return fuse.search(query).map((r) => r.item);
  }, [query, fuse]);

  useEffect(() => {
    if (!containerRef.current) return;

    let viewer;
    let gpsWatchId = null;
    let gpsMarker = null;
    let leafletMap = null;

    (async () => {
      const { Viewer } = await import("@photo-sphere-viewer/core");
      const { VirtualTourPlugin } = await import(
        "@photo-sphere-viewer/virtual-tour-plugin"
      );
      const { PlanPlugin } = await import("@photo-sphere-viewer/plan-plugin");
      const L = await import("leaflet");

      viewer = new Viewer({
        container: containerRef.current,
        navbar: false,
        plugins: [
          VirtualTourPlugin.withConfig({
            positionMode: "gps",
            renderMode: "3d",
            nodes,
            startNodeId: "A12",
          }),
          PlanPlugin.withConfig({
            coordinates: [15.39239, 73.879949],
            layers: [
              {
                urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                attribution: "&copy; OpenStreetMap",
              },
            ],
            hotspots: nodes.map((node) => ({
              id: node.id,
              coordinates: [node.gps[1], node.gps[0]],
              tooltip: { content: node.caption },
            })),
          }),
        ],
      });

      viewerRef.current = viewer;
      vtRef.current = viewer.getPlugin(VirtualTourPlugin);

      vtRef.current.addEventListener("node-changed", ({ node }) => {
        console.log("[PanoramaViewer] Node changed:", { id: node.id, caption: node.caption });
      });

      viewer.addEventListener("click", (e) => {
        const yawDeg = (e.data.yaw * 180) / Math.PI;
        console.log({
          yawRad: e.data.yaw,
          yawDeg: yawDeg.toFixed(2),
          suggestedPan: `${yawDeg.toFixed(2)}deg`,
        });
      });

      // --- Live GPS marker ---
      const planPlugin = viewer.getPlugin(PlanPlugin);
      leafletMap = planPlugin.getLeaflet();

      if (navigator.geolocation && leafletMap) {
        let gpsDone = false;

        const placeMarker = (latlng) => {
          if (!gpsMarker) {
            gpsMarker = L.circleMarker(latlng, {
              radius: 7,
              fillColor: "#ff0000",
              color: "#ffffff",
              weight: 2,
              fillOpacity: 1,
            }).addTo(leafletMap);
          } else {
            gpsMarker.setLatLng(latlng);
          }
        };

        // Stage 2: one-shot low-accuracy fallback — if this also fails, give up silently
        const startLowAccuracy = () => {
          if (gpsDone) return;
          console.warn("GPS: high-accuracy failed, trying low-accuracy");
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (gpsDone) return;
              gpsDone = true;
              placeMarker(L.latLng(pos.coords.latitude, pos.coords.longitude));
            },
            (err) => {
              console.warn("GPS unavailable:", err.message);
            },
            { enableHighAccuracy: false, maximumAge: 10000, timeout: 15000 },
          );
        };

        // Stage 1: continuous high-accuracy watch (works on mobile with GPS chip)
        gpsWatchId = navigator.geolocation.watchPosition(
          (pos) => {
            gpsDone = true;
            placeMarker(L.latLng(pos.coords.latitude, pos.coords.longitude));
          },
          (err) => {
            console.warn("GPS error (high-accuracy):", err.message);
            navigator.geolocation.clearWatch(gpsWatchId);
            gpsWatchId = null;
            startLowAccuracy();
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
        );
      }
    })();

    return () => {
      if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
      }
      if (leafletMap && gpsMarker) {
        leafletMap.removeLayer(gpsMarker);
      }
      viewer?.destroy();
    };
  }, [nodes]);

  const jumpToNode = (nodeId) => {
    vtRef.current?.setCurrentNode(nodeId);
    setQuery("");
  };

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          zIndex: 10,
          width: 320,
          background: "#111",
          borderRadius: 10,
          padding: 12,
          color: "#fff",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search locations..."
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: 6,
            border: "none",
            outline: "none",
            fontSize: 14,
          }}
        />

        {results.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {results.map((node) => (
              <div
                key={node.id}
                onClick={() => jumpToNode(node.id)}
                style={{
                  padding: "8px",
                  cursor: "pointer",
                  borderRadius: 6,
                  marginBottom: 6,
                  background: "#1e1e1e",
                }}
              >
                <div style={{ fontWeight: 600 }}>{node.caption}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {node.locations.join(", ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div ref={containerRef} style={{ width: "100vw", height: "100vh" }} />
    </>
  );
}
