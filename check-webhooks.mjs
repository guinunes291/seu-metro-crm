import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: 'gateway01.us-east-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: process.env.DB_USER || '2RP4vJNwQdnDDxS.root',
  password: process.env.DB_PASSWORD,
  database: 'seu_metro_crm',
  ssl: { rejectUnauthorized: true }
});

const [rows] = await connection.execute('SELECT id, webhookToken, nome, fonte, ativo, leadsRecebidos FROM webhook_config');
console.log('Webhooks configurados:');
console.log(JSON.stringify(rows, null, 2));

await connection.end();
