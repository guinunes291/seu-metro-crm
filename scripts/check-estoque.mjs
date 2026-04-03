import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

// Verificar leads na tabela lead_estoque
const [estoqueRows] = await conn.execute(
  "SELECT status, COUNT(*) as total FROM lead_estoque GROUP BY status"
);
console.log("=== lead_estoque por status ===");
console.table(estoqueRows);

// Verificar leads na tabela leads com status aguardando_atendimento e sem corretorId
const [leadsAguardando] = await conn.execute(
  "SELECT COUNT(*) as total FROM leads WHERE status = 'aguardando_atendimento' AND corretorId IS NULL"
);
console.log("\n=== leads aguardando_atendimento SEM corretorId ===");
console.table(leadsAguardando);

// Verificar leads na tabela leads com status aguardando_atendimento e COM corretorId
const [leadsAguardandoComCorretor] = await conn.execute(
  "SELECT COUNT(*) as total FROM leads WHERE status = 'aguardando_atendimento' AND corretorId IS NOT NULL"
);
console.log("\n=== leads aguardando_atendimento COM corretorId ===");
console.table(leadsAguardandoComCorretor);

// Verificar corretores elegíveis (presente)
const [corretoresPresentes] = await conn.execute(
  "SELECT COUNT(*) as total FROM users WHERE role = 'corretor' AND status = 'presente'"
);
console.log("\n=== Corretores presentes ===");
console.table(corretoresPresentes);

// Verificar logs de distribuição de hoje
const [logsHoje] = await conn.execute(
  "SELECT COUNT(*) as total FROM distribution_log WHERE DATE(createdAt) = CURDATE()"
);
console.log("\n=== Logs de distribuição de hoje ===");
console.table(logsHoje);

await conn.end();
