import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Building2, Home, Car, ExternalLink } from "lucide-react";
import { MapView } from "@/components/Map";

export default function ProjetoDetalhes() {
  const [, params] = useRoute("/projetos/:id");
  const [, setLocation] = useLocation();
  const projectId = params?.id ? parseInt(params.id) : 0;
  
  const { data: projects = [], isLoading } = trpc.projects.list.useQuery();
  const project = projects.find((p) => p.id === projectId);

  const handleMapReady = (map: google.maps.Map) => {
    if (!project?.endereco) return;
    
    const geocoder = new google.maps.Geocoder();
    const fullAddress = `${project.endereco}, ${project.bairro || ''}, ${project.cidade || 'São Paulo'}, ${project.estado || 'SP'}`;
    
    geocoder.geocode({ address: fullAddress }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        const location = results[0].geometry.location;
        map.setCenter(location);
        map.setZoom(16);
        
        new google.maps.Marker({
          position: location,
          map: map,
          title: project.nome,
        });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Building2 className="h-12 w-12 animate-pulse mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Carregando projeto...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-2">Projeto não encontrado</p>
            <Button onClick={() => setLocation("/projetos")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Projetos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fullAddress = `${project.endereco || ''}, ${project.bairro || ''}, ${project.cidade || 'São Paulo'}, ${project.estado || 'SP'}`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => setLocation("/projetos")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Projetos
          </Button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">{project.nome}</h1>
              {project.construtora && (
                <p className="text-lg text-muted-foreground">{project.construtora}</p>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Badge variant={project.status === "ativo" ? "default" : project.status === "esgotado" ? "destructive" : "secondary"} className="text-sm">
                {project.status}
              </Badge>
              
              {project.zona && (
                <Badge variant="outline" className="text-sm">
                  Zona {project.zona.charAt(0).toUpperCase() + project.zona.slice(1)}
                </Badge>
              )}
              
              {project.enquadramento && (
                <Badge variant="outline" className="text-sm">{project.enquadramento}</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Imagem Principal */}
            <Card>
              <div 
                className="h-96 bg-gradient-to-br from-blue-500 to-purple-600 rounded-t-lg"
                style={{
                  backgroundImage: project.imagemPrincipal ? `url(${project.imagemPrincipal})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            </Card>

            {/* Descrição */}
            {project.descricao && (
              <Card>
                <CardHeader>
                  <CardTitle>Sobre o Empreendimento</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">{project.descricao}</p>
                </CardContent>
              </Card>
            )}

            {/* Mapa */}
            {project.endereco && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Localização</CardTitle>
                    <Button variant="outline" size="sm" asChild>
                      <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                        Ver no Google Maps
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                  <CardDescription className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{fullAddress}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96 rounded-lg overflow-hidden">
                    <MapView onMapReady={handleMapReady} />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Coluna Lateral - Informações */}
          <div className="space-y-6">
            {/* Valores */}
            {(project.valorMinimo || project.valorMaximo) && (
              <Card>
                <CardHeader>
                  <CardTitle>Valores</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {project.valorMinimo && (
                      <div>
                        <p className="text-sm text-muted-foreground">A partir de</p>
                        <p className="text-2xl font-bold text-primary">
                          R$ {(project.valorMinimo / 100).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    )}
                    {project.valorMaximo && project.valorMinimo !== project.valorMaximo && (
                      <div>
                        <p className="text-sm text-muted-foreground">Até</p>
                        <p className="text-2xl font-bold text-primary">
                          R$ {(project.valorMaximo / 100).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Características */}
            <Card>
              <CardHeader>
                <CardTitle>Características</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {project.dormitorios && (
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Home className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Dormitórios</p>
                        <p className="font-semibold">{project.dormitorios}</p>
                      </div>
                    </div>
                  )}
                  
                  {project.vagas !== null && project.vagas !== undefined && (
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Car className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Vagas</p>
                        <p className="font-semibold">
                          {project.vagas === 0 ? "Sem vaga" : `${project.vagas} vaga${project.vagas > 1 ? 's' : ''}`}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {(project.metragemMinima || project.metragemMaxima) && (
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Metragem</p>
                        <p className="font-semibold">
                          {project.metragemMinima && project.metragemMaxima
                            ? `${project.metragemMinima}m² - ${project.metragemMaxima}m²`
                            : project.metragemMinima
                            ? `A partir de ${project.metragemMinima}m²`
                            : `Até ${project.metragemMaxima}m²`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Informações Adicionais */}
            <Card>
              <CardHeader>
                <CardTitle>Informações Adicionais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {project.developer && (
                    <div>
                      <p className="text-sm text-muted-foreground">Incorporadora</p>
                      <p className="font-semibold">{project.developer}</p>
                    </div>
                  )}
                  
                  {project.tipo && (
                    <div>
                      <p className="text-sm text-muted-foreground">Tipo</p>
                      <p className="font-semibold uppercase">{project.tipo}</p>
                    </div>
                  )}
                  
                  {project.bairro && (
                    <div>
                      <p className="text-sm text-muted-foreground">Bairro</p>
                      <p className="font-semibold">{project.bairro}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
