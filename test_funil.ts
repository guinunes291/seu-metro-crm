import { getEvolucaoFunil } from './server/db';

(async () => {
  try {
    const funil = await getEvolucaoFunil(30, null);
    console.log('Funil 30 dias:', JSON.stringify(funil));
    process.exit(0);
  } catch(e: any) {
    console.error('Erro funil:', e.message);
    process.exit(1);
  }
})();
