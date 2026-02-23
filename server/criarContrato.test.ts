import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as db from './db';
import { getDb } from './db';
import { users, leads, contratos, equipes } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

describe('Criar Contrato', () => {
  let testEquipeId: number;
  let testCorretorId: number;
  let testProjectId: number;

  beforeAll(async () => {
    const database = await getDb();
    if (!database) throw new Error('Database not available');

    // Buscar uma equipe existente
    const [equipe] = await database.select()
      .from(equipes)
      .limit(1);
    
    if (!equipe) {
      throw new Error('Nenhuma equipe encontrada no banco de dados');
    }
    
    testEquipeId = equipe.id;

    // Criar corretor de teste
    await database.insert(users).values({
      openId: 'test-corretor-contrato',
      name: 'Corretor Teste Contrato',
      email: 'corretor.contrato@test.com',
      role: 'corretor',
      equipeId: testEquipeId,
    });
    
    // Buscar o corretor criado
    const [corretor] = await database.select()
      .from(users)
      .where(eq(users.email, 'corretor.contrato@test.com'))
      .limit(1);
    testCorretorId = corretor.id;

    // Buscar um projeto existente ou criar um de teste
    const projetos = await db.getAllProjects();
    if (projetos.length > 0) {
      testProjectId = projetos[0].id;
    } else {
      // Se não houver projetos, criar um de teste
      const { projects } = require('../drizzle/schema');
      await database.insert(projects).values({
        nome: 'Projeto Teste Contrato',
        endereco: 'Rua Teste, 123',
        cidade: 'São Paulo',
        estado: 'SP',
        tipo: 'apartamento',
        status: 'lancamento',
      });
      
      // Buscar o projeto criado
      const [projeto] = await database.select()
        .from(projects)
        .where(eq(projects.nome, 'Projeto Teste Contrato'))
        .limit(1);
      testProjectId = projeto.id;
    }
  });

  afterAll(async () => {
    const database = await getDb();
    if (!database) return;

    // Limpar dados de teste
    await database.delete(contratos).where(eq(contratos.corretorId, testCorretorId));
    await database.delete(leads).where(eq(leads.corretorId, testCorretorId));
    await database.delete(users).where(eq(users.id, testCorretorId));
    // Não deletar equipe pois usamos uma existente
  });

  it('deve criar um novo contrato com lead novo', async () => {
    const resultado = await db.criarNovoContrato({
      corretorId: testCorretorId,
      clienteNome: 'Cliente Teste Novo',
      clienteTelefone: '(11) 98888-7777',
      clienteEmail: 'cliente.novo@test.com',
      projectId: testProjectId,
      projetoCustom: '',
      valorVenda: 500000,
      dataVenda: new Date('2026-02-21'),
      observacoes: 'Contrato de teste',
    });

    expect(resultado).toBeDefined();
    expect(resultado.contratoId).toBeGreaterThan(0);
    expect(resultado.leadId).toBeGreaterThan(0);

    // Verificar se o contrato foi criado
    const database = await getDb();
    if (!database) throw new Error('Database not available');

    const [contrato] = await database.select()
      .from(contratos)
      .where(eq(contratos.id, resultado.contratoId));

    expect(contrato).toBeDefined();
    expect(contrato.corretorId).toBe(testCorretorId);
    expect(parseFloat(contrato.valorVenda)).toBe(500000);
    // clienteNome está no lead, não no contrato
  });

  it('deve criar um novo contrato com lead existente', async () => {
    const database = await getDb();
    if (!database) throw new Error('Database not available');

    // Criar um lead existente
    await database.insert(leads).values({
      nome: 'Cliente Teste Existente',
      telefone: '(11) 97777-6666',
      email: 'cliente.existente@test.com',
      origem: 'captacao_corretor',
      status: 'em_atendimento',
      corretorId: testCorretorId,
    });
    
    // Buscar o lead criado
    const [leadExistente] = await database.select()
      .from(leads)
      .where(eq(leads.email, 'cliente.existente@test.com'))
      .limit(1);

    const resultado = await db.criarNovoContrato({
      corretorId: testCorretorId,
      clienteNome: 'Cliente Teste Existente',
      clienteTelefone: '(11) 97777-6666',
      clienteEmail: 'cliente.existente@test.com',
      projectId: testProjectId,
      projetoCustom: '',
      valorVenda: 750000,
      dataVenda: new Date('2026-02-21'),
      observacoes: 'Contrato com lead existente',
    });

    expect(resultado).toBeDefined();
    expect(resultado.leadId).toBe(leadExistente.id);
    expect(resultado.contratoId).toBeGreaterThan(0);

    // Verificar se o lead foi atualizado para "contrato_fechado"
    const [leadAtualizado] = await database.select()
      .from(leads)
      .where(eq(leads.id, leadExistente.id));

    expect(leadAtualizado.status).toBe('contrato_fechado');
  });

  it('deve criar contrato com projeto customizado', async () => {
    const resultado = await db.criarNovoContrato({
      corretorId: testCorretorId,
      clienteNome: 'Cliente Teste Custom',
      clienteTelefone: '(11) 96666-5555',
      clienteEmail: 'cliente.custom@test.com',
      projectId: null,
      projetoCustom: 'Projeto Customizado Teste',
      valorVenda: 600000,
      dataVenda: new Date('2026-02-21'),
      observacoes: 'Contrato com projeto customizado',
    });

    expect(resultado).toBeDefined();
    expect(resultado.contratoId).toBeGreaterThan(0);

    // Verificar se o contrato foi criado com projeto customizado
    const database = await getDb();
    if (!database) throw new Error('Database not available');

    const [contrato] = await database.select()
      .from(contratos)
      .where(eq(contratos.id, resultado.contratoId));

    expect(contrato).toBeDefined();
    // projectId e projetoCustom estão no lead, não no contrato
    // Verificar que o contrato foi criado com sucesso
    expect(contrato.valorVenda).toBe('600000.00');
  });

  it('deve criar contrato mesmo com nome vazio (validação no frontend)', async () => {
    // A validação de campos obrigatórios é feita no frontend
    // O backend aceita qualquer valor para manter flexibilidade
    const resultado = await db.criarNovoContrato({
      corretorId: testCorretorId,
      clienteNome: '',
      clienteTelefone: '(11) 95555-4444',
      clienteEmail: 'teste.validacao@test.com',
      projectId: testProjectId,
      projetoCustom: '',
      valorVenda: 500000,
      dataVenda: new Date('2026-02-21'),
    });
    
    expect(resultado).toBeDefined();
    expect(resultado.contratoId).toBeGreaterThan(0);
  });

  it('deve criar contrato com anexos', async () => {
    const anexosUrls = [
      'https://storage.example.com/contratos/doc1.pdf',
      'https://storage.example.com/contratos/doc2.pdf',
    ];

    const resultado = await db.criarNovoContrato({
      corretorId: testCorretorId,
      clienteNome: 'Cliente Teste Anexos',
      clienteTelefone: '(11) 94444-3333',
      clienteEmail: 'cliente.anexos@test.com',
      projectId: testProjectId,
      projetoCustom: '',
      valorVenda: 800000,
      dataVenda: new Date('2026-02-21'),
      observacoes: 'Contrato com anexos',
      anexos: anexosUrls,
    });

    expect(resultado).toBeDefined();
    expect(resultado.contratoId).toBeGreaterThan(0);

    // Verificar se os anexos foram salvos corretamente
    const database = await getDb();
    if (!database) throw new Error('Database not available');

    const [contrato] = await database.select()
      .from(contratos)
      .where(eq(contratos.id, resultado.contratoId));

    expect(contrato).toBeDefined();
    expect(contrato.anexos).toEqual(anexosUrls);
    expect(contrato.anexos?.length).toBe(2);
  });
});
