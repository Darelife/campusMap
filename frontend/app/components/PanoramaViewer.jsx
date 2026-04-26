"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Fuse from "fuse.js";

import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/virtual-tour-plugin/index.css";
import "@photo-sphere-viewer/plan-plugin/index.css";
import "leaflet/dist/leaflet.css";
import { nodes as rawNodes } from "../data/nodes";

/**
 * Pre-process nodes to ensure bidirectionality.
 * If node A links to B, but B doesn't link to A, we add that link.
 */
const nodes = (() => {
  const nodeMap = rawNodes.reduce((acc, node) => {
    acc[node.id] = { ...node, links: [...(node.links || [])] };
    return acc;
  }, {});

  rawNodes.forEach((node) => {
    (node.links || []).forEach((link) => {
      const target = nodeMap[link.nodeId];
      if (target) {
        const hasBackLink = target.links.some((l) => l.nodeId === node.id);
        if (!hasBackLink) {
          target.links.push({ nodeId: node.id });
        }
      }
    });
  });

  return Object.values(nodeMap);
})();


// ─── "Your location" sentinel ──────────────────────────────────────────────
const YOUR_IMAGE_ITEM = {
  id: "__your_image__",
  caption: "Your Image",
  locations: ["Current panorama you are viewing"],
  isYourLocation: true,
};

// ─── Detect mobile at module level (SSR-safe) ─────────────────────────────
const isMobileQuery = "(max-width: 600px)";

