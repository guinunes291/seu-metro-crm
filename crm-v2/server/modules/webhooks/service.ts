import type { DrizzleDB } from "../../_core/db.js";
import { getWebhookByToken, incrementLeadsRecebidos } from "./repository.js";
import { createLead } from "../leads/repository.js";
import { addToEstoque } from "../distribuicao/repository.js";

interface FbFieldData {
  name: string;
  values: string[];
}

interface FbLeadgenValue {
  leadgen_id?: string;
  form_id?: string;
  field_data?: FbFieldData[];
}

interface FbChange {
  field: string;
  value: FbLeadgenValue;
}

interface FbEntry {
  changes: FbChange[];
}

interface FbPayload {
  entry?: FbEntry[];
  field_data?: FbFieldData[];
  leads?: Array<{ name?: string; phone?: string; email?: string }>;
}

function extractFbFields(fieldData: FbFieldData[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const f of fieldData) {
    result[f.name.toLowerCase()] = f.values[0] ?? "";
  }
  return result;
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-11);
}

export async function processarWebhook(
  db: DrizzleDB,
  token: string,
  body: unknown
): Promise<{ leadId: number } | null> {
  const config = await getWebhookByToken(db, token);
  if (!config || !config.ativo) return null;

  const payload = body as FbPayload;

  let nome = "";
  let telefone = "";
  let email = "";
  let formId: string | undefined;

  // Facebook Lead Ads format
  if (payload.entry && payload.entry.length > 0) {
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field === "leadgen" && change.value) {
          const val = change.value;
          formId = val.form_id;
          if (val.field_data) {
            const fields = extractFbFields(val.field_data);
            nome = fields["full_name"] ?? fields["name"] ?? fields["nome"] ?? "";
            telefone = normalizePhone(fields["phone_number"] ?? fields["telefone"] ?? fields["phone"] ?? "");
            email = fields["email"] ?? "";
          }
        }
      }
    }
  }
  // Direct field_data format
  else if (payload.field_data) {
    const fields = extractFbFields(payload.field_data);
    nome = fields["full_name"] ?? fields["name"] ?? fields["nome"] ?? "";
    telefone = normalizePhone(fields["phone_number"] ?? fields["telefone"] ?? fields["phone"] ?? "");
    email = fields["email"] ?? "";
  }
  // Generic format
  else if (payload.leads && payload.leads.length > 0) {
    const lead = payload.leads[0]!;
    nome = lead.name ?? "";
    telefone = normalizePhone(lead.phone ?? "");
    email = lead.email ?? "";
  }

  if (!telefone && !nome) return null;

  // Determine projeto
  let projetoId: number | undefined;
  if (formId && config.formIdMapping[formId]) {
    projetoId = config.formIdMapping[formId];
  } else if (config.projectIdPadrao) {
    projetoId = config.projectIdPadrao;
  }

  const lead = await createLead(db, {
    nome: nome || "Sem nome",
    telefone: telefone || "00000000000",
    email: email || undefined,
    origem: config.fonte === "facebook" ? "facebook" : "outro",
    projetoId,
    origemWebhook: true,
    tipoFilaOrigem: config.tipoFila,
  });

  if (!lead) return null;

  await addToEstoque(db, lead.id, config.tipoFila, `Webhook: ${config.nome}`);
  await incrementLeadsRecebidos(db, config.id);

  return { leadId: lead.id };
}
