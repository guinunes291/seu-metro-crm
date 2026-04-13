#!/usr/bin/env python3
"""
Script para extrair sub-routers do monolito server/routers.ts.
Extrai: agendamentos+visitas+agendamentosGestor, contratos+analises, equipes
"""
import os
import re

BASE = '/home/ubuntu/seu-metro-crm/server'

def fix_dynamic_imports(content: str, depth: int = 1) -> str:
    """Fix relative dynamic imports for files in server/routers/ subdirectory."""
    prefix = '../' * depth
    replacements = [
        ("'./timezone'", f"'../timezone'"),
        ('"./timezone"', f'"../timezone"'),
        ("'./notionService'", f"'../notionService'"),
        ('"./notionService"', f'"../notionService"'),
        ("'./equipes'", f"'../equipes'"),
        ('"./equipes"', f'"../equipes"'),
        ("'./db'", f"'../db'"),
        ('"./db"', f'"../db"'),
        ("'../drizzle/schema'", f"'../../drizzle/schema'"),
        ('"../drizzle/schema"', f'"../../drizzle/schema"'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Read the original routers.ts
with open(f'{BASE}/routers.ts', 'rb') as f:
    data = f.read()
lines = data.split(b'\n')
print(f"Original routers.ts: {len(lines)} lines")

# ============================================================================
# STEP 1: Extract blocks
# ============================================================================

# Line ranges (1-indexed, inclusive):
# agendamentos: 3041-3263 (comment + router)
# visitas: 3265-3375 (comment + router)
# contratos: 3377-3537 (comment + router)
# analises: 3539-3647 (comment + router)
# agendamentosGestor: 5229-5343 (comment + router)
# equipes: 5651-5858 (comment + router)

def extract_block(lines, start_1idx, end_1idx):
    """Extract lines from start to end (1-indexed, inclusive)."""
    return b'\n'.join(lines[start_1idx-1:end_1idx]).decode('utf-8')

agend_block = extract_block(lines, 3041, 3263)
visitas_block = extract_block(lines, 3265, 3375)
contratos_block = extract_block(lines, 3377, 3537)
analises_block = extract_block(lines, 3539, 3647)
agendGestor_block = extract_block(lines, 5229, 5343)
equipes_block = extract_block(lines, 5651, 5858)

print(f"agendamentos block: {len(agend_block.splitlines())} lines")
print(f"visitas block: {len(visitas_block.splitlines())} lines")
print(f"contratos block: {len(contratos_block.splitlines())} lines")
print(f"analises block: {len(analises_block.splitlines())} lines")
print(f"agendamentosGestor block: {len(agendGestor_block.splitlines())} lines")
print(f"equipes block: {len(equipes_block.splitlines())} lines")

# ============================================================================
# STEP 2: Create agendamentosVisitas.ts
# ============================================================================

agendamentosVisitas_content = '''import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";

// ============================================================================
// HELPERS E MIDDLEWARES (copiados do routers.ts principal)
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
// ROUTER DE AGENDAMENTOS, VISITAS E AGENDAMENTOS GESTOR
// ============================================================================
export const agendamentosVisitasRouter = router({
''' + agend_block.rstrip() + '\n\n' + visitas_block.rstrip() + '\n\n' + agendGestor_block.rstrip() + '\n});\n'

agendamentosVisitas_content = fix_dynamic_imports(agendamentosVisitas_content)

# Fix the trailing comment that appears at the end of agendamentosGestor block
agendamentosVisitas_content = agendamentosVisitas_content.replace(
    '  }),\n  // ============================================================================\n  // CONFIGURAÇÃO DO SISTEMA\n  // ============================================================================\n  // Router de configuração removido - bloqueio manual do gestor foi removido\n  // Bloqueio automático (100% follow-ups) permanece ativo\n  // ============================================================================\n  // RELATÓRIOS E ANALYTICS\n  // ============================================================================\n});',
    '  }),\n});'
)

with open(f'{BASE}/routers/agendamentosVisitas.ts', 'w', encoding='utf-8') as f:
    f.write(agendamentosVisitas_content)
print(f"Created agendamentosVisitas.ts: {len(agendamentosVisitas_content.splitlines())} lines")

# ============================================================================
# STEP 3: Create contratosAnalises.ts
# ============================================================================

contratosAnalises_content = '''import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";

// ============================================================================
// HELPERS E MIDDLEWARES (copiados do routers.ts principal)
// ============================================================================
function isGestorLevel(role: string): boolean {
  return role === 'gestor' || role === 'admin' || role === 'superintendente';
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
// ROUTER DE CONTRATOS E ANÁLISES DE CRÉDITO
// ============================================================================
export const contratosAnalisesRouter = router({
''' + contratos_block.rstrip() + '\n\n' + analises_block.rstrip() + '\n});\n'

contratosAnalises_content = fix_dynamic_imports(contratosAnalises_content)

with open(f'{BASE}/routers/contratosAnalises.ts', 'w', encoding='utf-8') as f:
    f.write(contratosAnalises_content)
print(f"Created contratosAnalises.ts: {len(contratosAnalises_content.splitlines())} lines")

# ============================================================================
# STEP 4: Create equipes.ts
# ============================================================================

equipes_content = '''import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";

// ============================================================================
// HELPERS E MIDDLEWARES (copiados do routers.ts principal)
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
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isAdminLevel(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem acessar' });
  }
  return next({ ctx });
});

// ============================================================================
// ROUTER DE EQUIPES
// ============================================================================
export const equipesRouter = router({
''' + equipes_block.rstrip() + '\n});\n'

equipes_content = fix_dynamic_imports(equipes_content)

with open(f'{BASE}/routers/equipes.ts', 'w', encoding='utf-8') as f:
    f.write(equipes_content)
print(f"Created equipes.ts: {len(equipes_content.splitlines())} lines")

# ============================================================================
# STEP 5: Update routers.ts - remove blocks and add imports
# ============================================================================

# Read original again (fresh)
with open(f'{BASE}/routers.ts', 'rb') as f:
    data = f.read()
lines = data.split(b'\n')

# Remove blocks from bottom to top (to preserve line numbers)
# Ranges to remove (0-indexed, start inclusive, end exclusive):
# equipes: lines 5651-5858 (0-indexed 5650-5857) - comment + router
# agendamentosGestor: lines 5229-5343 (0-indexed 5228-5342) - comment + router
# analises: lines 3539-3647 (0-indexed 3538-3646) - comment + router
# contratos: lines 3377-3537 (0-indexed 3376-3536) - comment + router
# visitas: lines 3265-3375 (0-indexed 3264-3374) - comment + router
# agendamentos: lines 3041-3263 (0-indexed 3040-3262) - comment + router
# Also remove the empty line before each block (the line at 3040, 3264, 3376, 3538, 5228, 5650)

# Verify boundaries before removing
print("\nVerifying boundaries:")
checks = [
    (3039, "line before agendamentos empty"),
    (3040, "agendamentos comment start"),
    (3263, "agendamentos end"),
    (3264, "empty before visitas"),
    (3265, "visitas comment start"),
    (3375, "visitas end"),
    (3376, "empty before contratos"),
    (3377, "contratos comment start"),
    (3537, "contratos end"),
    (3538, "empty before analises"),
    (3539, "analises comment start"),
    (3647, "analises end"),
    (3648, "next after analises"),
    (5227, "empty before agendamentosGestor"),
    (5228, "agendamentosGestor comment start"),
    (5342, "agendamentosGestor end"),
    (5343, "next after agendamentosGestor"),
    (5649, "empty before equipes"),
    (5650, "equipes comment start"),
    (5857, "equipes end"),
    (5858, "next after equipes"),
]
for ln, desc in checks:
    print(f"  Line {ln+1} ({desc}): {lines[ln][:60]}")

new_lines = list(lines)

# Remove from bottom to top
ranges_to_remove = [
    (5649, 5858),  # empty + equipes block (lines 5650-5858, 0-indexed 5649-5857)
    (5227, 5343),  # empty + agendamentosGestor block (lines 5228-5343, 0-indexed 5227-5342)
    (3538, 3647),  # empty + analises block (lines 3539-3647, 0-indexed 3538-3646)
    (3376, 3537),  # empty + contratos block (lines 3377-3537, 0-indexed 3376-3536)
    (3264, 3375),  # empty + visitas block (lines 3265-3375, 0-indexed 3264-3374)
    (3039, 3263),  # empty + agendamentos block (lines 3040-3263, 0-indexed 3039-3262)
]
ranges_to_remove.sort(key=lambda x: x[0], reverse=True)

for start, end in ranges_to_remove:
    print(f"\nRemoving 0-indexed [{start}:{end}] (lines {start+1}-{end})")
    print(f"  First: {new_lines[start][:60]}")
    print(f"  Last: {new_lines[end-1][:60]}")
    del new_lines[start:end]
    print(f"  Lines remaining: {len(new_lines)}")

print(f"\nAfter removal: {len(new_lines)} lines (removed {len(lines)-len(new_lines)})")

# Now add imports at the top
# Find the line with "import { leadsRouter }"
content_str = b'\n'.join(new_lines).decode('utf-8')

# Add imports after leadsRouter import
old_import = 'import { leadsRouter } from "./routers/leads";'
new_import = '''import { leadsRouter } from "./routers/leads";
import { agendamentosVisitasRouter } from "./routers/agendamentosVisitas";
import { contratosAnalisesRouter } from "./routers/contratosAnalises";
import { equipesRouter } from "./routers/equipes";'''
content_str = content_str.replace(old_import, new_import, 1)

# Add router mounts after leads: leadsRouter
old_mount = '''  leads: leadsRouter,

  // ============================================================================
  // CORRETORES'''
new_mount = '''  leads: leadsRouter,

  // ============================================================================
  // AGENDAMENTOS, VISITAS E AGENDAMENTOS GESTOR (extraído para server/routers/agendamentosVisitas.ts)
  // ============================================================================
  agendamentos: agendamentosVisitasRouter._def.procedures.agendamentos,
  visitas: agendamentosVisitasRouter._def.procedures.visitas,
  agendamentosGestor: agendamentosVisitasRouter._def.procedures.agendamentosGestor,

  // ============================================================================
  // CONTRATOS E ANÁLISES DE CRÉDITO (extraído para server/routers/contratosAnalises.ts)
  // ============================================================================
  contratos: contratosAnalisesRouter._def.procedures.contratos,
  analises: contratosAnalisesRouter._def.procedures.analises,

  // ============================================================================
  // EQUIPES (extraído para server/routers/equipes.ts)
  // ============================================================================
  equipes: equipesRouter._def.procedures.equipes,

  // ============================================================================
  // CORRETORES'''

if old_mount in content_str:
    content_str = content_str.replace(old_mount, new_mount, 1)
    print("\nSuccessfully added router mounts")
else:
    print("\nWARNING: Could not find mount point for new routers!")
    # Try to find it
    idx = content_str.find('leads: leadsRouter')
    print(f"  leads: leadsRouter found at char {idx}")
    print(f"  Context: {content_str[idx:idx+200]}")

# Write back
with open(f'{BASE}/routers.ts', 'w', encoding='utf-8') as f:
    f.write(content_str)

final_lines = content_str.count('\n') + 1
print(f"\nFinal routers.ts: {final_lines} lines")
print("Done!")
