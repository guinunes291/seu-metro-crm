#!/usr/bin/env python3
"""
Script para extrair sub-routers do monolito server/routers.ts.
Extrai: agendamentos+visitas+agendamentosGestor, contratos+analises, equipes

Limites corretos (1-indexed, inclusive):
- agendamentos comment: 3041-3043, router: 3044-3263 (ends at line 3263 = "  }),")
- visitas comment: 3265-3267, router: 3268-3375 (ends at line 3375 = "  }),")
- contratos comment: 3377-3379, router: 3380-3537 (ends at line 3537 = "  }),")
- analises comment: 3539-3541, router: 3542-3643 (ends at line 3643 = "  }),")
- agendamentosGestor comment: 5228-5230, router: 5232-5333 (ends at line 5333 = "  }),")
- equipes comment: 5651-5652, router: 5654-5858 (ends at line 5858 = "  }),")
"""
import os

BASE = '/home/ubuntu/seu-metro-crm/server'

def fix_dynamic_imports(content: str) -> str:
    """Fix relative dynamic imports for files in server/routers/ subdirectory."""
    replacements = [
        ("'./timezone'", "'../timezone'"),
        ('"./timezone"', '"../timezone"'),
        ("'./notionService'", "'../notionService'"),
        ('"./notionService"', '"../notionService"'),
        ("'./equipes'", "'../equipes'"),
        ('"./equipes"', '"../equipes"'),
        ("'./db'", "'../db'"),
        ('"./db"', '"../db"'),
        ("'../drizzle/schema'", "'../../drizzle/schema'"),
        ('"../drizzle/schema"', '"../../drizzle/schema"'),
    ]
    for old, new in replacements:
        content = content.replace(old, new)
    return content

# Read the original routers.ts
with open(f'{BASE}/routers.ts', 'rb') as f:
    data = f.read()
lines = data.split(b'\n')
print(f"Original routers.ts: {len(lines)} lines")

def get_lines(start_1idx, end_1idx):
    """Get lines from start to end (1-indexed, inclusive) as decoded string."""
    return b'\n'.join(lines[start_1idx-1:end_1idx]).decode('utf-8')

# ============================================================================
# STEP 1: Extract blocks with correct boundaries
# ============================================================================

# agendamentos: comment at 3041-3043, router at 3044-3263
# (line 3263 is "  })," which closes agendamentos: router)
agend_comment = get_lines(3041, 3043)
agend_body = get_lines(3044, 3263)

# visitas: comment at 3265-3267, router at 3268-3375
# (line 3375 is "  })," which closes visitas: router)
visitas_comment = get_lines(3265, 3267)
visitas_body = get_lines(3268, 3375)

# contratos: comment at 3377-3379, router at 3380-3537
# (line 3537 is "  })," which closes contratos: router)
contratos_comment = get_lines(3377, 3379)
contratos_body = get_lines(3380, 3537)

# analises: comment at 3539-3541, router at 3542-3643
# (line 3643 is "  })," which closes analises: router)
analises_comment = get_lines(3539, 3541)
analises_body = get_lines(3542, 3643)

# agendamentosGestor: comment at 5228-5230, router at 5232-5333
# (line 5333 is "  })," which closes agendamentosGestor: router)
agendGestor_comment = get_lines(5228, 5230)
agendGestor_body = get_lines(5232, 5333)

# equipes: comment at 5651-5652, router at 5654-5858
# (line 5858 is "  })," which closes equipes: router)
equipes_comment = get_lines(5651, 5652)
equipes_body = get_lines(5654, 5858)

# Verify extractions
print(f"\nagendamentos body: {len(agend_body.splitlines())} lines, starts: {agend_body.splitlines()[0][:60]}, ends: {agend_body.splitlines()[-1][:60]}")
print(f"visitas body: {len(visitas_body.splitlines())} lines, starts: {visitas_body.splitlines()[0][:60]}, ends: {visitas_body.splitlines()[-1][:60]}")
print(f"contratos body: {len(contratos_body.splitlines())} lines, starts: {contratos_body.splitlines()[0][:60]}, ends: {contratos_body.splitlines()[-1][:60]}")
print(f"analises body: {len(analises_body.splitlines())} lines, starts: {analises_body.splitlines()[0][:60]}, ends: {analises_body.splitlines()[-1][:60]}")
print(f"agendamentosGestor body: {len(agendGestor_body.splitlines())} lines, starts: {agendGestor_body.splitlines()[0][:60]}, ends: {agendGestor_body.splitlines()[-1][:60]}")
print(f"equipes body: {len(equipes_body.splitlines())} lines, starts: {equipes_body.splitlines()[0][:60]}, ends: {equipes_body.splitlines()[-1][:60]}")

