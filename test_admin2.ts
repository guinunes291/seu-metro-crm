import { getDashboardMetrics } from './server/db';

async function main() {
  console.log('=== Teste com corretoresIds: null ===');
  const r1 = await getDashboardMetrics({ corretoresIds: null });
  console.log('Result null:', JSON.stringify(r1));
  
  console.log('\n=== Teste com corretoresIds: undefined ===');
  const r2 = await getDashboardMetrics({ corretoresIds: undefined });
  console.log('Result undefined:', JSON.stringify(r2));
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
