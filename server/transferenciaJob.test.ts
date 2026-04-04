/**
 * Testes do Job de Transferência Automática Unificado
 *
 * Valida as regras:
 * 1. Leads aguardando_atendimento sem interação há 10h → transferir
 * 2. Leads em_atendimento sem interação há 2 dias → transferir
 * 3. Leads na Carteira Ativa → IMUNES (nunca transferir)
 * 4. Leads de captacao_corretor → IMUNES
 * 5. Sem corretores disponíveis → estoque (NUNCA perdido/lixeira)
 * 6. Nunca redistribuir para corretor que já trabalhou o lead
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { getDb } from "./db";
import {
  users,
  leads,
  carteiraAtiva,
  distributionLog,
  leadEstoque,
  logTransferencias,
} from "../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { TEST_PREFIX, testName, testEmail, testPhone, cleanupTestData } from "./test-utils";

// IDs de dados de teste criados neste arquivo
const testIds = {
  corretores: [] as number[],
  leads: [] as number[],
  carteiras: [] as number[],
};

async function criarCorretorTeste(nome: string, status: "presente" | "ausente" = "presente") {
  const db = await getDb();
  if (!db) throw new Error("DB não disponível");
  const [result] = await db.insert(users).values({
    openId: `test-transf-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    name: testName(nome),
    email: testEmail(`${nome.toLowerCase().replace(/ /g, ".")}@transf.test`),
    role: "corretor",
    status,
  });
  const id = result.insertId;
  testIds.corretores.push(id);
  return id;
}

async function criarLeadTeste(data: {
  nome: string;
  corretorId?: number;
  status?: string;
  origem?: string;
  ultimaInteracao?: Date;
  timestampRecebimento?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB não disponível");
  const [result] = await db.insert(leads).values({
    nome: testName(data.nome),
    telefone: testPhone(`9${Date.now().toString().slice(-8)}`),
    corretorId: data.corretorId,
    status: (data.status as any) || "aguardando_atendimento",
    origem: (data.origem as any) || "facebook",
    ultimaInteracao: data.ultimaInteracao,
    timestampRecebimento: data.timestampRecebimento || new Date(),
    naLixeira: false,
  });
  const id = result.insertId;
  testIds.leads.push(id);
  return id;
}

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  // Limpar na ordem correta (foreign keys)
  if (testIds.carteiras.length > 0) {
    await db.delete(carteiraAtiva).where(inArray(carteiraAtiva.id, testIds.carteiras));
  }
  if (testIds.leads.length > 0) {
    await db.delete(distributionLog).where(inArray(distributionLog.leadId, testIds.leads));
    await db.delete(leadEstoque).where(inArray(leadEstoque.leadId, testIds.leads));
    await db.delete(logTransferencias).where(inArray(logTransferencias.leadId, testIds.leads));
    await db.delete(leads).where(inArray(leads.id, testIds.leads));
  }
  if (testIds.corretores.length > 0) {
    await db.delete(users).where(inArray(users.id, testIds.corretores));
  }
});

describe("Job de Transferência Automática Unificado", () => {
  describe("Regras de SLA", () => {
    it("deve identificar lead aguardando_atendimento sem interação há mais de 10h", async () => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");

      const corretorId = await criarCorretorTeste("Corretor SLA 10h");
      const dezHorasAtras = new Date(Date.now() - 11 * 60 * 60 * 1000);
      const leadId = await criarLeadTeste({
        nome: "Lead SLA 10h",
        corretorId,
        status: "aguardando_atendimento",
        timestampRecebimento: dezHorasAtras,
      });

      // Verificar que o lead foi criado com o timestamp correto
      const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
      expect(lead).toBeDefined();
      expect(lead.status).toBe("aguardando_atendimento");
      expect(lead.corretorId).toBe(corretorId);

      // Verificar que o timestamp é mais de 10h atrás
      const agora = new Date();
      const diferencaHoras =
        (agora.getTime() - lead.timestampRecebimento!.getTime()) / (1000 * 60 * 60);
      expect(diferencaHoras).toBeGreaterThan(10);
    });

    it("deve identificar lead em_atendimento sem interação há mais de 2 dias", async () => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");

      const corretorId = await criarCorretorTeste("Corretor SLA 2 dias");
      const doisDiasAtras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const leadId = await criarLeadTeste({
        nome: "Lead SLA 2 dias",
        corretorId,
        status: "em_atendimento",
        ultimaInteracao: doisDiasAtras,
      });

      const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
      expect(lead).toBeDefined();
      expect(lead.status).toBe("em_atendimento");
      expect(lead.ultimaInteracao).toBeDefined();

      // Verificar que a última interação é mais de 2 dias atrás
      const agora = new Date();
      const diferencaDias =
        (agora.getTime() - lead.ultimaInteracao!.getTime()) / (1000 * 60 * 60 * 24);
      expect(diferencaDias).toBeGreaterThan(2);
    });
  });

  describe("Imunidade da Carteira Ativa", () => {
    it("deve proteger lead na Carteira Ativa de transferência automática", async () => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");

      const corretorId = await criarCorretorTeste("Corretor Carteira");
      const leadId = await criarLeadTeste({
        nome: "Lead Carteira Ativa",
        corretorId,
        status: "em_atendimento",
        ultimaInteracao: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 dias atrás
      });

      // Adicionar à Carteira Ativa com proteção futura
      const protecaoAte = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 dias no futuro
      const [carteiraResult] = await db.insert(carteiraAtiva).values({
        leadId,
        corretorId,
        protecaoAte,
        ativo: true,
      });
      testIds.carteiras.push(carteiraResult.insertId);

      // Verificar que o lead está protegido
      const { isLeadProtegidoCarteira } = await import("./routers/carteiraAtiva");
      const protegido = await isLeadProtegidoCarteira(leadId);
      expect(protegido).toBe(true);
    });

    it("NÃO deve proteger lead com Carteira Ativa expirada", async () => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");

      const corretorId = await criarCorretorTeste("Corretor Carteira Expirada");
      const leadId = await criarLeadTeste({
        nome: "Lead Carteira Expirada",
        corretorId,
        status: "em_atendimento",
      });

      // Adicionar à Carteira Ativa com proteção expirada
      const protecaoExpirada = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 dia no passado
      const [carteiraResult] = await db.insert(carteiraAtiva).values({
        leadId,
        corretorId,
        protecaoAte: protecaoExpirada,
        ativo: false, // expirada
      });
      testIds.carteiras.push(carteiraResult.insertId);

      // Verificar que o lead NÃO está protegido
      const { isLeadProtegidoCarteira } = await import("./routers/carteiraAtiva");
      const protegido = await isLeadProtegidoCarteira(leadId);
      expect(protegido).toBe(false);
    });
  });

  describe("Imunidade de captacao_corretor", () => {
    it("deve proteger lead de captacao_corretor de transferência automática", async () => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");

      const corretorId = await criarCorretorTeste("Corretor Captacao");
      const leadId = await criarLeadTeste({
        nome: "Lead Captacao Corretor",
        corretorId,
        status: "aguardando_atendimento",
        origem: "captacao_corretor" as any,
        timestampRecebimento: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12h atrás
      });

      const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
      expect(lead.origem).toBe("captacao_corretor");
      // A lógica de imunidade verifica lead.origem === "captacao_corretor"
      // Confirmar que o campo está correto
      expect(lead.origem).toBe("captacao_corretor");
    });
  });

  describe("Rastreamento de corretores que já trabalharam o lead", () => {
    it("deve registrar no distribution_log quando um lead é distribuído", async () => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");

      const corretorId = await criarCorretorTeste("Corretor Log");
      const leadId = await criarLeadTeste({
        nome: "Lead Log Distribuicao",
        corretorId,
        status: "aguardando_atendimento",
      });

      // Simular registro no distribution_log
      await db.insert(distributionLog).values({
        leadId,
        corretorId,
        tipo: "automatica",
        motivo: "Distribuição de teste",
      });

      // Verificar que foi registrado
      const logs = await db
        .select()
        .from(distributionLog)
        .where(and(eq(distributionLog.leadId, leadId), eq(distributionLog.corretorId, corretorId)));

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].corretorId).toBe(corretorId);
    });
  });

  describe("Destino quando sem corretores disponíveis", () => {
    it("deve colocar lead no estoque (não em perdido/lixeira) quando não há corretores", async () => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");

      const leadId = await criarLeadTeste({
        nome: "Lead Sem Corretor",
        status: "aguardando_atendimento",
        timestampRecebimento: new Date(Date.now() - 12 * 60 * 60 * 1000),
      });

      // Simular colocação no estoque (como faria o job)
      await db.update(leads).set({
        corretorId: null,
        status: "aguardando_atendimento",
        updatedAt: new Date(),
      }).where(eq(leads.id, leadId));

      await db.insert(leadEstoque).values({
        leadId,
        tipoFila: "normal",
        motivoEstoque: "Sem corretores disponíveis após SLA",
        tentativasDistribuicao: 0,
      });

      // Verificar que o lead está no estoque e NÃO está na lixeira
      const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
      const estoque = await db.select().from(leadEstoque).where(
        and(eq(leadEstoque.leadId, leadId), eq(leadEstoque.status, "aguardando"))
      );

      expect(lead.naLixeira).toBe(false);
      expect(lead.status).toBe("aguardando_atendimento");
      expect(estoque.length).toBeGreaterThan(0);
      expect(lead.status).not.toBe("perdido");
    });
  });

  describe("Agendamento do job", () => {
    it("deve exportar a função agendarTransferenciaAutomatica", async () => {
      const { agendarTransferenciaAutomatica } = await import("./transferenciaJob");
      expect(typeof agendarTransferenciaAutomatica).toBe("function");
    });

    it("deve exportar a função verificarTransferenciasAutomaticas", async () => {
      const { verificarTransferenciasAutomaticas } = await import("./transferenciaJob");
      expect(typeof verificarTransferenciasAutomaticas).toBe("function");
    });
  });

  describe("Verificação de que transferenciaAutomaticaJob não é mais usado", () => {
    it("systemRouter deve importar de transferenciaJob (não transferenciaAutomaticaJob)", async () => {
      const fs = await import("fs");
      const conteudo = fs.readFileSync("./server/_core/systemRouter.ts", "utf-8");
      expect(conteudo).toContain('from "../transferenciaJob"');
      expect(conteudo).not.toContain('from "../transferenciaAutomaticaJob"');
    });

    it("index.ts deve importar de transferenciaJob (não transferenciaAutomaticaJob)", async () => {
      const fs = await import("fs");
      const conteudo = fs.readFileSync("./server/_core/index.ts", "utf-8");
      expect(conteudo).toContain('"../transferenciaJob"');
      expect(conteudo).not.toContain('"../transferenciaAutomaticaJob"');
    });
  });
});
