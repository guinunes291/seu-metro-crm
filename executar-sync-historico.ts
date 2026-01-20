/**
 * Script temporário para executar sincronização histórica via tRPC
 */

import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './server/routers';
import superjson from 'superjson';

const client = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/api/trpc',
      headers: {
        // Simular autenticação de gestor
        'x-test-user': 'gestor',
      },
    }),
  ],
});

async function main() {
  console.log('Iniciando sincronização histórica...\n');
  
  try {
    const resultado = await client.syncHistorico.executar.mutate();
    
    console.log('\n✅ Sincronização histórica concluída com sucesso!');
    console.log(`📊 Datas processadas: ${resultado.datasProcessadas}`);
    console.log(`📅 Período: ${resultado.periodoInicio} até ${resultado.periodoFim}`);
  } catch (error: any) {
    console.error('\n❌ Erro ao executar sincronização histórica:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
