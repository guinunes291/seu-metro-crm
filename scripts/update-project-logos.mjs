import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { projects } from "../drizzle/schema.ts";
import { getLogoUrlByConstrutora } from "../server/construtoraLogos.ts";
import { eq, isNull, or } from "drizzle-orm";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

async function updateProjectLogos() {
  console.log("🚀 Iniciando atualização de logos dos projetos...\n");

  try {
    // Busca todos os projetos que não têm logo ou têm logo vazia
    const projectsWithoutLogo = await db
      .select()
      .from(projects)
      .where(or(isNull(projects.logoUrl), eq(projects.logoUrl, "")));

    console.log(`📊 Encontrados ${projectsWithoutLogo.length} projetos sem logo\n`);

    let updated = 0;
    let notFound = 0;

    for (const project of projectsWithoutLogo) {
      const logoUrl = getLogoUrlByConstrutora(project.construtora);

      if (logoUrl) {
        await db
          .update(projects)
          .set({ logoUrl })
          .where(eq(projects.id, project.id));

        console.log(`✅ ${project.nome} → ${project.construtora} → Logo atualizada`);
        updated++;
      } else {
        console.log(`⚠️  ${project.nome} → ${project.construtora || "SEM CONSTRUTORA"} → Logo não encontrada`);
        notFound++;
      }
    }

    console.log(`\n📈 Resumo:`);
    console.log(`   ✅ Logos atualizadas: ${updated}`);
    console.log(`   ⚠️  Logos não encontradas: ${notFound}`);
    console.log(`   📊 Total processado: ${projectsWithoutLogo.length}`);

  } catch (error) {
    console.error("❌ Erro ao atualizar logos:", error);
    process.exit(1);
  }
}

updateProjectLogos()
  .then(() => {
    console.log("\n✅ Atualização concluída com sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro na atualização:", error);
    process.exit(1);
  });
