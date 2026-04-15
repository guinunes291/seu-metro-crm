"""
Fase 3: Extração de analytics, construtoras e propostas do routers.ts
"""
import re

with open('server/routers.ts', 'r') as f:
    lines = f.readlines()

def find_block_end(lines, start_line):
    depth = 0
    for i in range(start_line - 1, len(lines)):
        line = lines[i]
        depth += line.count('{') - line.count('}')
        if depth <= 0 and i >= start_line:
            return i + 1
    return len(lines)

blocks = {
    'propostas':   (3809, find_block_end(lines, 3809)),
    'analytics':   (4655, find_block_end(lines, 4655)),
    'construtoras':(4965, find_block_end(lines, 4965)),
}

# Headers para cada sub-router
headers = {
    'analytics': '''import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";

// ============================================================================
// HELPERS E MIDDLEWARES
// ============================================================================
function isGestorLevel(role: string): boolean {
  return role === 'gestor' || role === 'admin' || role === 'superintendente';
}
function isAdminLevel(role: string): boolean {
  return role === 'admin' || role === 'superintendente';
}
const gestorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isGestorLevel(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas gestores podem acessar' });
  }
  return next({ ctx });
});

// ============================================================================
// ROUTER DE ANALYTICS
// ============================================================================
export const analyticsRouter = router({
''',
    'construtoras': '''import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";

// ============================================================================
// HELPERS E MIDDLEWARES
// ============================================================================
function isAdminLevel(role: string): boolean {
  return role === 'admin' || role === 'superintendente';
}
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isAdminLevel(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem acessar' });
  }
  return next({ ctx });
});

// ============================================================================
// ROUTER DE CONSTRUTORAS
// ============================================================================
export const construtorasRouter = router({
''',
    'propostas': '''import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";

// ============================================================================
// HELPERS E MIDDLEWARES
// ============================================================================
function isGestorLevel(role: string): boolean {
  return role === 'gestor' || role === 'admin' || role === 'superintendente';
}
function isAdminLevel(role: string): boolean {
  return role === 'admin' || role === 'superintendente';
}
const corretorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'corretor' && !isGestorLevel(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
  }
  return next({ ctx });
});
const gestorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isGestorLevel(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas gestores podem acessar' });
  }
  return next({ ctx });
});

// ============================================================================
// ROUTER DE PROPOSTAS
// ============================================================================
export const propostasRouter = router({
''',
}

# Nomes dos exports individuais (para montagem no appRouter)
export_names = {
    'analytics': 'analyticsRouter',
    'construtoras': 'construtorasRouter',
    'propostas': 'propostasRouter',
}

for name, (start, end) in blocks.items():
    # Extrair o conteúdo interno do bloco (sem a linha "  analytics: router({" e sem o fechamento "  }),")
    block_lines = lines[start-1:end]
    
    # Remover a primeira linha (  analytics: router({) e a última (  }),)
    inner_lines = block_lines[1:-1]
    
    # Corrigir imports dinâmicos relativos (./xxx -> ../xxx)
    corrected = []
    for line in inner_lines:
        # Corrigir imports dinâmicos: './xxx' -> '../xxx' (exceto '../' que já está correto)
        line = re.sub(r"import\('\.\/", "import('../", line)
        corrected.append(line)
    
    # Montar o arquivo
    header = headers[name]
    inner_content = ''.join(corrected)
    
    # O header já termina com "export const xxxRouter = router({\n"
    # O inner_content já tem as procedures com indentação correta
    # Precisamos fechar o router com "});"
    content = header + inner_content + "});\n"
    
    # Escrever o arquivo
    out_path = f'server/routers/{name}.ts'
    with open(out_path, 'w') as f:
        f.write(content)
    
    print(f'Criado: {out_path} ({len(content.splitlines())} linhas)')

print('\nArquivos criados com sucesso!')
