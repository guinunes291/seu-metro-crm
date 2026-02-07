import { getDb } from "../server/db";
import { projects } from "../drizzle/schema";
import { eq, isNull, or } from "drizzle-orm";

// Script para geocodificar projetos e salvar coordenadas no banco
// Usa a API do Google Maps via proxy do Manus

const GOOGLE_MAPS_PROXY = process.env.GOOGLE_MAPS_PROXY_URL || "https://maps-proxy.manus.im";

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `${GOOGLE_MAPS_PROXY}/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=MANUS_PROXY`
    );
    
    const data = await response.json();
    
    if (data.status === "OK" && data.results && data.results[0]) {
      const location = data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }
    
    console.warn(`Geocoding failed for: ${address} - Status: ${data.status}`);
    return null;
  } catch (error) {
    console.error(`Error geocoding ${address}:`, error);
    return null;
  }
}

async function main() {
  const db = await getDb();
  
  // Buscar projetos sem coordenadas
  const projectsWithoutCoords = await db
    .select()
    .from(projects)
    .where(or(isNull(projects.latitude), isNull(projects.longitude)));
  
  console.log(`Found ${projectsWithoutCoords.length} projects without coordinates`);
  
  let geocoded = 0;
  let failed = 0;
  
  for (const project of projectsWithoutCoords) {
    if (!project.endereco && !project.bairro) {
      console.log(`Skipping project ${project.id} (${project.nome}) - no address`);
      failed++;
      continue;
    }
    
    const address = `${project.endereco || ''}, ${project.bairro || ''}, ${project.cidade || 'São Paulo'}, ${project.estado || 'SP'}, Brasil`;
    
    console.log(`Geocoding project ${project.id}: ${project.nome} - ${address}`);
    
    const coords = await geocodeAddress(address);
    
    if (coords) {
      await db
        .update(projects)
        .set({
          latitude: coords.lat.toString(),
          longitude: coords.lng.toString(),
        })
        .where(eq(projects.id, project.id));
      
      geocoded++;
      console.log(`✓ Geocoded: ${coords.lat}, ${coords.lng}`);
    } else {
      failed++;
      console.log(`✗ Failed to geocode`);
    }
    
    // Delay para evitar rate limit (100ms entre requests)
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\nGeocoding complete:`);
  console.log(`- Geocoded: ${geocoded}`);
  console.log(`- Failed: ${failed}`);
  console.log(`- Total: ${projectsWithoutCoords.length}`);
}

main().catch(console.error);
