"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
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

  // --- Search state ---
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  // --- Directions state ---
  const [directionsMode, setDirectionsMode] = useState(false);
  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [fromNode, setFromNode] = useState(null);
  const [toNode, setToNode] = useState(null);
  const [activeDirField, setActiveDirField] = useState(null); // 'from' | 'to'
  const [dirResults, setDirResults] = useState([]);
  const [path, setPath] = useState([]); // active path node IDs
  const [hasSearched, setHasSearched] = useState(false); // only true after clicking Go

  // --- Fuse search ---
  const fuse = useMemo(
    () =>
      new Fuse(nodes, {
        keys: [
          { name: "caption", weight: 0.5 },
          { name: "locations", weight: 0.4 },
          { name: "id", weight: 0.1 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    []
  );

  const searchResults = useMemo(() => {
    if (!query || !showResults) return [];
    return fuse.search(query).map((r) => r.item);
  }, [query, showResults, fuse]);

  // --- Dijkstra pathfinding (weighted by GPS Euclidean distance) ---
  const findPath = useCallback((startId, endId) => {
    if (!startId || !endId || startId === endId) return [];
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // GPS distance in arbitrary units (lon/lat degrees treated as flat — fine for a campus)
    const gpsDist = (aId, bId) => {
      const a = nodeMap.get(aId);
      const b = nodeMap.get(bId);
      if (!a || !b) return Infinity;
      const dLon = a.gps[0] - b.gps[0];
      const dLat = a.gps[1] - b.gps[1];
      return Math.sqrt(dLon * dLon + dLat * dLat);
    };

    const dist = new Map();     // nodeId → best cost so far
    const prev = new Map();     // nodeId → previous nodeId
    const visited = new Set();

    for (const n of nodes) dist.set(n.id, Infinity);
    dist.set(startId, 0);

    // Simple priority queue using a sorted array (campus is small enough)
    const pq = [{ id: startId, cost: 0 }];

    while (pq.length > 0) {
      pq.sort((a, b) => a.cost - b.cost);
      const { id: u } = pq.shift();
      if (visited.has(u)) continue;
      if (u === endId) break;
      visited.add(u);

      const node = nodeMap.get(u);
      if (!node?.links) continue;

      for (const link of node.links) {
        const v = link.nodeId;
        if (visited.has(v)) continue;
        const alt = dist.get(u) + gpsDist(u, v);
        if (alt < (dist.get(v) ?? Infinity)) {
          dist.set(v, alt);
          prev.set(v, u);
          pq.push({ id: v, cost: alt });
        }
      }
    }

    if (!prev.has(endId) && startId !== endId) return [];
    const path = [];
    let cur = endId;
    while (cur !== undefined) {
      path.unshift(cur);
      cur = prev.get(cur);
    }
    return path[0] === startId ? path : [];
  }, []);

  // Build the node list to hand to setNodes, with blue arrowStyle on path links
  const buildPathNodes = useCallback(
    (activePath) => {
      if (activePath.length < 2) return nodes;
      return nodes.map((node) => {
        const idx = activePath.indexOf(node.id);
        if (idx !== -1 && idx < activePath.length - 1) {
          const nextId = activePath[idx + 1];
          return {
            ...node,
            links: node.links.map((link) =>
              link.nodeId === nextId
                ? {
                  ...link,
                  arrowStyle: {
                    // Using style dict — the only supported way in this plugin
                    style: { color: "#2563eb" },
                    className: "path-arrow",
                  },
                }
                : link
            ),
          };
        }
        return node;
      });
    },
    []
  );

  // --- Viewer setup (runs once) ---
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
            startNodeId: "Entrance",
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
        const startLowAccuracy = () => {
          if (gpsDone) return;
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (gpsDone) return;
              gpsDone = true;
              placeMarker(L.latLng(pos.coords.latitude, pos.coords.longitude));
            },
            (err) => console.warn("GPS unavailable:", err.message),
            { enableHighAccuracy: false, maximumAge: 10000, timeout: 15000 }
          );
        };
        gpsWatchId = navigator.geolocation.watchPosition(
          (pos) => {
            gpsDone = true;
            placeMarker(L.latLng(pos.coords.latitude, pos.coords.longitude));
          },
          (err) => {
            console.warn("GPS error:", err.message);
            navigator.geolocation.clearWatch(gpsWatchId);
            gpsWatchId = null;
            startLowAccuracy();
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
      }
    })();

    return () => {
      if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
      viewer?.destroy();
    };
  }, []);

  // --- Directions search ---
  const handleDirSearch = (value, field) => {
    if (field === "from") {
      setFromQuery(value);
      setFromNode(null);
    } else {
      setToQuery(value);
      setToNode(null);
    }
    if (value.trim()) {
      setDirResults(fuse.search(value).map((r) => r.item));
    } else {
      setDirResults([]);
    }
    setActiveDirField(field);
  };

  const selectDirResult = (node) => {
    if (activeDirField === "from") {
      setFromNode(node);
      setFromQuery(node.caption);
    } else {
      setToNode(node);
      setToQuery(node.caption);
    }
    setDirResults([]);
    setActiveDirField(null);
  };

  // --- Go handler ---
  const handleGo = () => {
    if (!fromNode || !toNode) return;
    const newPath = findPath(fromNode.id, toNode.id);
    setPath(newPath);
    setHasSearched(true);
    if (vtRef.current) {
      vtRef.current.setNodes(buildPathNodes(newPath), fromNode.id);
    }
  };

  // --- Reset directions ---
  const handleReset = () => {
    setFromNode(null);
    setFromQuery("");
    setToNode(null);
    setToQuery("");
    setPath([]);
    setHasSearched(false);
    setDirResults([]);
    setActiveDirField(null);
    if (vtRef.current) {
      const currentId = vtRef.current.currentNode?.id;
      vtRef.current.setNodes(nodes, currentId);
    }
  };

  // --- Toggle directions mode ---
  const openDirections = () => {
    setDirectionsMode(true);
    setShowResults(false);
    setQuery("");
    // Pre-fill From with current node
    const currentId = vtRef.current?.currentNode?.id;
    const current = nodes.find((n) => n.id === currentId);
    if (current) {
      setFromNode(current);
      setFromQuery(current.caption);
    }
  };

  const closeDirections = () => {
    setDirectionsMode(false);
    setHasSearched(false);
    handleReset();
  };

  // --- Jump from search ---
  const handleSearchSelect = (node) => {
    vtRef.current?.setCurrentNode(node.id);
    setQuery("");
    setShowResults(false);
  };

  const canGo = fromNode && toNode;

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

        * { box-sizing: border-box; }

        .psv-plan-container {
          bottom: 20px !important;
          right: 10px !important;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
          overflow: hidden;
        }

        @media (max-width: 600px) {
          .psv-plan-container {
            width: 130px !important;
            height: 130px !important;
            bottom: 70px !important;
          }
          .map-ui {
            width: calc(100vw - 24px) !important;
            left: 12px !important;
          }
        }

        /* Blue path arrows */
        .path-arrow svg {
          fill: #2563eb !important;
          filter: drop-shadow(0 0 6px #2563eb99);
        }
        .path-arrow {
          filter: drop-shadow(0 0 4px #2563ebaa);
        }

        .map-input {
          width: 100%;
          background: #f5f5f5;
          border: 1.5px solid transparent;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          color: #111;
          outline: none;
          transition: border-color 0.15s;
        }
        .map-input:focus {
          border-color: #2563eb;
          background: #fff;
        }
        .map-input::placeholder { color: #999; }

        .result-item {
          display: block;
          width: 100%;
          padding: 10px 12px;
          text-align: left;
          background: none;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: background 0.12s;
        }
        .result-item:hover { background: #f0f4ff; }

        .blue-btn {
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 11px 18px;
          font-size: 14px;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: background 0.15s;
        }
        .blue-btn:hover { background: #1d4ed8; }
        .blue-btn:disabled {
          background: #a5b4fc;
          cursor: not-allowed;
        }

        .icon-btn {
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          padding: 6px;
          transition: background 0.12s;
          color: #555;
        }
        .icon-btn:hover { background: #f0f0f0; }
      `}</style>

      {/* ── Main UI card ── */}
      <div
        className="map-ui"
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 10,
          width: 320,
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 2px 16px rgba(0,0,0,0.18)",
          fontFamily: "'Inter', sans-serif",
          overflow: "visible",
        }}
      >
        {/* ── Search mode ── */}
        {!directionsMode && (
          <div style={{ padding: "10px 12px", display: "flex", gap: 8, alignItems: "center" }}>
            {/* Search icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              className="map-input"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 150)}
              placeholder="Search campus..."
              style={{ background: "transparent", border: "none", borderRadius: 0, padding: "4px 0", fontSize: 15 }}
            />
            {/* Directions button */}
            <button
              className="icon-btn"
              onClick={openDirections}
              title="Get directions"
              style={{ flexShrink: 0 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
            </button>
          </div>
        )}

        {/* ── Search results dropdown ── */}
        {!directionsMode && searchResults.length > 0 && (
          <div style={{ borderTop: "1px solid #f0f0f0", paddingBottom: 6 }}>
            {searchResults.slice(0, 6).map((node) => (
              <button
                key={node.id}
                className="result-item"
                onMouseDown={() => handleSearchSelect(node)}
              >
                <div style={{ fontWeight: 500, fontSize: 14, color: "#111" }}>{node.caption}</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 1 }}>{node.locations.slice(0, 3).join(" · ")}</div>
              </button>
            ))}
          </div>
        )}

        {/* ── Directions mode ── */}
        {directionsMode && (
          <div style={{ padding: "12px 14px 14px" }}>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 6 }}>
              <button className="icon-btn" onClick={closeDirections} title="Back">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
              </button>
              <span style={{ fontWeight: 600, fontSize: 15, color: "#111" }}>Directions</span>
              {path.length > 0 && (
                <button className="icon-btn" onClick={handleReset} title="Clear route" style={{ marginLeft: "auto" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* From / To fields */}
            <div style={{ display: "flex", gap: 10 }}>
              {/* Dot line decoration */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 14, gap: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", border: "2.5px solid #2563eb", background: "#fff" }} />
                <div style={{ width: 2, height: 28, background: "#d1d5db" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#2563eb" }} />
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  className="map-input"
                  value={fromQuery}
                  onChange={(e) => handleDirSearch(e.target.value, "from")}
                  onFocus={() => { setActiveDirField("from"); if (fromQuery) setDirResults(fuse.search(fromQuery).map(r => r.item)); }}
                  onBlur={() => setTimeout(() => { setActiveDirField(null); setDirResults([]); }, 180)}
                  placeholder="Starting point"
                  autoComplete="off"
                />
                <input
                  className="map-input"
                  value={toQuery}
                  onChange={(e) => handleDirSearch(e.target.value, "to")}
                  onFocus={() => { setActiveDirField("to"); if (toQuery) setDirResults(fuse.search(toQuery).map(r => r.item)); }}
                  onBlur={() => setTimeout(() => { setActiveDirField(null); setDirResults([]); }, 180)}
                  placeholder="Destination"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Dir results */}
            {dirResults.length > 0 && activeDirField && (
              <div style={{ marginTop: 6, borderTop: "1px solid #f0f0f0", paddingTop: 4, maxHeight: 220, overflowY: "auto" }}>
                {dirResults.slice(0, 6).map((node) => (
                  <button
                    key={node.id}
                    className="result-item"
                    onMouseDown={() => selectDirResult(node)}
                  >
                    <div style={{ fontWeight: 500, fontSize: 13, color: "#111" }}>{node.caption}</div>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>{node.locations.slice(0, 3).join(" · ")}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Go button row */}
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <button
                className="blue-btn"
                onClick={handleGo}
                disabled={!canGo}
                style={{ flex: 1 }}
              >
                Get directions
              </button>
              {path.length > 0 && (
                <button className="icon-btn" onClick={handleReset} style={{ border: "1.5px solid #e5e7eb" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 12 6 9 9 12" />
                    <path d="M6 9a9 9 0 1 1 0 9" />
                  </svg>
                </button>
              )}
            </div>

            {/* Route summary */}
            {path.length > 0 && (
              <div style={{ marginTop: 12, padding: "10px 12px", background: "#eff6ff", borderRadius: 10, borderLeft: "3px solid #2563eb" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1d4ed8" }}>
                  Route found · {path.length - 1} stop{path.length - 1 !== 1 ? "s" : ""}
                </div>
                <div style={{ fontSize: 12, color: "#3b82f6", marginTop: 3 }}>
                  Follow the blue arrows
                </div>
              </div>
            )}

            {hasSearched && path.length === 0 && fromNode && toNode && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: "#fef2f2", borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: "#dc2626" }}>No route found between these locations.</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Panorama container ── */}
      <div ref={containerRef} style={{ width: "100vw", height: "100dvh" }} />
    </>
  );
}