export default function PanoramaViewer() {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const vtRef = useRef(null);
  const planPluginRef = useRef(null);
  const userGpsRef = useRef(null); // { lat, lon } once GPS fix arrives
  const currentNodeRef = useRef(null); // always the live panorama node

  // --- Mobile state ---
  const [isMobile, setIsMobile] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false); // search/dir panel open on mobile
  const [mapVisible, setMapVisible] = useState(true); // plan plugin visibility

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
  const activeDirFieldRef = useRef(null); // mirrors state — immune to stale closures
  const [dirResults, setDirResults] = useState([]);
  const [path, setPath] = useState([]); // active path node IDs
  const [hasSearched, setHasSearched] = useState(false);

  // --- Detect mobile on mount + resize ---
  useEffect(() => {
    const mql = window.matchMedia(isMobileQuery);
    const update = () => {
      const mobile = mql.matches;
      setIsMobile(mobile);
      if (mobile) {
        setMapVisible(false); // start with map hidden on mobile
      }
    };
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  // --- Toggle map visibility ---
  const toggleMap = useCallback(() => {
    const plugin = planPluginRef.current;
    if (!plugin) return;
    setMapVisible((prev) => {
      if (prev) {
        plugin.close();
      } else {
        plugin.open();
      }
      return !prev;
    });
  }, []);

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

  // --- Dijkstra pathfinding ---
  const findPath = useCallback((startId, endId) => {
    if (!startId || !endId || startId === endId) return [];
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const gpsDist = (aId, bId) => {
      const a = nodeMap.get(aId);
      const b = nodeMap.get(bId);
      if (!a || !b) return Infinity;
      const dLon = a.gps[0] - b.gps[0];
      const dLat = a.gps[1] - b.gps[1];
      return Math.sqrt(dLon * dLon + dLat * dLat);
    };

    const dist = new Map();
    const prev = new Map();
    const visited = new Set();

    for (const n of nodes) dist.set(n.id, Infinity);
    dist.set(startId, 0);

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

  // Build the node list with blue arrowStyle on path links
  const buildPathNodes = useCallback((activePath) => {
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
  }, []);

  // --- Find nearest campus node to a GPS coord ---
  const findNearestNode = useCallback((lat, lon) => {
    let best = null;
    let bestDist = Infinity;
    for (const n of nodes) {
      const dLon = n.gps[0] - lon;
      const dLat = n.gps[1] - lat;
      const d = Math.sqrt(dLon * dLon + dLat * dLat);
      if (d < bestDist) {
        bestDist = d;
        best = n;
      }
    }
    return best;
  }, []);

  // --- Viewer setup (runs once) ---
  useEffect(() => {
    if (!containerRef.current) return;

    let viewer;
    let gpsWatchId = null;
    let gpsMarker = null;
    let leafletMap = null;

    const mobile = window.matchMedia(isMobileQuery).matches;

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
        moveSpeed: 2,
        mousewheelSpeed: 2,
        plugins: [
          VirtualTourPlugin.withConfig({
            positionMode: "gps",
            renderMode: "3d",
            nodes,
            startNodeId: "Entrance",
          }),
          PlanPlugin.withConfig({
            coordinates: [15.39239, 73.879949],
            visibleOnLoad: !mobile, // hide map by default on mobile
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

      const planPlugin = viewer.getPlugin(PlanPlugin);
      planPluginRef.current = planPlugin;

      // Sync our React state when the plugin is opened/closed via its own built-in button
      planPlugin.addEventListener('view-changed', (e) => {
        setMapVisible(e.view !== 'closed');
      });

      // Keep currentNodeRef in sync — the ONLY reliable way to read the node
      // at arbitrary times (e.g. when the user clicks "Your Image").
      vtRef.current.addEventListener('node-changed', (e) => {
        currentNodeRef.current = e.node;
      });
      // Seed the ref once the viewer is ready (first node already loaded)
      viewer.addEventListener('ready', () => {
        currentNodeRef.current = vtRef.current.currentNode ?? null;
      }, { once: true });

      // --- Live GPS marker ---
      leafletMap = planPlugin.getLeaflet();
      if (navigator.geolocation && leafletMap) {
        let gpsDone = false;
        const placeMarker = (latlng) => {
          // Store the GPS fix for "Your location" feature
          userGpsRef.current = { lat: latlng.lat, lon: latlng.lng };

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

  // --- Build direction results (with "Your location" prepended when no text) ---
  const buildDirResults = useCallback(
    (value) => {
      const fuseHits = value.trim()
        ? fuse.search(value).map((r) => r.item)
        : [];
      return fuseHits;
    },
    [fuse]
  );

  // Results shown in the dropdown — always prepend "Your Image"
  const dirResultsWithYours = useMemo(() => {
    if (!activeDirField) return [];
    return [YOUR_IMAGE_ITEM, ...dirResults];
  }, [activeDirField, dirResults]);

  // --- Directions search ---
  const handleDirSearch = (value, field) => {
    if (field === "from") {
      setFromQuery(value);
      setFromNode(null);
    } else {
      setToQuery(value);
      setToNode(null);
    }
    setDirResults(buildDirResults(value));
    activeDirFieldRef.current = field;
    setActiveDirField(field);
  };

  // --- Handle selecting a direction result ---
  // NOTE: reads activeDirFieldRef (not state) to avoid stale closure bugs
  // that occur when onMouseDown + onBlur fire in close succession.
  const selectDirResult = (node) => {
    const field = activeDirFieldRef.current; // always the live value
    if (node.isYourLocation) {
      // Use the always-current ref — never reads stale PSV plugin state
      const current = currentNodeRef.current;
      if (current) {
        if (field === "from") {
          setFromNode(current);
          setFromQuery(current.caption);
        } else {
          setToNode(current);
          setToQuery(current.caption);
        }
      } else {
        console.warn('[YourImage] currentNodeRef is null — node-changed event not yet fired?');
      }
    } else {
      if (field === "from") {
        setFromNode(node);
        setFromQuery(node.caption);
      } else {
        setToNode(node);
        setToQuery(node.caption);
      }
    }
    activeDirFieldRef.current = null;
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
    // Collapse mobile panel after getting directions so user sees the arrows
    if (isMobile) setMobileExpanded(false);
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
    activeDirFieldRef.current = null;
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
    // Pre-fill From with current node using the reliable ref
    const current = currentNodeRef.current;
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
    if (isMobile) setMobileExpanded(false);
  };

  const canGo = fromNode && toNode;

  // On mobile, show a route-active banner in the collapsed fab row
  const hasActiveRoute = path.length > 0;

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
            width: 140px !important;
            height: 110px !important;
            bottom: 16px !important;
            left: 16px !important;
            right: auto !important;
          }
        }

        /* Hide PlanPlugin's own built-in close/collapse button — we provide our own toggle */
        .psv-plan-close-button,
        .psv-plan__toggle {
          display: none !important;
        }

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
          padding: 9px 12px;
          text-align: left;
          background: none;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: background 0.12s;
        }
        .result-item:hover { background: #f0f4ff; }
        .result-item.your-location-item {
          border-bottom: 1px solid #f0f0f0;
          margin-bottom: 2px;
        }
        .result-item.your-location-item:hover { background: #f0fff4; }

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

        /* ── Mobile floating action buttons ── */
        .mobile-fab {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 12px rgba(0,0,0,0.22);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .mobile-fab:active {
          transform: scale(0.93);
        }

        /* ── Mobile bottom sheet ── */
        .mobile-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.35);
          z-index: 99;
          animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .mobile-sheet {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 100;
          background: #fff;
          border-radius: 20px 20px 0 0;
          box-shadow: 0 -4px 30px rgba(0,0,0,0.18);
          max-height: 80dvh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideUp 0.25s ease;
          font-family: 'Inter', sans-serif;
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .mobile-sheet-handle {
          width: 36px;
          height: 4px;
          border-radius: 2px;
          background: #d1d5db;
          margin: 10px auto 6px;
          flex-shrink: 0;
        }

        /* ── Mobile route banner (shown when collapsed + route active) ── */
        .mobile-route-banner {
          position: fixed;
          bottom: 80px;
          left: 16px;
          right: 16px;
          z-index: 10;
          background: #eff6ff;
          border: 1.5px solid #bfdbfe;
          border-radius: 14px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 2px 12px rgba(37,99,235,0.15);
          font-family: 'Inter', sans-serif;
          animation: fadeIn 0.2s ease;
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════════
           MOBILE LAYOUT
         ═══════════════════════════════════════════════════════════════════ */}
      {isMobile && (
        <>
          {/* ── Floating action buttons (top-right) ── */}
          {!mobileExpanded && (
            <div style={{
              position: "fixed",
              top: 16,
              right: 16,
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}>
              {/* Search FAB */}
              <button
                className="mobile-fab"
                style={{ background: "#fff" }}
                onClick={() => { setMobileExpanded(true); setDirectionsMode(false); }}
                title="Search"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </button>

              {/* Directions FAB */}
              <button
                className="mobile-fab"
                style={{ background: "#2563eb" }}
                onClick={() => { setMobileExpanded(true); openDirections(); }}
                title="Directions"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
              </button>

              {/* Map toggle FAB */}
              <button
                className="mobile-fab"
                style={{ background: mapVisible ? "#10b981" : "#fff" }}
                onClick={toggleMap}
                title={mapVisible ? "Hide map" : "Show map"}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={mapVisible ? "#fff" : "#555"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
              </button>

              {/* Contributors FAB */}
              <a
                href="/contributors"
                className="mobile-fab"
                style={{ background: "#fff", textDecoration: "none" }}
                title="Contributors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </a>
            </div>
          )}

          {/* ── Route active banner (collapsed state) ── */}
          {!mobileExpanded && hasActiveRoute && (
            <div className="mobile-route-banner" onClick={() => { setMobileExpanded(true); setDirectionsMode(true); }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "#2563eb", display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1d4ed8" }}>
                  Route active · {path.length - 1} stop{path.length - 1 !== 1 ? "s" : ""}
                </div>
                <div style={{ fontSize: 11, color: "#3b82f6" }}>Follow the blue arrows</div>
              </div>
              <button
                className="icon-btn"
                onClick={(e) => { e.stopPropagation(); handleReset(); closeDirections(); }}
                style={{ background: "#dbeafe", borderRadius: "50%", width: 32, height: 32, padding: 0 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* ── Bottom sheet (expanded) ── */}
          {mobileExpanded && (
            <>
              <div className="mobile-backdrop" onClick={() => setMobileExpanded(false)} />
              <div className="mobile-sheet">
                <div className="mobile-sheet-handle" />

                {/* ── Search mode ── */}
                {!directionsMode && (
                  <div style={{ padding: "6px 16px 12px", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                      </svg>
                      <input
                        className="map-input"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
                        onFocus={() => setShowResults(true)}
                        placeholder="Search campus..."
                        autoFocus
                        style={{ background: "transparent", border: "none", borderRadius: 0, padding: "4px 0", fontSize: 16 }}
                      />
                      <button className="icon-btn" onClick={() => setMobileExpanded(false)} title="Close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Quick action pills */}
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      <button
                        onClick={() => openDirections()}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          background: "#eff6ff", border: "1px solid #bfdbfe",
                          borderRadius: 20, padding: "6px 14px",
                          fontSize: 13, fontWeight: 500, color: "#2563eb",
                          cursor: "pointer", fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="3 11 22 2 13 21 11 13 3 11" />
                        </svg>
                        Directions
                      </button>
                      <button
                        onClick={toggleMap}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          background: mapVisible ? "#d1fae5" : "#f3f4f6",
                          border: `1px solid ${mapVisible ? "#6ee7b7" : "#d1d5db"}`,
                          borderRadius: 20, padding: "6px 14px",
                          fontSize: 13, fontWeight: 500,
                          color: mapVisible ? "#059669" : "#555",
                          cursor: "pointer", fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={mapVisible ? "#059669" : "#555"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                          <line x1="8" y1="2" x2="8" y2="18" />
                          <line x1="16" y1="6" x2="16" y2="22" />
                        </svg>
                        {mapVisible ? "Hide map" : "Show map"}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Search results ── */}
                {!directionsMode && searchResults.length > 0 && (
                  <div style={{ borderTop: "1px solid #f0f0f0", overflowY: "auto", flex: 1, paddingBottom: 20 }}>
                    {searchResults.slice(0, 10).map((node) => (
                      <button
                        key={node.id}
                        className="result-item"
                        onMouseDown={() => handleSearchSelect(node)}
                      >
                        <div style={{ fontWeight: 500, fontSize: 15, color: "#111" }}>{node.caption}</div>
                        <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{node.locations.slice(0, 3).join(" · ")}</div>
                      </button>
                    ))}
                  </div>
                )}

                {/* ── Directions mode ── */}
                {directionsMode && (
                  <div style={{ padding: "4px 16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", flex: 1 }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 6 }}>
                      <button className="icon-btn" onClick={() => { closeDirections(); /* stay in sheet but go to search */ }} title="Back">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 12H5M12 5l-7 7 7 7" />
                        </svg>
                      </button>
                      <span style={{ fontWeight: 600, fontSize: 16, color: "#111" }}>Directions</span>
                      <div style={{ flex: 1 }} />
                      {path.length > 0 && (
                        <button className="icon-btn" onClick={handleReset} title="Clear route" style={{ marginLeft: "auto" }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      <button className="icon-btn" onClick={() => setMobileExpanded(false)} title="Close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* From / To */}
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 14 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", border: "2.5px solid #2563eb", background: "#fff" }} />
                        <div style={{ width: 2, height: 28, background: "#d1d5db" }} />
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#2563eb" }} />
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                        <input
                          className="map-input"
                          value={fromQuery}
                          onChange={(e) => handleDirSearch(e.target.value, "from")}
                          onFocus={() => {
                            activeDirFieldRef.current = "from";
                            setActiveDirField("from");
                            setDirResults(buildDirResults(fromQuery));
                          }}
                          onBlur={() => setTimeout(() => { activeDirFieldRef.current = null; setActiveDirField(null); setDirResults([]); }, 200)}
                          placeholder="Starting point"
                          autoComplete="off"
                          style={{ fontSize: 15 }}
                        />
                        <input
                          className="map-input"
                          value={toQuery}
                          onChange={(e) => handleDirSearch(e.target.value, "to")}
                          onFocus={() => {
                            activeDirFieldRef.current = "to";
                            setActiveDirField("to");
                            setDirResults(buildDirResults(toQuery));
                          }}
                          onBlur={() => setTimeout(() => { activeDirFieldRef.current = null; setActiveDirField(null); setDirResults([]); }, 200)}
                          placeholder="Destination"
                          autoComplete="off"
                          style={{ fontSize: 15 }}
                        />
                      </div>
                    </div>

                    {/* Dir results */}
                    {dirResultsWithYours.length > 0 && activeDirField && (
                      <div style={{ marginTop: 6, borderTop: "1px solid #f0f0f0", paddingTop: 4, overflowY: "auto", maxHeight: 200, flexShrink: 1 }}>
                        {dirResultsWithYours.slice(0, 7).map((node) =>
                          node.isYourLocation ? (
                            <button
                              key="your-location"
                              className="result-item your-location-item"
                              onMouseDown={() => selectDirResult(node)}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  width: 24, height: 24, borderRadius: "50%", background: "#dbeafe", flexShrink: 0
                                }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2C8.686 2 6 4.686 6 8c0 5.25 6 14 6 14s6-8.75 6-14c0-3.314-2.686-6-6-6z" />
                                    <circle cx="12" cy="8" r="2.5" />
                                  </svg>
                                </span>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 13, color: "#1d4ed8" }}>Your Image</div>
                                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>Current panorama you are viewing</div>
                                </div>
                              </div>
                            </button>
                          ) : (
                            <button
                              key={node.id}
                              className="result-item"
                              onMouseDown={() => selectDirResult(node)}
                            >
                              <div style={{ fontWeight: 500, fontSize: 14, color: "#111" }}>{node.caption}</div>
                              <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>{node.locations.slice(0, 3).join(" · ")}</div>
                            </button>
                          )
                        )}
                      </div>
                    )}

                    {/* Go button */}
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        className="blue-btn"
                        onClick={handleGo}
                        disabled={!canGo}
                        style={{ flex: 1, padding: "13px 18px", fontSize: 15 }}
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
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
           DESKTOP LAYOUT (unchanged)
         ═══════════════════════════════════════════════════════════════════ */}
      {!isMobile && (
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
            // KEY: constrain height so results cannot push below viewport
            maxHeight: "calc(100dvh - 32px)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* ── Search mode ── */}
          {!directionsMode && (
            <div style={{ padding: "10px 12px", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
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
              {/* Contributors button */}
              <a
                href="/contributors"
                title="Contributors"
                style={{
                  flexShrink: 0,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  padding: 6,
                  transition: "background 0.12s",
                  color: "#555",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#f0f0f0"}
                onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </a>
            </div>
          )}

          {/* ── Search results dropdown (scrollable, contained within card) ── */}
          {!directionsMode && searchResults.length > 0 && (
            <div style={{ borderTop: "1px solid #f0f0f0", overflowY: "auto", flexShrink: 1, paddingBottom: 6 }}>
              {searchResults.slice(0, 8).map((node) => (
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
            <div style={{ padding: "12px 14px 14px", overflowY: "auto", display: "flex", flexDirection: "column", flexShrink: 1 }}>
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 6, flexShrink: 0 }}>
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
              <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
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
                    onFocus={() => {
                      activeDirFieldRef.current = "from";
                      setActiveDirField("from");
                      setDirResults(buildDirResults(fromQuery));
                    }}
                    onBlur={() => setTimeout(() => { activeDirFieldRef.current = null; setActiveDirField(null); setDirResults([]); }, 200)}
                    placeholder="Starting point"
                    autoComplete="off"
                  />
                  <input
                    className="map-input"
                    value={toQuery}
                    onChange={(e) => handleDirSearch(e.target.value, "to")}
                    onFocus={() => {
                      activeDirFieldRef.current = "to";
                      setActiveDirField("to");
                      setDirResults(buildDirResults(toQuery));
                    }}
                    onBlur={() => setTimeout(() => { activeDirFieldRef.current = null; setActiveDirField(null); setDirResults([]); }, 200)}
                    placeholder="Destination"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Dir results — always shows "Your location" first */}
              {dirResultsWithYours.length > 0 && activeDirField && (
                <div style={{ marginTop: 6, borderTop: "1px solid #f0f0f0", paddingTop: 4, overflowY: "auto", maxHeight: 220, flexShrink: 1 }}>
                  {dirResultsWithYours.slice(0, 7).map((node) =>
                    node.isYourLocation ? (
                      <button
                        key="your-location"
                        className="result-item your-location-item"
                        onMouseDown={() => selectDirResult(node)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: "#dbeafe",
                            flexShrink: 0
                          }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 2C8.686 2 6 4.686 6 8c0 5.25 6 14 6 14s6-8.75 6-14c0-3.314-2.686-6-6-6z" />
                              <circle cx="12" cy="8" r="2.5" />
                            </svg>
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "#1d4ed8" }}>Your Image</div>
                            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>Current panorama you are viewing</div>
                          </div>
                        </div>
                      </button>
                    ) : (
                      <button
                        key={node.id}
                        className="result-item"
                        onMouseDown={() => selectDirResult(node)}
                      >
                        <div style={{ fontWeight: 500, fontSize: 13, color: "#111" }}>{node.caption}</div>
                        <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>{node.locations.slice(0, 3).join(" · ")}</div>
                      </button>
                    )
                  )}
                </div>
              )}

              {/* Go button row */}
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
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
                <div style={{ marginTop: 12, padding: "10px 12px", background: "#eff6ff", borderRadius: 10, borderLeft: "3px solid #2563eb", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1d4ed8" }}>
                    Route found · {path.length - 1} stop{path.length - 1 !== 1 ? "s" : ""}
                  </div>
                  <div style={{ fontSize: 12, color: "#3b82f6", marginTop: 3 }}>
                    Follow the blue arrows
                  </div>
                </div>
              )}

              {hasSearched && path.length === 0 && fromNode && toNode && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: "#fef2f2", borderRadius: 8, flexShrink: 0 }}>
                  <div style={{ fontSize: 12, color: "#dc2626" }}>No route found between these locations.</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Panorama container ── */}
      <div ref={containerRef} style={{ width: "100vw", height: "100dvh" }} />
    </>
  );
}
