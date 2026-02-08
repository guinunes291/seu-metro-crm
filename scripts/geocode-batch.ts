import { getDb } from "../server/db";
import { projects } from "../drizzle/schema";
import { isNull, or, eq, and, ne, sql } from "drizzle-orm";
import { makeRequest, type GeocodingResult } from "../server/_core/map";

async function geocodeBatch() {
  const db = await getDb();
  
  // Get all projects without coordinates that have an address
  const projectsToGeocode = await db
    .select({ id: projects.id, nome: projects.nome, endereco: projects.endereco, bairro: projects.bairro, cidade: projects.cidade, estado: projects.estado })
    .from(projects)
    .where(
      and(
        or(isNull(projects.latitude), isNull(projects.longitude)),
        ne(projects.endereco, ''),
        sql`${projects.endereco} IS NOT NULL`
      )
    );

  console.log(`Found ${projectsToGeocode.length} projects to geocode`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < projectsToGeocode.length; i++) {
    const p = projectsToGeocode[i];
    
    if (!p.endereco || p.endereco.trim() === '') {
      skipped++;
      continue;
    }

    // Build address string
    const parts = [p.endereco];
    if (p.bairro) parts.push(p.bairro);
    if (p.cidade) parts.push(p.cidade);
    if (p.estado) parts.push(p.estado);
    const address = parts.join(', ') + ', Brasil';

    try {
      const result = await makeRequest<GeocodingResult>('/maps/api/geocode/json', {
        address: address,
      });

      if (result.status === 'OK' && result.results.length > 0) {
        const location = result.results[0].geometry.location;
        await db.update(projects)
          .set({ 
            latitude: String(location.lat), 
            longitude: String(location.lng) 
          })
          .where(eq(projects.id, p.id));
        success++;
        if (success % 50 === 0) {
          console.log(`Progress: ${success} geocoded, ${failed} failed, ${skipped} skipped (${i + 1}/${projectsToGeocode.length})`);
        }
      } else {
        failed++;
        console.log(`  FAILED [${p.id}] ${p.nome}: ${result.status}`);
      }
    } catch (err: any) {
      failed++;
      console.log(`  ERROR [${p.id}] ${p.nome}: ${err.message}`);
    }

    // Small delay to avoid rate limiting (50ms between requests)
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log(`\nDone! Success: ${success}, Failed: ${failed}, Skipped: ${skipped}`);
  process.exit(0);
}

geocodeBatch().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
