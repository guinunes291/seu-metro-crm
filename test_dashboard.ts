import { getContratosFechados, getVGVPorEquipeProjeto, getMetricasHistoricas } from './server/db';

(async () => {
  try {
    // Teste 1: sem filtros (equivalente a 'all')
    const contratos = await getContratosFechados({});
    console.log('Contratos sem filtro:', contratos.length, 'registros');
    if (contratos.length > 0) console.log('Primeiro:', JSON.stringify(contratos[0]).slice(0, 200));
    
    // Teste 2: VGV sem filtros
    const vgv = await getVGVPorEquipeProjeto({});
    console.log('VGV sem filtro:', JSON.stringify(vgv));
    
    // Teste 3: Histórico 30 dias
    const hist = await getMetricasHistoricas(30, null);
    const totalLeads = hist.reduce((s, d) => s + d.total, 0);
    console.log('Histórico 30 dias:', hist.length, 'dias, total leads:', totalLeads);
    
    process.exit(0);
  } catch(e: any) {
    console.error('Erro:', e.message, e.stack);
    process.exit(1);
  }
})();
