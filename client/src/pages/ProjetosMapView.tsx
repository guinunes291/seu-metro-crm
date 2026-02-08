import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { MapView } from "@/components/Map";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Loader2, MapPin, Building2, Filter } from "lucide-react";
import { MarkerClusterer, SuperClusterAlgorithm } from "@googlemaps/markerclusterer";

interface ProjetosMapViewProps {
  filtroConstrutora?: string;
  filtroZona?: string;
  filtroStatus?: string;
  filtroBusca?: string;
}

export default function ProjetosMapView({
  filtroConstrutora,
  filtroZona,
  filtroStatus,
  filtroBusca,
}: ProjetosMapViewProps) {
  const { data: mapProjects, isLoading } = trpc.projects.listForMap.useQuery();
  const [, navigate] = useLocation();
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [totalPins, setTotalPins] = useState(0);
  const [mapReady, setMapReady] = useState(false);

  // Filter projects based on active filters
  const filteredProjects = useMemo(() => {
    if (!mapProjects) return [];

    return mapProjects.filter((p) => {
      if (filtroConstrutora && filtroConstrutora !== "todas") {
        const name = p.construtoraName || p.construtora || "";
        if (name !== filtroConstrutora) return false;
      }
      if (filtroZona && filtroZona !== "todas") {
        if (p.zona !== filtroZona) return false;
      }
      if (filtroStatus && filtroStatus !== "todos") {
        if (p.status !== filtroStatus) return false;
      }
      if (filtroBusca && filtroBusca.trim() !== "") {
        const search = filtroBusca.toLowerCase();
        const nome = (p.nome || "").toLowerCase();
        const construtora = (p.construtoraName || p.construtora || "").toLowerCase();
        const bairro = (p.bairro || "").toLowerCase();
        const endereco = (p.endereco || "").toLowerCase();
        if (
          !nome.includes(search) &&
          !construtora.includes(search) &&
          !bairro.includes(search) &&
          !endereco.includes(search)
        )
          return false;
      }
      return true;
    });
  }, [mapProjects, filtroConstrutora, filtroZona, filtroStatus, filtroBusca]);

  // Clear existing markers and clusterer
  const clearMarkers = useCallback(() => {
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
    }
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }
  }, []);

  // Create markers with clustering when BOTH map is ready AND data is available
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !filteredProjects.length) {
      if (mapReady && filteredProjects.length === 0) {
        clearMarkers();
        setTotalPins(0);
      }
      return;
    }

    clearMarkers();

    const infoWindow =
      infoWindowRef.current || new google.maps.InfoWindow({ maxWidth: 320 });
    infoWindowRef.current = infoWindow;

    const newMarkers: google.maps.marker.AdvancedMarkerElement[] = [];

    filteredProjects.forEach((project) => {
      const lat = parseFloat(project.latitude || "0");
      const lng = parseFloat(project.longitude || "0");
      if (lat === 0 && lng === 0) return;

      // Custom pin element
      const pinEl = document.createElement("div");
      pinEl.style.cssText = `
        width: 32px; height: 32px; border-radius: 50% 50% 50% 0;
        background: #1e40af; border: 2px solid #fff;
        transform: rotate(-45deg); cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        display: flex; align-items: center; justify-content: center;
        transition: all 0.2s ease;
      `;
      const innerIcon = document.createElement("div");
      innerIcon.style.cssText = `
        transform: rotate(45deg); color: white; font-size: 14px;
      `;
      innerIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
      pinEl.appendChild(innerIcon);

      pinEl.addEventListener("mouseenter", () => {
        pinEl.style.transform = "rotate(-45deg) scale(1.25)";
        pinEl.style.zIndex = "999";
        pinEl.style.background = "#2563eb";
      });
      pinEl.addEventListener("mouseleave", () => {
        pinEl.style.transform = "rotate(-45deg) scale(1)";
        pinEl.style.zIndex = "";
        pinEl.style.background = "#1e40af";
      });

      // Create marker WITHOUT map - clusterer will manage map assignment
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat, lng },
        title: project.nome || "Projeto",
        content: pinEl,
      });

      // Build InfoWindow content
      const preco = project.valorMinimo
        ? `R$ ${(Number(project.valorMinimo) / 100).toLocaleString("pt-BR")}`
        : "";
      const construtoraNome = project.construtoraName || project.construtora || "";
      const logoHtml = project.logoUrl
        ? `<img src="${project.logoUrl}" alt="${construtoraNome}" style="height:24px;max-width:80px;object-fit:contain;" />`
        : "";

      const infoContent = `
        <div style="font-family:system-ui,-apple-system,sans-serif;padding:6px;min-width:220px;max-width:300px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px;">
            <strong style="font-size:14px;color:#1e293b;flex:1;line-height:1.3;">${project.nome || "Sem nome"}</strong>
            ${logoHtml}
          </div>
          ${construtoraNome ? `<div style="font-size:12px;color:#64748b;margin-bottom:5px;">🏗️ ${construtoraNome}</div>` : ""}
          ${project.endereco ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:5px;">📍 ${project.endereco}${project.bairro ? `, ${project.bairro}` : ""}</div>` : ""}
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
            ${project.status ? `<span style="background:#dcfce7;color:#166534;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:500;">${project.status}</span>` : ""}
            ${project.dormitorios ? `<span style="font-size:11px;color:#64748b;">🛏️ ${project.dormitorios}</span>` : ""}
            ${project.vagas ? `<span style="font-size:11px;color:#64748b;">🚗 ${project.vagas} vaga${Number(project.vagas) > 1 ? "s" : ""}</span>` : ""}
            ${project.enquadramento ? `<span style="background:#dbeafe;color:#1e40af;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:500;">${project.enquadramento}</span>` : ""}
          </div>
          ${preco ? `<div style="font-size:13px;font-weight:600;color:#059669;margin-bottom:8px;">A partir de ${preco}</div>` : ""}
          <button onclick="window.__navigateToProject(${project.id})" style="
            width:100%;padding:7px 12px;background:#1e40af;color:white;border:none;
            border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;
            transition:background 0.2s;
          " onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#1e40af'">Ver Detalhes</button>
        </div>
      `;

      marker.addListener("click", () => {
        infoWindow.setContent(infoContent);
        infoWindow.open({ anchor: marker, map });
      });

      newMarkers.push(marker);
    });

    markersRef.current = newMarkers;
    setTotalPins(newMarkers.length);

    // Create MarkerClusterer with custom renderer
    const clusterer = new MarkerClusterer({
      map,
      markers: newMarkers,
      algorithm: new SuperClusterAlgorithm({ radius: 80, maxZoom: 15 }),
      renderer: {
        render: ({ count, position }) => {
          // Determine cluster size and color based on count
          let size = 40;
          let bg = "#3b82f6";
          let fontSize = "13px";
          if (count >= 50) {
            size = 56;
            bg = "#dc2626";
            fontSize = "15px";
          } else if (count >= 20) {
            size = 48;
            bg = "#ea580c";
            fontSize = "14px";
          } else if (count >= 10) {
            size = 44;
            bg = "#2563eb";
            fontSize = "13px";
          }

          const el = document.createElement("div");
          el.style.cssText = `
            width: ${size}px; height: ${size}px; border-radius: 50%;
            background: ${bg}; border: 3px solid white;
            display: flex; align-items: center; justify-content: center;
            color: white; font-weight: 700; font-size: ${fontSize};
            font-family: system-ui, -apple-system, sans-serif;
            box-shadow: 0 3px 10px rgba(0,0,0,0.3);
            cursor: pointer; transition: all 0.2s ease;
          `;
          el.textContent = String(count);
          el.addEventListener("mouseenter", () => {
            el.style.transform = "scale(1.15)";
          });
          el.addEventListener("mouseleave", () => {
            el.style.transform = "scale(1)";
          });

          return new google.maps.marker.AdvancedMarkerElement({
            position,
            content: el,
            zIndex: count,
          });
        },
      },
    });

    clustererRef.current = clusterer;

    // Set initial view - center on São Paulo
    map.setCenter({ lat: -23.5505, lng: -46.6333 });
    map.setZoom(12);

    return () => {
      // Cleanup on unmount or re-render
    };
  }, [filteredProjects, mapReady, clearMarkers]);

  // Global navigation function for InfoWindow buttons
  useEffect(() => {
    (window as any).__navigateToProject = (id: number) => {
      navigate(`/projetos/${id}`);
    };
    return () => {
      delete (window as any).__navigateToProject;
    };
  }, [navigate]);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-card rounded-lg border">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-card rounded-lg border text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          <span>
            <strong className="text-foreground">{totalPins}</strong> projetos no
            mapa
          </span>
        </div>
        {filtroConstrutora && filtroConstrutora !== "todas" && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>{filtroConstrutora}</span>
          </div>
        )}
        {filtroZona && filtroZona !== "todas" && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Zona {filtroZona}</span>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="rounded-lg overflow-hidden border shadow-sm">
        <MapView
          className="h-[600px]"
          initialCenter={{ lat: -23.5505, lng: -46.6333 }}
          initialZoom={12}
          onMapReady={handleMapReady}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 bg-card rounded-lg border text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Legenda:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-600 border border-white shadow-sm" />
          <span>Projeto individual</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm flex items-center justify-center text-white text-[8px] font-bold">
            5
          </div>
          <span>Cluster (1-9)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-orange-600 border-2 border-white shadow-sm flex items-center justify-center text-white text-[8px] font-bold">
            25
          </div>
          <span>Cluster (10-49)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-red-600 border-2 border-white shadow-sm flex items-center justify-center text-white text-[8px] font-bold">
            50
          </div>
          <span>Cluster (50+)</span>
        </div>
      </div>
    </div>
  );
}
