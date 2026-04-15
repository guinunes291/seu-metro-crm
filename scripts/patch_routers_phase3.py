"""
Fase 3: Remove os blocos analytics, construtoras e propostas do routers.ts
e adiciona os imports dos novos sub-routers.
"""
import re

with open('server/routers.ts', 'r') as f:
    content = f.read()
    lines = content.splitlines(keepends=True)

def find_block_end(lines, start_line):
    depth = 0
    for i in range(start_line - 1, len(lines)):
        line = lines[i]
        depth += line.count('{') - line.count('}')
        if depth <= 0 and i >= start_line:
            return i + 1
    return len(lines)

blocks = {
    'propostas':    (3809, find_block_end(lines, 3809)),
    'analytics':    (4655, find_block_end(lines, 4655)),
    'construtoras': (4965, find_block_end(lines, 4965)),
}

print("Blocos a remover:")
for name, (start, end) in blocks.items():
    print(f"  {name}: L{start} -> L{end} ({end - start + 1} linhas)")

# Remover blocos de trás para frente (para não deslocar índices)
sorted_blocks = sorted(blocks.items(), key=lambda x: x[1][0], reverse=True)

new_lines = list(lines)

for name, (start, end) in sorted_blocks:
    # Remover também as linhas de comentário antes do bloco (até 4 linhas antes)
    # Procurar o início do bloco de comentário (// ===...)
    comment_start = start - 1  # 0-indexed
    while comment_start > 0 and (
        new_lines[comment_start - 1].strip().startswith('//') or
        new_lines[comment_start - 1].strip() == ''
    ):
        comment_start -= 1
    
    # Verificar se há linha em branco antes do comentário para manter
    # Remover do comment_start até end (inclusive)
    del new_lines[comment_start:end]
    print(f"  Removido {name}: L{comment_start+1} -> L{end} ({end - comment_start} linhas)")

# Adicionar imports no início do arquivo (após os imports existentes)
# Encontrar a linha do último import
import_insert_line = None
for i, line in enumerate(new_lines):
    if line.startswith('import ') or line.startswith('import{'):
        import_insert_line = i

new_imports = '''import { analyticsRouter } from "./routers/analytics";
import { construtorasRouter } from "./routers/construtoras";
import { propostasRouter } from "./routers/propostas";
'''

if import_insert_line is not None:
    new_lines.insert(import_insert_line + 1, new_imports)
    print(f"  Imports adicionados após L{import_insert_line + 1}")

# Adicionar montagem no appRouter
# Encontrar onde montar - após o bloco de equipes
new_content = ''.join(new_lines)

# Inserir após a linha "equipes: equipesSubRouter,"
mount_snippet = '''
  // ============================================================================
  // PROPOSTAS (extraído para server/routers/propostas.ts)
  // ============================================================================
  propostas: propostasRouter,

  // ============================================================================
  // ANALYTICS (extraído para server/routers/analytics.ts)
  // ============================================================================
  analytics: analyticsRouter,

  // ============================================================================
  // CONSTRUTORAS (extraído para server/routers/construtoras.ts)
  // ============================================================================
  construtoras: construtorasRouter,
'''

# Inserir após "equipes: equipesSubRouter,"
new_content = new_content.replace(
    '  equipes: equipesSubRouter,\n\n  // ============================================================================\n  // CORRETORES',
    '  equipes: equipesSubRouter,\n' + mount_snippet + '\n  // ============================================================================\n  // CORRETORES'
)

with open('server/routers.ts', 'w') as f:
    f.write(new_content)

# Contar linhas finais
final_lines = new_content.splitlines()
print(f"\nrouters.ts: {len(lines)} -> {len(final_lines)} linhas (redução de {len(lines) - len(final_lines)} linhas)")
