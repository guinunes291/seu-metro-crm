import { getContratosFechados, getVGVPorEquipeProjeto } from './server/db';

(async () => {
  // Simular o que o frontend envia para "this_year": startOfYear com milissegundos
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  
  console.log('startOfYear:', startOfYear.toISOString(), 'ms:', startOfYear.getMilliseconds());
  console.log('endOfDay:', endOfDay.toISOString(), 'ms:', endOfDay.getMilliseconds());
  
  // Teste 1: com datas com milissegundos (como o frontend envia)
  try {
    const contratos = await getContratosFechados({
      dataInicio: startOfYear,
      dataFim: endOfDay,
    });
    console.log('Contratos com ms=999:', contratos.length, 'registros');
  } catch(e: any) {
    console.error('Contratos com ms=999 FALHOU:', e.message.slice(0, 200));
  }
  
  // Teste 2: com datas sem milissegundos (após parseDate)
  const startOfYearClean = new Date(startOfYear);
  startOfYearClean.setMilliseconds(0);
  const endOfDayClean = new Date(endOfDay);
  endOfDayClean.setMilliseconds(0);
  
  try {
    const contratos = await getContratosFechados({
      dataInicio: startOfYearClean,
      dataFim: endOfDayClean,
    });
    console.log('Contratos com ms=0:', contratos.length, 'registros');
  } catch(e: any) {
    console.error('Contratos com ms=0 FALHOU:', e.message.slice(0, 200));
  }
  
  // Teste 3: VGV com datas com milissegundos
  try {
    const vgv = await getVGVPorEquipeProjeto({
      dataInicio: startOfYear,
      dataFim: endOfDay,
    });
    console.log('VGV com ms=999:', JSON.stringify(vgv));
  } catch(e: any) {
    console.error('VGV com ms=999 FALHOU:', e.message.slice(0, 200));
  }
  
  process.exit(0);
})();
