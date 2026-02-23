import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Verificar se o perfil do usuário está completo (versão síncrona para testes)
 * Retorna objeto com status e campos faltantes
 */
export function verificarPerfilCompletoSync(user: any) {
  // Admin nunca é bloqueado
  if (user.role === "admin") {
    return {
      completo: true,
      camposFaltantes: [],
    };
  }

  const camposFaltantes: string[] = [];

  // Verificar foto de perfil
  if (!user.fotoUrl) {
    camposFaltantes.push("Foto de perfil");
  }

  // Verificar dados pessoais obrigatórios
  if (!user.name || user.name.trim() === "") {
    camposFaltantes.push("Nome completo");
  }
  if (!user.cpf) {
    camposFaltantes.push("CPF");
  }
  if (!user.dataNascimento) {
    camposFaltantes.push("Data de nascimento");
  }
  if (!user.email) {
    camposFaltantes.push("Email");
  }
  if (!user.telefone) {
    camposFaltantes.push("Telefone");
  }

  // Verificar dados profissionais obrigatórios
  if (!user.dataCredenciamento) {
    camposFaltantes.push("Data de credenciamento");
  }
  // Status de plantão já tem default, mas vamos verificar
  if (!user.status) {
    camposFaltantes.push("Status de plantão");
  }

  // Verificar endereço obrigatório
  if (!user.cep) {
    camposFaltantes.push("CEP");
  }
  if (!user.logradouro) {
    camposFaltantes.push("Logradouro");
  }
  if (!user.numero) {
    camposFaltantes.push("Número");
  }
  if (!user.bairro) {
    camposFaltantes.push("Bairro");
  }
  if (!user.cidade) {
    camposFaltantes.push("Cidade");
  }
  if (!user.estado) {
    camposFaltantes.push("Estado");
  }

  const completo = camposFaltantes.length === 0;

  return {
    completo,
    camposFaltantes,
  };
}

/**
 * Verificar se o perfil do usuário está completo
 * Retorna objeto com status e campos faltantes
 */
export async function verificarPerfilCompleto(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  
  if (!user) {
    throw new Error("Usuário não encontrado");
  }

  // Usar função síncrona para verificar
  const resultado = verificarPerfilCompletoSync(user);
  const { completo, camposFaltantes } = resultado;

  // Se estava incompleto e agora está completo, marcar como completo
  if (completo && !user.perfilCompleto) {
    await db.update(users)
      .set({ perfilCompleto: true })
      .where(eq(users.id, userId));
  }

  return {
    completo,
    camposFaltantes,
    user,
  };
}

/**
 * Atualizar dados do perfil do usuário
 */
export async function atualizarPerfil(userId: number, dados: {
  // Dados pessoais
  name?: string;
  cpf?: string;
  dataNascimento?: Date;
  email?: string;
  telefone?: string;
  fotoUrl?: string;
  
  // Dados profissionais
  creci?: string;
  situacao?: "ativo" | "inativo";
  dataCredenciamento?: Date;
  dataDescredenciamento?: Date;
  status?: "presente" | "ausente";
  
  // Endereço
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Atualizar dados
  await db.update(users)
    .set({
      ...dados,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // Verificar se o perfil ficou completo após a atualização
  const resultado = await verificarPerfilCompleto(userId);

  return {
    success: true,
    perfilCompleto: resultado.completo,
    camposFaltantes: resultado.camposFaltantes,
  };
}

/**
 * Buscar CEP via API externa (ViaCEP)
 */
export async function buscarCEP(cep: string) {
  try {
    const cepLimpo = cep.replace(/\D/g, "");
    
    if (cepLimpo.length !== 8) {
      throw new Error("CEP inválido");
    }

    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    
    if (!response.ok) {
      throw new Error("Erro ao buscar CEP");
    }

    const data = await response.json();

    if (data.erro) {
      throw new Error("CEP não encontrado");
    }

    return {
      cep: data.cep,
      logradouro: data.logradouro,
      complemento: data.complemento,
      bairro: data.bairro,
      cidade: data.localidade,
      estado: data.uf,
    };
  } catch (error) {
    console.error("[buscarCEP] Erro:", error);
    throw error;
  }
}
