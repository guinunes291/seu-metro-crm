import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, and, sql } from 'drizzle-orm';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn);

const corretorId = 5055943; // Guilherme Nunes corretor

// Simular timezone.ts
const OFFSET_SP_HORAS = -3;

function agora() {
  const agoraUTC = new Date();
  const agoraSP = new Date(agoraUTC.getTime() + (OFFSET_SP_HORAS * 60 * 60 * 1000));
  return agoraSP;
}

function inicioDoDiaHoje() {
  const agoraSP = agora();
  const ano = agoraSP.getFullYear();
  const mes = agoraSP.getMonth();
  const dia = agoraSP.getDate();
  const inicioDia = new Date(Date.UTC(ano, mes, dia, 3, 0, 0, 0));
  return inicioDia;
}

const hoje = inicioDoDiaHoje();
const dataHoje = hoje.toISOString().split('T')[0]; // YYYY-MM-DD

console.log('=== TESTE DE FOLLOW-UPS ===');
console.log('Corretor ID:', corretorId);
console.log('Data hoje calculada:', dataHoje);

// Query simples
const [rows] = await conn.query(
  `SELECT f.*, l.nome as leadNome, l.telefone as leadTelefone, l.email as leadEmail, l.status as leadStatus
   FROM follow_ups f
   INNER JOIN leads l ON f.leadId = l.id
   WHERE f.corretorId = ? AND f.status = 'pendente' AND DATE(f.dataFollowUp) = ?`,
  [corretorId, dataHoje]
);

console.log('\n=== RESULTADO ===');
console.log('Follow-ups encontrados:', rows.length);
if (rows.length > 0) {
  console.table(rows);
}

// Testar também com CURDATE()
const [rows2] = await conn.query(
  `SELECT f.*, l.nome as leadNome
   FROM follow_ups f
   INNER JOIN leads l ON f.leadId = l.id
   WHERE f.corretorId = ? AND f.status = 'pendente' AND DATE(f.dataFollowUp) = CURDATE()`,
  [corretorId]
);

console.log('\n=== COM CURDATE() ===');
console.log('Follow-ups encontrados:', rows2.length);

await conn.end();
