import { storagePut } from "../server/storage.ts";
import { readFileSync } from "fs";
import { resolve } from "path";

const logos = [
  { name: "cury", file: "cury.png", construtora: "CURY" },
  { name: "plano-plano", file: "plano-plano.png", construtora: "PLANO&PLANO" },
  { name: "metrocasa", file: "metrocasa.png", construtora: "METROCASA" },
  { name: "vivaz", file: "vivaz.png", construtora: "VIVAZ" },
];

async function uploadLogos() {
  console.log("🚀 Iniciando upload das logos das construtoras...\n");

  const results = {};

  for (const logo of logos) {
    try {
      const filePath = resolve(`assets/logos/${logo.file}`);
      const fileBuffer = readFileSync(filePath);

      console.log(`📤 Fazendo upload de ${logo.construtora}...`);

      const { url } = await storagePut(
        `construtoras/${logo.name}.png`,
        fileBuffer,
        "image/png"
      );

      results[logo.construtora] = url;

      console.log(`✅ ${logo.construtora}: ${url}\n`);
    } catch (error) {
      console.error(`❌ Erro ao fazer upload de ${logo.construtora}:`, error.message);
    }
  }

  console.log("\n📋 Mapeamento completo:");
  console.log(JSON.stringify(results, null, 2));

  return results;
}

uploadLogos()
  .then(() => {
    console.log("\n✅ Upload concluído com sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro no upload:", error);
    process.exit(1);
  });
