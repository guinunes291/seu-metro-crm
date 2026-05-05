-- Migration: Adicionar índice composto em contratos para otimizar queries por corretor/distrato/data
-- Gerado manualmente para a otimização de performance do Dashboard

CREATE INDEX `contratos_corretor_distrato_created_idx` ON `contratos` (`corretorId`, `distrato`, `createdAt`);
