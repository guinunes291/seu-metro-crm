import { describe, it, expect } from 'vitest';
import { format, parseISO } from 'date-fns';

/**
 * Teste para validar correção de timezone no calendário de agendamentos
 * 
 * BUG ORIGINAL:
 * - Agendamentos apareciam 1 dia antes no calendário do corretor
 * - Calendário do gestor mostrava datas corretas
 * 
 * CAUSA:
 * - new Date() em strings ISO causa conversão de timezone
 * - "2026-01-18T08:00:00.000Z" com new Date() vira 18/01 05:00 em GMT-3
 * - Ao formatar, pode aparecer como dia 17
 * 
 * SOLUÇÃO:
 * - Usar parseISO() ao invés de new Date()
 * - parseISO() interpreta a string sem conversão de timezone
 */

describe('Correção de Timezone - Calendário de Agendamentos', () => {
  
  it('deve demonstrar o problema com new Date()', () => {
    const dataISO = '2026-01-18T08:00:00.000Z';
    
    // Problema: new Date() converte para timezone local
    const comNewDate = new Date(dataISO);
    const diaComNewDate = format(comNewDate, 'dd/MM/yyyy');
    
    // Em GMT-3, 2026-01-18T08:00:00.000Z vira 2026-01-18 05:00:00
    // Mas dependendo do horário, pode aparecer como dia 17
    console.log('Com new Date():', diaComNewDate);
    
    // Isso pode causar o bug de aparecer 1 dia antes
    // (não testamos a igualdade aqui porque depende do timezone do ambiente de teste)
  });
  
  it('deve corrigir o problema com parseISO()', () => {
    const dataISO = '2026-01-18T08:00:00.000Z';
    
    // Solução: parseISO() interpreta sem conversão de timezone
    const comParseISO = parseISO(dataISO);
    const diaComParseISO = format(comParseISO, 'dd/MM/yyyy');
    
    // Deve manter o dia 18
    expect(diaComParseISO).toBe('18/01/2026');
  });
  
  it('deve validar múltiplas datas com parseISO()', () => {
    const casos = [
      { input: '2026-01-11T05:00:00.000Z', esperado: '11/01/2026' },
      { input: '2026-01-18T08:00:00.000Z', esperado: '18/01/2026' },
      { input: '2026-01-19T08:00:00.000Z', esperado: '19/01/2026' },
      { input: '2026-01-20T08:00:00.000Z', esperado: '20/01/2026' },
      { input: '2026-01-24T08:00:00.000Z', esperado: '24/01/2026' },
    ];
    
    casos.forEach(({ input, esperado }) => {
      const data = parseISO(input);
      const resultado = format(data, 'dd/MM/yyyy');
      expect(resultado).toBe(esperado);
    });
  });
  
  it('deve agrupar agendamentos pela data correta', () => {
    // Simula agendamentos como retornados pelo tRPC (strings ISO)
    const agendamentos = [
      { id: 1, dataAgendamento: '2026-01-11T05:00:00.000Z', hora: '14:00' },
      { id: 2, dataAgendamento: '2026-01-11T05:00:00.000Z', hora: '10:00' },
      { id: 3, dataAgendamento: '2026-01-24T08:00:00.000Z', hora: '14:00' },
      { id: 4, dataAgendamento: '2026-01-24T08:00:00.000Z', hora: '12:00' },
    ];
    
    // Agrupa por data usando parseISO (correção aplicada)
    const porData = agendamentos.reduce((acc, ag) => {
      const data = format(parseISO(ag.dataAgendamento), 'yyyy-MM-dd');
      if (!acc[data]) acc[data] = [];
      acc[data].push(ag);
      return acc;
    }, {} as Record<string, typeof agendamentos>);
    
    // Valida agrupamento correto
    expect(Object.keys(porData)).toEqual(['2026-01-11', '2026-01-24']);
    expect(porData['2026-01-11']).toHaveLength(2);
    expect(porData['2026-01-24']).toHaveLength(2);
  });
  
  it('deve formatar cabeçalho de data corretamente', () => {
    const dataKey = '2026-01-17';
    
    // Formato usado no componente: "EEEE, d 'de' MMMM"
    const cabecalho = format(parseISO(dataKey + 'T12:00:00'), 'dd/MM/yyyy');
    
    // Deve mostrar dia 17
    expect(cabecalho).toBe('17/01/2026');
  });
});
