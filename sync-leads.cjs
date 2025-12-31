const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const mysql = require('mysql2/promise');

async function syncLeads() {
  console.log('Iniciando sincronização de leads...');
  
  // Conectar ao banco de dados usando DATABASE_URL
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL não configurada');
  }
  
  const connection = await mysql.createConnection(dbUrl);
  
  console.log('Conectado ao banco de dados');
  
  // Buscar todos os leads com dados relacionados
  const [rows] = await connection.execute(`
    SELECT 
      l.id,
      l.createdAt,
      l.nome,
      l.email,
      l.telefone,
      l.cpf,
      l.origem,
      p.nome as projetoNome,
      u.name as corretorNome,
      l.status,
      l.dataDistribuicao,
      l.ultimoContato,
      l.observacoes,
      l.campanha,
      l.faixaRenda
    FROM leads l
    LEFT JOIN projects p ON l.projectId = p.id
    LEFT JOIN users u ON l.corretorId = u.id
    ORDER BY l.id ASC
  `);
  
  console.log('Leads encontrados:', rows.length);
  
  await connection.end();
  
  // Autenticar com Google Sheets
  const auth = new GoogleAuth({
    keyFile: './server/google-service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  
  const SPREADSHEET_ID = '1or0l4OToJUsGW8FpyGjSOovjc27riV4Wmi0YWQze8X8';
  
  // Formatar dados para a planilha
  function formatDate(date) {
    if (!date) return '';
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  
  const values = rows.map(lead => [
    lead.id,
    formatDate(lead.createdAt),
    lead.nome || '',
    lead.email || '',
    lead.telefone || '',
    lead.cpf || '',
    lead.origem || '',
    lead.projetoNome || '',
    lead.corretorNome || '',
    lead.status || '',
    formatDate(lead.dataDistribuicao),
    formatDate(lead.ultimoContato),
    lead.observacoes || '',
    lead.campanha || '',
    lead.faixaRenda || '',
  ]);
  
  console.log('Preparando para enviar', values.length, 'linhas para a planilha...');
  
  // Limpar dados existentes (exceto header)
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Leads!A2:O',
  });
  
  // Inserir novos dados
  if (values.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Leads!A2:O' + (values.length + 1),
      valueInputOption: 'RAW',
      requestBody: { values },
    });
  }
  
  console.log('Sincronização concluída! ' + values.length + ' leads exportados.');
}

syncLeads().catch(console.error);