# ============================================================================
# STEP 2: Create agendamentosVisitas.ts
# ============================================================================

HEADER_COMMON = '''import {{ z }} from "zod";
import * as db from "../db";
import {{ TRPCError }} from "@trpc/server";
import {{ protectedProcedure, router }} from "../_core/trpc";

// ============================================================================
// HELPERS E MIDDLEWARES (copiados do routers.ts principal)
// ============================================================================
function isGestorLevel(role: string): boolean {{
  return role === 'gestor' || role === 'admin' || role === 'superintendente';
}}
function isAdminLevel(role: string): boolean {{
  return role === 'admin' || role === 'superintendente';
}}
const corretorProcedure = protectedProcedure.use(({{ ctx, next }}) => {{
  if (ctx.user.role !== 'corretor' && !isGestorLevel(ctx.user.role)) {{
    throw new TRPCError({{ code: 'FORBIDDEN', message: 'Acesso negado' }});
  }}
  return next({{ ctx }});
}});
const gestorProcedure = protectedProcedure.use(({{ ctx, next }}) => {{
  if (!isGestorLevel(ctx.user.role)) {{
    throw new TRPCError({{ code: 'FORBIDDEN', message: 'Apenas gestores podem acessar' }});
  }}
  return next({{ ctx }});
}});
'''

agendamentosVisitas_content = (
    HEADER_COMMON.format() +
    "\n// ============================================================================\n"
    "// ROUTER DE AGENDAMENTOS, VISITAS E AGENDAMENTOS GESTOR\n"
    "// ============================================================================\n"
    "export const agendamentosVisitasRouter = router({\n\n" +
    agend_comment + "\n" +
    agend_body + "\n\n" +
    visitas_comment + "\n" +
    visitas_body + "\n\n" +
    agendGestor_comment + "\n" +
    agendGestor_body + "\n});\n"
)

agendamentosVisitas_content = fix_dynamic_imports(agendamentosVisitas_content)

with open(f'{BASE}/routers/agendamentosVisitas.ts', 'w', encoding='utf-8') as f:
    f.write(agendamentosVisitas_content)
print(f"\nCreated agendamentosVisitas.ts: {len(agendamentosVisitas_content.splitlines())} lines")

# ============================================================================
# STEP 3: Create contratosAnalises.ts
# ============================================================================

contratosAnalises_content = (
    HEADER_COMMON.format() +
    "\n// ============================================================================\n"
    "// ROUTER DE CONTRATOS E ANÁLISES DE CRÉDITO\n"
    "// ============================================================================\n"
    "export const contratosAnalisesRouter = router({\n\n" +
    contratos_comment + "\n" +
    contratos_body + "\n\n" +
    analises_comment + "\n" +
    analises_body + "\n});\n"
)

contratosAnalises_content = fix_dynamic_imports(contratosAnalises_content)

with open(f'{BASE}/routers/contratosAnalises.ts', 'w', encoding='utf-8') as f:
    f.write(contratosAnalises_content)
print(f"Created contratosAnalises.ts: {len(contratosAnalises_content.splitlines())} lines")

# ============================================================================
# STEP 4: Create equipes.ts
# ============================================================================

HEADER_EQUIPES = '''import {{ z }} from "zod";
import * as db from "../db";
import {{ TRPCError }} from "@trpc/server";
import {{ protectedProcedure, router }} from "../_core/trpc";

// ============================================================================
// HELPERS E MIDDLEWARES (copiados do routers.ts principal)
// ============================================================================
function isGestorLevel(role: string): boolean {{
  return role === 'gestor' || role === 'admin' || role === 'superintendente';
}}
function isAdminLevel(role: string): boolean {{
  return role === 'admin' || role === 'superintendente';
}}
const gestorProcedure = protectedProcedure.use(({{ ctx, next }}) => {{
  if (!isGestorLevel(ctx.user.role)) {{
    throw new TRPCError({{ code: 'FORBIDDEN', message: 'Apenas gestores podem acessar' }});
  }}
  return next({{ ctx }});
}});
const adminProcedure = protectedProcedure.use(({{ ctx, next }}) => {{
  if (!isAdminLevel(ctx.user.role)) {{
    throw new TRPCError({{ code: 'FORBIDDEN', message: 'Apenas administradores podem acessar' }});
  }}
  return next({{ ctx }});
}});
'''

