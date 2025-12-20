import mysql from 'mysql2/promise';

// Configuração do banco de dados
const DATABASE_URL = process.env.DATABASE_URL;

async function seedPresenca() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    console.log('Buscando corretores...');
    
    // Buscar corretores existentes
    const [corretores] = await connection.execute(
      "SELECT id, name FROM users WHERE role = 'corretor' LIMIT 5"
    );
    
    if (corretores.length === 0) {
      console.log('Nenhum corretor encontrado. Criando corretor de teste...');
      await connection.execute(
        `INSERT INTO users (openId, name, email, role, status) 
         VALUES ('test-corretor-1', 'Corretor Teste 1', 'corretor1@teste.com', 'corretor', 'presente')`
      );
      const [newCorretores] = await connection.execute(
        "SELECT id, name FROM users WHERE role = 'corretor' LIMIT 5"
      );
      corretores.push(...newCorretores);
    }
    
    console.log(`Encontrados ${corretores.length} corretores`);
    
    // Gerar dados de presença para os últimos 30 dias
    const hoje = new Date();
    const diasParaGerar = 30;
    
    for (const corretor of corretores) {
      console.log(`Gerando dados para corretor: ${corretor.name || corretor.id}`);
      
      for (let i = 0; i < diasParaGerar; i++) {
        const data = new Date(hoje);
        data.setDate(data.getDate() - i);
        
        // Pular fins de semana (0 = domingo, 6 = sábado)
        if (data.getDay() === 0 || data.getDay() === 6) continue;
        
        // Simular variação de presença (80% chance de estar presente)
        const estaPresente = Math.random() > 0.2;
        
        if (estaPresente) {
          // Horário de entrada entre 8:00 e 10:00
          const horaEntrada = 8 + Math.floor(Math.random() * 2);
          const minutoEntrada = Math.floor(Math.random() * 60);
          
          // Horário de saída entre 17:00 e 19:00
          const horaSaida = 17 + Math.floor(Math.random() * 2);
          const minutoSaida = Math.floor(Math.random() * 60);
          
          const entrada = new Date(data);
          entrada.setHours(horaEntrada, minutoEntrada, 0, 0);
          
          const saida = new Date(data);
          saida.setHours(horaSaida, minutoSaida, 0, 0);
          
          // Calcular minutos trabalhados
          const minutosPresente = Math.floor((saida - entrada) / (1000 * 60));
          const minutosAusente = 600 - minutosPresente; // 10 horas de expediente
          
          // Determinar status do dia
          let statusDia = 'presente';
          if (minutosPresente < 240) statusDia = 'ausente'; // menos de 4h
          else if (minutosPresente < 480) statusDia = 'parcial'; // menos de 8h
          
          // Inserir registro de entrada
          await connection.execute(
            `INSERT INTO historico_presenca (corretorId, tipo, statusAnterior, statusNovo, origem, createdAt)
             VALUES (?, 'entrada', 'ausente', 'presente', 'manual', ?)`,
            [corretor.id, entrada]
          );
          
          // Inserir registro de saída
          await connection.execute(
            `INSERT INTO historico_presenca (corretorId, tipo, statusAnterior, statusNovo, origem, createdAt)
             VALUES (?, 'saida', 'presente', 'ausente', 'manual', ?)`,
            [corretor.id, saida]
          );
          
          // Inserir resumo diário
          const dataResumo = new Date(data);
          dataResumo.setHours(0, 0, 0, 0);
          
          await connection.execute(
            `INSERT INTO resumo_presenca_diaria 
             (corretorId, data, primeiraEntrada, ultimaSaida, totalMinutosPresente, totalMinutosAusente, statusDia, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE 
             primeiraEntrada = VALUES(primeiraEntrada),
             ultimaSaida = VALUES(ultimaSaida),
             totalMinutosPresente = VALUES(totalMinutosPresente),
             totalMinutosAusente = VALUES(totalMinutosAusente),
             statusDia = VALUES(statusDia),
             updatedAt = NOW()`,
            [corretor.id, dataResumo, entrada, saida, minutosPresente, minutosAusente, statusDia]
          );
        } else {
          // Dia ausente
          const dataResumo = new Date(data);
          dataResumo.setHours(0, 0, 0, 0);
          
          await connection.execute(
            `INSERT INTO resumo_presenca_diaria 
             (corretorId, data, primeiraEntrada, ultimaSaida, totalMinutosPresente, totalMinutosAusente, statusDia, createdAt, updatedAt)
             VALUES (?, ?, NULL, NULL, 0, 600, 'ausente', NOW(), NOW())
             ON DUPLICATE KEY UPDATE 
             primeiraEntrada = NULL,
             ultimaSaida = NULL,
             totalMinutosPresente = 0,
             totalMinutosAusente = 600,
             statusDia = 'ausente',
             updatedAt = NOW()`,
            [corretor.id, dataResumo]
          );
        }
      }
    }
    
    console.log('Dados de presença gerados com sucesso!');
    
    // Verificar dados inseridos
    const [resumos] = await connection.execute(
      'SELECT COUNT(*) as total FROM resumo_presenca_diaria'
    );
    console.log(`Total de resumos diários: ${resumos[0].total}`);
    
    const [historicos] = await connection.execute(
      'SELECT COUNT(*) as total FROM historico_presenca'
    );
    console.log(`Total de registros de histórico: ${historicos[0].total}`);
    
  } catch (error) {
    console.error('Erro ao gerar dados de presença:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

seedPresenca().catch(console.error);
