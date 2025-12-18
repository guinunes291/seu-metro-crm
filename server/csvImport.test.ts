import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "./db";
import { leads } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { 
  detectDelimiter, 
  detectEncoding, 
  detectColumnMapping, 
  parseCSV, 
  validatePhone, 
  validateEmail,
  normalizePhone,
  importLeadsFromCSV
} from "./csvImport";

describe("CSV Import", () => {
  describe("detectDelimiter", () => {
    it("deve detectar vírgula como delimitador", () => {
      const csv = "Nome,Telefone,Email\nJoão,11987654321,joao@email.com";
      expect(detectDelimiter(csv)).toBe(",");
    });

    it("deve detectar ponto-e-vírgula como delimitador", () => {
      const csv = "Nome;Telefone;Email\nJoão;11987654321;joao@email.com";
      expect(detectDelimiter(csv)).toBe(";");
    });

    it("deve detectar tab como delimitador", () => {
      const csv = "Nome\tTelefone\tEmail\nJoão\t11987654321\tjoao@email.com";
      expect(detectDelimiter(csv)).toBe("\t");
    });
  });

  describe("detectEncoding", () => {
    it("deve detectar UTF-8", () => {
      const buffer = Buffer.from("João Silva", "utf-8");
      expect(detectEncoding(buffer)).toBe("utf-8");
    });
  });

  describe("detectColumnMapping", () => {
    it("deve mapear colunas automaticamente", () => {
      const headers = ["Nome", "Telefone", "Email", "Origem", "Observações"];
      const mapping = detectColumnMapping(headers);
      
      expect(mapping.nome).toBe(0);
      expect(mapping.telefone).toBe(1);
      expect(mapping.email).toBe(2);
      expect(mapping.origem).toBe(3);
      expect(mapping.observacoes).toBe(4);
    });

    it("deve mapear colunas com nomes diferentes", () => {
      const headers = ["Cliente", "Celular", "E-mail"];
      const mapping = detectColumnMapping(headers);
      
      expect(mapping.nome).toBe(0);
      expect(mapping.telefone).toBe(1);
      expect(mapping.email).toBe(2);
    });
  });

  describe("parseCSV", () => {
    it("deve fazer parse de CSV com vírgula", () => {
      const csv = "Nome,Telefone\nJoão,11987654321\nMaria,11976543210";
      const result = parseCSV(csv, ",");
      
      expect(result[0]).toEqual(["Nome", "Telefone"]);
      expect(result).toHaveLength(3);
      expect(result[1]).toEqual(["João", "11987654321"]);
    });

    it("deve fazer parse de CSV com ponto-e-vírgula", () => {
      const csv = "Nome;Telefone\nJoão;11987654321";
      const result = parseCSV(csv, ";");
      
      expect(result[0]).toEqual(["Nome", "Telefone"]);
      expect(result).toHaveLength(2);
    });
  });

  describe("normalizePhone", () => {
    it("deve normalizar telefone brasileiro", () => {
      expect(normalizePhone("11987654321")).toBe("(11) 98765-4321");
      expect(normalizePhone("1198765432")).toBe("(11) 9876-5432");
    });

    it("deve remover caracteres especiais", () => {
      expect(normalizePhone("(11) 98765-4321")).toBe("(11) 98765-4321");
    });
  });

  describe("validatePhone", () => {
    it("deve validar telefone correto", () => {
      expect(validatePhone("11987654321")).toBe(true);
      expect(validatePhone("1198765432")).toBe(true);
    });

    it("deve rejeitar telefone inválido", () => {
      expect(validatePhone("123")).toBe(false);
      expect(validatePhone("")).toBe(false);
    });
  });

  describe("validateEmail", () => {
    it("deve validar email correto", () => {
      expect(validateEmail("joao@email.com")).toBe(true);
    });

    it("deve rejeitar email inválido", () => {
      expect(validateEmail("email-invalido")).toBe(false);
      expect(validateEmail("")).toBe(false);
    });
  });

  describe("Importação completa", () => {
    beforeEach(async () => {
      const db = await getDb();
      if (!db) return;
      
      // Limpar leads de teste
      await db.delete(leads).where(eq(leads.nome, "João CSV Test"));
      await db.delete(leads).where(eq(leads.nome, "Maria CSV Test"));
    });

    it("deve importar leads do CSV", async () => {
      const csv = `Nome,Telefone,Email,Origem
João CSV Test,11987654321,joao@test.com,Facebook
Maria CSV Test,11976543210,maria@test.com,Instagram`;

      const result = await importLeadsFromCSV(csv, 1);

      expect(result.success).toBe(true);
      expect(result.imported).toBe(2);
      expect(result.errors).toBe(0);

      // Verificar se foram inseridos
      const db = await getDb();
      if (!db) return;
      
      const insertedLeads = await db.select().from(leads).where(eq(leads.nome, "João CSV Test"));
      expect(insertedLeads).toHaveLength(1);
      expect(insertedLeads[0].telefone).toBe("(11) 98765-4321");
    });

    it("deve ignorar linhas com dados inválidos", async () => {
      const csv = `Nome,Telefone,Email
João Test,11987654321,joao@test.com
,11976543210,maria@test.com
Pedro Test,123,pedro@test.com`;

      const result = await importLeadsFromCSV(csv, 1);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(2);
    });
  });
});