equipes_content = (
    HEADER_EQUIPES.format() +
    "\n// ============================================================================\n"
    "// ROUTER DE EQUIPES\n"
    "// ============================================================================\n"
    "export const equipesRouter = router({\n\n" +
    equipes_comment + "\n" +
    equipes_body + "\n});\n"
)

equipes_content = fix_dynamic_imports(equipes_content)

with open(f'{BASE}/routers/equipes.ts', 'w', encoding='utf-8') as f:
    f.write(equipes_content)
print(f"Created equipes.ts: {len(equipes_content.splitlines())} lines")

# ============================================================================
# STEP 5: Update routers.ts - remove blocks and add imports
# ============================================================================

# Re-read original
with open(f'{BASE}/routers.ts', 'rb') as f:
    data = f.read()
lines = data.split(b'\n')

# Remove blocks from bottom to top (to preserve line numbers)
# Ranges to remove (0-indexed, start inclusive, end exclusive):
# Each range includes the empty line before the comment + the comment + the router body

# equipes: empty line 5650 + comment 5651-5652 + blank 5653 + router 5654-5858
# = 0-indexed [5649, 5858)
# agendamentosGestor: comment 5228-5230 + blank 5231 + router 5232-5333
# = 0-indexed [5227, 5333)
# analises: empty 3538 + comment 3539-3541 + router 3542-3643
# = 0-indexed [3537, 3643)
# contratos: empty 3376 + comment 3377-3379 + router 3380-3537
# = 0-indexed [3375, 3537)
# visitas: empty 3264 + comment 3265-3267 + router 3268-3375
# = 0-indexed [3263, 3375)
# agendamentos: empty 3040 + comment 3041-3043 + router 3044-3263
# = 0-indexed [3039, 3263)

new_lines = list(lines)

ranges_to_remove = [
    (5649, 5858),  # equipes
    (5227, 5333),  # agendamentosGestor
    (3537, 3643),  # analises
    (3375, 3537),  # contratos
    (3263, 3375),  # visitas
    (3039, 3263),  # agendamentos
]
ranges_to_remove.sort(key=lambda x: x[0], reverse=True)

print("\nRemoving blocks:")
for start, end in ranges_to_remove:
    print(f"  Removing 0-indexed [{start}:{end}] (lines {start+1}-{end})")
    print(f"    First: {new_lines[start][:60]}")
    print(f"    Last: {new_lines[end-1][:60]}")
    del new_lines[start:end]
    print(f"    Lines remaining: {len(new_lines)}")

print(f"\nAfter removal: {len(new_lines)} lines (removed {len(lines)-len(new_lines)})")

# Reconstruct as string
content_str = b'\n'.join(new_lines).decode('utf-8')

# Add imports after leadsRouter import
old_import = 'import { leadsRouter } from "./routers/leads";'
new_import = '''import { leadsRouter } from "./routers/leads";
import { agendamentosVisitasRouter } from "./routers/agendamentosVisitas";
import { contratosAnalisesRouter } from "./routers/contratosAnalises";
import { equipesRouter } from "./routers/equipes";'''
if old_import in content_str:
    content_str = content_str.replace(old_import, new_import, 1)
    print("\nAdded imports successfully")
else:
    print("ERROR: Could not find leadsRouter import!")

# Add router mounts after leads: leadsRouter
old_mount = '  leads: leadsRouter,'
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
  equipes: equipesRouter._def.procedures.equipes,'''

if old_mount in content_str:
    content_str = content_str.replace(old_mount, new_mount, 1)
    print("Added router mounts successfully")
else:
    print("ERROR: Could not find leads: leadsRouter mount!")

# Write back
with open(f'{BASE}/routers.ts', 'w', encoding='utf-8') as f:
    f.write(content_str)

final_lines = content_str.count('\n') + 1
print(f"\nFinal routers.ts: {final_lines} lines (was {len(lines)})")
print("Done!")
