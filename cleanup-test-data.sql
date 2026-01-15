-- ============================================================================
-- Script de Limpeza de Dados de Teste
-- Data: 15/01/2026
-- ============================================================================

-- Este script remove todos os dados de teste do sistema, mantendo apenas
-- dados reais da operação.

-- IMPORTANTE: Execute este script com cuidado. Não há como reverter após a execução.

-- ============================================================================
-- 1. BACKUP DOS IDS (para referência)
-- ============================================================================

-- IDs de leads de teste que serão removidos
SELECT 'LEADS DE TESTE A SEREM REMOVIDOS:' as info;
SELECT id, nome, telefone, email
FROM leads
WHERE 
  nome LIKE '%Teste%' 
  OR nome LIKE '%Lead Rank%'
  OR nome LIKE '%Roleta%'
  OR nome LIKE '%Webhook%'
  OR telefone LIKE '11777777777%'
  OR telefone LIKE '11888888888%'
  OR telefone LIKE '11992%'
  OR email LIKE '%webhook%';

-- IDs de projetos de teste que serão removidos
SELECT 'PROJETOS DE TESTE A SEREM REMOVIDOS:' as info;
SELECT id, nome, construtora
FROM projects
WHERE 
  nome LIKE '%Teste%'
  OR nome LIKE '%Performance%';

-- ============================================================================
-- 2. REMOÇÃO DE DADOS RELACIONADOS (CASCADE)
-- ============================================================================

-- Remover histórico de interações dos leads de teste
DELETE FROM historico_interacoes
WHERE leadId IN (
  SELECT id FROM leads
  WHERE 
    nome LIKE '%Teste%' 
    OR nome LIKE '%Lead Rank%'
    OR nome LIKE '%Roleta%'
    OR nome LIKE '%Webhook%'
    OR telefone LIKE '11777777777%'
    OR telefone LIKE '11888888888%'
    OR telefone LIKE '11992%'
    OR email LIKE '%webhook%'
);

-- Remover logs de distribuição dos leads de teste
DELETE FROM distribuicao_logs
WHERE leadId IN (
  SELECT id FROM leads
  WHERE 
    nome LIKE '%Teste%' 
    OR nome LIKE '%Lead Rank%'
    OR nome LIKE '%Roleta%'
    OR nome LIKE '%Webhook%'
    OR telefone LIKE '11777777777%'
    OR telefone LIKE '11888888888%'
    OR telefone LIKE '11992%'
    OR email LIKE '%webhook%'
);

-- Remover estoque de leads de teste
DELETE FROM estoque_leads
WHERE leadId IN (
  SELECT id FROM leads
  WHERE 
    nome LIKE '%Teste%' 
    OR nome LIKE '%Lead Rank%'
    OR nome LIKE '%Roleta%'
    OR nome LIKE '%Webhook%'
    OR telefone LIKE '11777777777%'
    OR telefone LIKE '11888888888%'
    OR telefone LIKE '11992%'
    OR email LIKE '%webhook%'
);

-- ============================================================================
-- 3. REMOÇÃO DOS LEADS DE TESTE
-- ============================================================================

DELETE FROM leads
WHERE 
  nome LIKE '%Teste%' 
  OR nome LIKE '%Lead Rank%'
  OR nome LIKE '%Roleta%'
  OR nome LIKE '%Webhook%'
  OR telefone LIKE '11777777777%'
  OR telefone LIKE '11888888888%'
  OR telefone LIKE '11992%'
  OR email LIKE '%webhook%';

-- ============================================================================
-- 4. REMOÇÃO DOS PROJETOS DE TESTE
-- ============================================================================

DELETE FROM projects
WHERE 
  nome LIKE '%Teste%'
  OR nome LIKE '%Performance%';

-- ============================================================================
-- 5. VERIFICAÇÃO PÓS-LIMPEZA
-- ============================================================================

SELECT 'VERIFICAÇÃO PÓS-LIMPEZA:' as info;

SELECT 'Total de leads restantes:' as info, COUNT(*) as total FROM leads;
SELECT 'Total de projetos restantes:' as info, COUNT(*) as total FROM projects;

-- Verificar se ainda há algum dado de teste
SELECT 'Leads de teste restantes (deve ser 0):' as info, COUNT(*) as total
FROM leads
WHERE 
  nome LIKE '%Teste%' 
  OR nome LIKE '%Lead Rank%'
  OR nome LIKE '%Roleta%'
  OR nome LIKE '%Webhook%';

SELECT 'Projetos de teste restantes (deve ser 0):' as info, COUNT(*) as total
FROM projects
WHERE 
  nome LIKE '%Teste%'
  OR nome LIKE '%Performance%';
