import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { MapView } from '@/components/Map';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface Project {
  id: number;
  nome: string;
  construtora: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  valorMinimo: number | null;
  valorMaximo: number | null;
  dormitorios: string | null;
  vagas: number | null;
  status: string;
  logoUrl: string | null;
}

interface ProjetosMapViewProps {
  projects: Project[];
  isLoading: boolean;
}

export function ProjetosMapView({ projects, isLoading }: ProjetosMapViewProps) {
  const [, setLocation] = useLocation();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [geocoder, setGeocoder] = useState<google.maps.Geocoder | null>(null);
  const [infoWindow, setInfoWindow] = useState<google.maps.InfoWindow | null>(null);

  const handleMapReady = useCallback((mapInstance: google.maps.Map) => {
    // Forçar centralização em São Paulo
    const saoPauloCenter = new google.maps.LatLng(-23.5505, -46.6333);
    mapInstance.setCenter(saoPauloCenter);
    mapInstance.setZoom(11);
    
    setMap(mapInstance);
    setGeocoder(new google.maps.Geocoder());
    setInfoWindow(new google.maps.InfoWindow());
  }, []);

  // Função para formatar preço
  const formatPrice = (price: number | null) => {
    if (!price) return '';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(price / 100);
  };

  // Função para criar conteúdo do InfoWindow
  const createInfoWindowContent = (project: Project) => {
    const price = project.valorMinimo ? `<p class="text-sm font-semibold text-green-600">A partir de ${formatPrice(project.valorMinimo)}</p>` : '';
    const dorms = project.dormitorios ? `<p class="text-xs text-gray-600">${project.dormitorios}</p>` : '';
    const address = project.endereco ? `<p class="text-xs text-gray-500">${project.endereco}</p>` : '';
    
    return `
      <div style="max-width: 250px; padding: 8px; cursor: pointer;" data-project-id="${project.id}">
        <h3 style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: #1f2937;">${project.nome}</h3>
        <p style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">${project.construtora || ''}</p>
        ${address}
        ${dorms}
        ${price}
        <p style="font-size: 11px; color: #3b82f6; margin-top: 8px;">Clique para ver detalhes →</p>
      </div>
    `;
  };

  // Adicionar markers quando projetos ou mapa mudarem
  useEffect(() => {
    if (!map || !geocoder || !infoWindow || projects.length === 0) return;

    // Limpar markers anteriores
    markers.forEach(marker => marker.setMap(null));
    setMarkers([]);

    const newMarkers: google.maps.Marker[] = [];
    const bounds = new google.maps.LatLngBounds();

    // Limitar a 20 projetos com endereço completo para carregamento rápido
    const projectsWithAddress = projects.filter(p => p.endereco && p.bairro);
    const limitedProjects = projectsWithAddress.slice(0, 20);

    // Geocodificar e adicionar markers para cada projeto
    let geocodedCount = 0;
    limitedProjects.forEach((project, index) => {
      if (!project.endereco && !project.bairro) return;

      const address = `${project.endereco || ''}, ${project.bairro || ''}, ${project.cidade || 'São Paulo'}, ${project.estado || 'SP'}, Brasil`;

      // Adicionar delay entre geocodificações para evitar OVER_QUERY_LIMIT
      setTimeout(() => {
        geocoder.geocode({ address }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            geocodedCount++;
          const position = results[0].geometry.location;
          
          const marker = new google.maps.Marker({
            position,
            map,
            title: project.nome,
            animation: google.maps.Animation.DROP,
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
                  <path fill="#3b82f6" stroke="#1e40af" stroke-width="1.5" d="M16 0C9.373 0 4 5.373 4 12c0 9 12 28 12 28s12-19 12-28c0-6.627-5.373-12-12-12z"/>
                  <circle cx="16" cy="12" r="5" fill="white"/>
                </svg>
              `),
              scaledSize: new google.maps.Size(32, 40),
              anchor: new google.maps.Point(16, 40),
            },
          });

          // Hover: mostrar InfoWindow
          marker.addListener('mouseover', () => {
            infoWindow.setContent(createInfoWindowContent(project));
            infoWindow.open(map, marker);
          });

          // Click: navegar para página de detalhes
          marker.addListener('click', () => {
            setLocation(`/projetos/${project.id}`);
          });

          // Adicionar listener no conteúdo do InfoWindow
          google.maps.event.addListener(infoWindow, 'domready', () => {
            const content = document.querySelector(`[data-project-id="${project.id}"]`);
            if (content) {
              content.addEventListener('click', () => {
                setLocation(`/projetos/${project.id}`);
              });
            }
          });

            newMarkers.push(marker);
            bounds.extend(position);

            // Ajustar zoom para mostrar todos os markers apenas após geocodificar todos
            if (geocodedCount === limitedProjects.length) {
              map.fitBounds(bounds);
            }
          } else if (status === 'OVER_QUERY_LIMIT') {
            console.warn('Geocoding quota exceeded. Some markers may not appear.');
          }
        });
      }, index * 100); // 100ms de delay entre cada geocodificação
    });

    setMarkers(newMarkers);
  }, [map, geocoder, infoWindow, projects, setLocation, markers]);

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Carregando projetos...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {projects.length > 20 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p>
            <strong>Nota:</strong> Mostrando os primeiros 20 projetos com endereço completo de {projects.length} encontrados. 
            Use os filtros acima para refinar sua busca e visualizar projetos específicos no mapa.
          </p>
        </div>
      )}
      
      <div className="h-[calc(100vh-320px)] min-h-[600px] w-full">
        <MapView
        onMapReady={handleMapReady}
        defaultCenter={{ lat: -23.5505, lng: -46.6333 }} // São Paulo
        defaultZoom={11}
        className="w-full h-full rounded-lg shadow-lg"
        />
      </div>
    </div>
  );
}
