#!/usr/bin/env node
/**
 * Script para associar projetos aos leads importados baseado no arquivo CSV.
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import mysql from 'mysql2/promise';

const CSV_PATH = '/home/ubuntu/upload/GUI(1).csv';

async function main() {
  console.log('🔗 Conectando ao banco de dados...');
  
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    // 1. Buscar todos os projetos do banco
    console.log('\n📦 Buscando projetos do banco de dados...');
    const [projetos] = await connection.execute(
      'SELECT id, nome FROM projects WHERE status = "ativo"'
    );
    
    const projetosMap = new Map();
    for (const projeto of projetos) {
      projetosMap.set(projeto.nome.trim().toLowerCase(), projeto.id);
    }
    
    console.log(`✅ Encontrados ${projetosMap.size} projetos ativos`);
    
    // 2. Ler o CSV
    console.log('\n📄 Lendo arquivo CSV...');
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ';',
      bom: true,
    });
    
    console.log(`✅ Lidos ${records.length} registros do CSV`);
    
    // 3. Criar mapeamento telefone → empreendimento
    const mapeamento = new Map();
    for (const record of records) {
      const telefone = (record.Telefone || '').trim().replace(/'/g, '').replace(/\+/g, '');
      const empreendimento = (record.Empreendimento || '').trim();
      
      if (telefone && empreendimento) {
        mapeamento.set(telefone, empreendimento);
      }
    }
    
    console.log(`✅ Mapeados ${mapeamento.size} leads do CSV`);
    
    // 4. Buscar leads sem projeto
    console.log('\n🔍 Buscando leads sem projeto...');
    const [leadsSemProjeto] = await connection.execute(
      'SELECT id, telefone FROM leads WHERE projectId IS NULL'
    );
    
    console.log(`✅ Encontrados ${leadsSemProjeto.length} leads sem projeto`);
    
    // 5. Associar projetos aos leads
    console.log('\n🔄 Associando projetos aos leads...');
    let atualizados = 0;
    let semMatch = 0;
    const projetosNaoEncontrados = new Set();
    
    for (const lead of leadsSemProjeto) {
      const telefone = (lead.telefone || '').trim().replace(/\+/g, '');
      
      // Buscar empreendimento no mapeamento
      const empreendimento = mapeamento.get(telefone);
      
      if (!empreendimento) {
        semMatch++;
        continue;
      }
      
      // Buscar ID do projeto
      const projetoId = projetosMap.get(empreendimento.trim().toLowerCase());
      
      if (!projetoId) {
        projetosNaoEncontrados.add(empreendimento);
        continue;
      }
      
      // Atualizar lead
      await connection.execute(
        'UPDATE leads SET projectId = ? WHERE id = ?',
        [projetoId, lead.id]
      );
      atualizados++;
      
      if (atualizados % 100 === 0) {
        console.log(`   Processados ${atualizados} leads...`);
      }
    }
    
    // 6. Relatório final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RELATÓRIO FINAL');
    console.log('='.repeat(60));
    console.log(`✅ Leads atualizados: ${atualizados}`);
    console.log(`⚠️  Leads sem match no CSV: ${semMatch}`);
    console.log(`❌ Empreendimentos não encontrados: ${projetosNaoEncontrados.size}`);
    
    if (projetosNaoEncontrados.size > 0) {
      console.log('\n📋 Empreendimentos não encontrados (primeiros 20):');
      const lista = Array.from(projetosNaoEncontrados).sort().slice(0, 20);
      for (const emp of lista) {
        console.log(`   - ${emp}`);
      }
      if (projetosNaoEncontrados.size > 20) {
        console.log(`   ... e mais ${projetosNaoEncontrados.size - 20} empreendimentos`);
      }
    }
    
    console.log('\n✅ Script concluído!');
    
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
