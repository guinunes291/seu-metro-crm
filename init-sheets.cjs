const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');

async function test() {
  const auth = new GoogleAuth({
    keyFile: './server/google-service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  
  const SPREADSHEET_ID = '1or0l4OToJUsGW8FpyGjSOovjc27riV4Wmi0YWQze8X8';
  const HEADERS = ['ID', 'Data Criação', 'Nome', 'Email', 'Telefone', 'CPF', 'Origem', 'Projeto Interesse', 'Corretor', 'Status', 'Data Distribuição', 'Último Contato', 'Observações', 'Campanha', 'Faixa de Renda'];
  
  // Verificar se aba Leads existe
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const leadsSheet = spreadsheet.data.sheets?.find(s => s.properties?.title === 'Leads');
  
  if (!leadsSheet) {
    // Criar aba Leads
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          addSheet: { properties: { title: 'Leads' } }
        }]
      }
    });
    console.log('Aba Leads criada');
  } else {
    console.log('Aba Leads já existe');
  }
  
  // Adicionar headers
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Leads!A1:O1',
    valueInputOption: 'RAW',
    requestBody: { values: [HEADERS] }
  });
  
  console.log('Headers adicionados com sucesso!');
}

test().catch(console.error);
