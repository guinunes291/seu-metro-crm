import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, and, gte, lte } from 'drizzle-orm';
import * as schema from './drizzle/schema.ts';

const { leadHistory, interacoes, visitas, documentacoes, analises_credito, contratos } = schema;

// Conectar ao banco
const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema, mode: 'default' });

console.log('🚀 Iniciando migração de dados históricos...\n');

// Estatísticas
const stats = {
  interacoes: 0,
  visitas: 0,
  documentacoes: 0,
  analises_credito: 0,
  contratos: 0,
  erros: 0
};

try {
  // 1. Migrar interações (ligações e WhatsApp)
  console.log('📞 Migrando interações (ligações e WhatsApp)...');
  const interacoesHistorico = await db
    .select()
    .from(leadHistory)
    .where(
      eq(leadHistory.tipo, 'ligacao')
    );
  
  for (const registro of interacoesHistorico) {
    try {
      await db.insert(interacoes).values({
        leadId: registro.leadId,
        corretorId: registro.corretorId,
        tipo: 'ligacao',
        observacoes: registro.observacoes,
        createdAt: registro.createdAt
      });
      stats.interacoes++;
    } catch (err) {
      // Ignorar duplicatas
      if (!err.message.includes('Duplicate entry')) {
        console.error(`Erro ao migrar interação ${registro.id}:`, err.message);
        stats.erros++;
      }
    }
  }
  
  const whatsappHistorico = await db
    .select()
    .from(leadHistory)
    .where(
      eq(leadHistory.tipo, 'whatsapp')
    );
  
  for (const registro of whatsappHistorico) {
    try {
      await db.insert(interacoes).values({
        leadId: registro.leadId,
        corretorId: registro.corretorId,
        tipo: 'whatsapp',
        observacoes: registro.observacoes,
        createdAt: registro.createdAt
      });
      stats.interacoes++;
    } catch (err) {
      if (!err.message.includes('Duplicate entry')) {
        console.error(`Erro ao migrar WhatsApp ${registro.id}:`, err.message);
        stats.erros++;
      }
    }
  }
  
  console.log(`✅ ${stats.interacoes} interações migradas\n`);
  
  // 2. Migrar visitas
  console.log('👁️ Migrando visitas...');
  const visitasHistorico = await db
    .select()
    .from(leadHistory)
    .where(
      and(
        eq(leadHistory.tipo, 'mudanca_status'),
        eq(leadHistory.statusNovo, 'visita_realizada')
      )
    );
  
  for (const registro of visitasHistorico) {
    try {
      await db.insert(visitas).values({
        leadId: registro.leadId,
        corretorId: registro.corretorId,
        observacoes: registro.observacoes,
        createdAt: registro.createdAt
      });
      stats.visitas++;
    } catch (err) {
      if (!err.message.includes('Duplicate entry')) {
        console.error(`Erro ao migrar visita ${registro.id}:`, err.message);
        stats.erros++;
      }
    }
  }
  
  console.log(`✅ ${stats.visitas} visitas migradas\n`);
  
  // 3. Migrar documentações
  console.log('📄 Migrando documentações...');
  const documentacoesHistorico = await db
    .select()
    .from(leadHistory)
    .where(
      and(
        eq(leadHistory.tipo, 'mudanca_status'),
        eq(leadHistory.statusNovo, 'documentacao_enviada')
      )
    );
  
  for (const registro of documentacoesHistorico) {
    try {
      await db.insert(documentacoes).values({
        leadId: registro.leadId,
        corretorId: registro.corretorId,
        observacoes: registro.observacoes,
        createdAt: registro.createdAt
      });
      stats.documentacoes++;
    } catch (err) {
      if (!err.message.includes('Duplicate entry')) {
        console.error(`Erro ao migrar documentação ${registro.id}:`, err.message);
        stats.erros++;
      }
    }
  }
  
  console.log(`✅ ${stats.documentacoes} documentações migradas\n`);
  
  // 4. Migrar análises de crédito
  console.log('💳 Migrando análises de crédito...');
  const analisesHistorico = await db
    .select()
    .from(leadHistory)
    .where(
      and(
        eq(leadHistory.tipo, 'mudanca_status'),
        eq(leadHistory.statusNovo, 'analise_credito')
      )
    );
  
  for (const registro of analisesHistorico) {
    try {
      await db.insert(analises_credito).values({
        leadId: registro.leadId,
        corretorId: registro.corretorId,
        observacoes: registro.observacoes,
        createdAt: registro.createdAt
      });
      stats.analises_credito++;
    } catch (err) {
      if (!err.message.includes('Duplicate entry')) {
        console.error(`Erro ao migrar análise de crédito ${registro.id}:`, err.message);
        stats.erros++;
      }
    }
  }
  
  console.log(`✅ ${stats.analises_credito} análises de crédito migradas\n`);
  
  // 5. Migrar contratos
  console.log('📝 Migrando contratos...');
  const contratosHistorico = await db
    .select()
    .from(leadHistory)
    .where(
      and(
        eq(leadHistory.tipo, 'mudanca_status'),
        eq(leadHistory.statusNovo, 'contrato_fechado')
      )
    );
  
  for (const registro of contratosHistorico) {
    try {
      await db.insert(contratos).values({
        leadId: registro.leadId,
        corretorId: registro.corretorId,
        observacoes: registro.observacoes,
        createdAt: registro.createdAt
      });
      stats.contratos++;
    } catch (err) {
      if (!err.message.includes('Duplicate entry')) {
        console.error(`Erro ao migrar contrato ${registro.id}:`, err.message);
        stats.erros++;
      }
    }
  }
  
  console.log(`✅ ${stats.contratos} contratos migrados\n`);
  
  // Resumo final
  console.log('═══════════════════════════════════════');
  console.log('📊 RESUMO DA MIGRAÇÃO');
  console.log('═══════════════════════════════════════');
  console.log(`📞 Interações:        ${stats.interacoes}`);
  console.log(`👁️  Visitas:           ${stats.visitas}`);
  console.log(`📄 Documentações:     ${stats.documentacoes}`);
  console.log(`💳 Análises Crédito:  ${stats.analises_credito}`);
  console.log(`📝 Contratos:         ${stats.contratos}`);
  console.log(`───────────────────────────────────────`);
  console.log(`✅ Total migrado:     ${stats.interacoes + stats.visitas + stats.documentacoes + stats.analises_credito + stats.contratos}`);
  console.log(`❌ Erros:             ${stats.erros}`);
  console.log('═══════════════════════════════════════\n');
  
  console.log('✨ Migração concluída com sucesso!');
  
} catch (error) {
  console.error('❌ Erro fatal durante migração:', error);
  process.exit(1);
} finally {
  await connection.end();
}
