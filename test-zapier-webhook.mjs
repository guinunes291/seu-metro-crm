import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config();

async function testarWebhookZapier() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    // 1. Criar lead de teste
    const [result] = await connection.execute(
      `INSERT INTO leads (nome, telefone, email, origem, status, corretorId, origemWebhook, projectId, campanha, faixaRenda, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        '_TESTE_Lead_Zapier_WhatsApp',
        '11987654321',
        'teste@zapier.com',
        'facebook',
        'aguardando_atendimento',
        5055943, // Guilherme Nunes
        true,
        null,
        'Teste Integração Zapier',
        'R$ 5.000 - R$ 10.000'
      ]
    );
    
    const leadId = result.insertId;
    console.log('✅ Lead de teste criado - ID:', leadId);
    
    // 2. Buscar dados completos do lead e corretor
    const [leads] = await connection.execute(
      `SELECT l.*, p.nome as projectNome, u.name as corretorNome, u.telefone as corretorTelefone, u.email as corretorEmail
       FROM leads l
       LEFT JOIN projects p ON l.projectId = p.id
       LEFT JOIN users u ON l.corretorId = u.id
       WHERE l.id = ?`,
      [leadId]
    );
    
    const lead = leads[0];
    
    // 3. Preparar payload para Zapier
    const payload = {
      evento: 'lead_distribuido',
      timestamp: new Date().toISOString(),
      corretor: {
        id: lead.corretorId,
        nome: lead.corretorNome,
        telefone: lead.corretorTelefone,
        email: lead.corretorEmail
      },
      lead: {
        id: lead.id,
        nome: lead.nome,
        telefone: lead.telefone,
        email: lead.email,
        status: lead.status,
        origem: lead.origem,
        projeto: lead.projectNome || 'Sem projeto',
        campanha: lead.campanha,
        faixaRenda: lead.faixaRenda
      }
    };
    
    console.log('\n📤 Enviando para Zapier:', JSON.stringify(payload, null, 2));
    
    // 4. Enviar para Zapier
    const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
    
    if (!webhookUrl) {
      console.log('❌ ZAPIER_WEBHOOK_URL não configurada');
      return;
    }
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      console.log('\n✅ Webhook enviado com sucesso para Zapier!');
      console.log('📱 O Guilherme deve receber WhatsApp em instantes...');
      console.log('\n🔍 Verifique:');
      console.log('   1. WhatsApp do Guilherme: (11) 93078-5690');
      console.log('   2. Dashboard do Zapier para ver o histórico');
    } else {
      const errorText = await response.text();
      console.log('\n❌ Erro ao enviar webhook:', response.status, errorText);
    }
    
  } finally {
    await connection.end();
  }
}

testarWebhookZapier().catch(console.error);
