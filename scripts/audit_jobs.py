#!/usr/bin/env python3
"""Audita intervalos de todos os jobs no servidor."""
import os
import re

BASE = '/home/ubuntu/seu-metro-crm/server'

JOB_FILES = [
    'agendamentosSyncJob.ts',
    'backupJob.ts',
    'biSyncJob.ts',
    'carteiraAtivaJob.ts',
    'conquistasJob.ts',
    'distribuicaoJob.ts',
    'dreSyncJob.ts',
    'followup.ts',
    'followupCleanupJob.ts',
    'followupJob.ts',
    'linksCleanupJob.ts',
    'metricasSyncJob.ts',
    'notionJob.ts',
    'pontuacaoJob.ts',
    'resetContadoresJob.ts',
    'sheetsBackupJob.ts',
    'sheetsImportJob.ts',
    'sheetsSyncReal.ts',
    'sheetsSync.ts',
    'timerLeadsJob.ts',
    'transferenciaJob.ts',
    '_core/index.ts',
]

print("=" * 80)
print("AUDITORIA DE JOBS E INTERVALOS")
print("=" * 80)

for fname in JOB_FILES:
    fpath = os.path.join(BASE, fname)
    if not os.path.exists(fpath):
        continue
    
    with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
        lines = content.split('\n')
    
    # Find interval definitions and setInterval calls
    relevant = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        # Skip comments and test files
        if stripped.startswith('//') or stripped.startswith('*'):
            continue
        if re.search(r'setInterval|INTERVAL_MS|_INTERVAL\s*=|intervalMs|interval_ms|SYNC_INTERVAL|BACKUP_INTERVAL|CHECK_INTERVAL', line, re.IGNORECASE):
            if 'clearInterval' not in line and 'ReturnType' not in line:
                relevant.append((i+1, line.rstrip()))
    
    if relevant:
        print(f"\n--- {fname} ---")
        for lineno, line in relevant:
            print(f"  L{lineno}: {line[:120]}")

print("\n" + "=" * 80)
print("POLLING DO FRONTEND (useQuery com refetchInterval)")
print("=" * 80)

CLIENT_DIR = '/home/ubuntu/seu-metro-crm/client/src'
for root, dirs, files in os.walk(CLIENT_DIR):
    for fname in files:
        if not fname.endswith('.tsx') and not fname.endswith('.ts'):
            continue
        fpath = os.path.join(root, fname)
        with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
            lines = content.split('\n')
        
        relevant = []
        for i, line in enumerate(lines):
            if re.search(r'refetchInterval|polling|setInterval|setTimeout', line, re.IGNORECASE):
                if not line.strip().startswith('//'):
                    relevant.append((i+1, line.rstrip()))
        
        if relevant:
            rel_path = os.path.relpath(fpath, '/home/ubuntu/seu-metro-crm')
            print(f"\n--- {rel_path} ---")
            for lineno, line in relevant:
                print(f"  L{lineno}: {line[:120]}")
