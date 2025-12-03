# Seu Metro Quadrado - CRM Imobiliário - TODO

## Fase 1: Estrutura e Autenticação
- [x] Configurar schema do banco de dados com todas as tabelas
- [x] Implementar autenticação com Manus OAuth
- [x] Criar sistema de roles (Gestor, Corretor)

## Fase 2: Módulo de Projetos (Imóveis)
- [x] Criar tabela de projetos (empreendimentos)
- [x] Criar tabela de unidades (imóveis dentro dos projetos)
- [x] Implementar CRUD de projetos
- [ ] Implementar importação em massa de projetos
- [x] Criar interface de visualização em formato "estante"
- [ ] Implementar filtros e busca de imóveis

## Fase 3: Módulo de CRM (Leads)
- [x] Criar tabela de leads
- [x] Criar tabela de histórico de interações
- [x] Implementar CRUD de leads
- [x] Implementar visualização de leads por corretor
- [x] Implementar visualização de todos os leads (gestor)
- [x] Implementar status do lead (Novo, Em Atendimento, Agendado, Visita Realizada, Análise de Crédito, Contrato Fechado, Perdido)

## Fase 4: Módulo de Distribuição Automática
- [ ] Implementar regra de distribuição por status "Presente"
- [ ] Implementar regra de distribuição por 60% de leads trabalhados
- [ ] Implementar otimização por taxa de conversão por projeto/região
- [x] Criar tabela de log de distribuição
- [x] Implementar distribuição manual (gestor)
- [ ] Implementar distribuição inicial de leads

## Fase 5: Módulo de Follow-up
- [x] Implementar registro de contatos (data, hora, meio, resultado, observações)
- [ ] Implementar lembretes automáticos de follow-up
- [ ] Implementar regra de 5 dias consecutivos de follow-up
- [ ] Implementar notificações para corretores

## Fase 6: Módulo de Relatórios e Analytics
- [x] Implementar dashboard do gestor
- [x] Implementar dashboard do corretor
- [x] Implementar relatórios de conversão por corretor
- [ ] Implementar relatórios de conversão por projeto
- [x] Implementar funil de vendas
- [x] Implementar métricas de performance (tempo de resposta, taxa de conversão, etc.)
- [ ] Integrar com Looker Studio (opcional)

## Fase 7: Integração com Google Sheets
- [ ] Implementar importação de leads da planilha
- [ ] Implementar sincronização de dados (opcional)
- [ ] Preservar dados durante automações

## Fase 8: Funcionalidades Adicionais
- [x] Implementar sistema de plantão (Presente/Ausente)
- [x] Implementar mensagens prontas personalizadas
- [ ] Preparar para futura integração com WhatsApp
- [ ] Preparar para futura integração com e-mail
- [ ] Implementar copilot para corretores (assistente AI)

## Fase 9: Testes e Otimizações
- [ ] Criar testes unitários para procedures críticas
- [ ] Testar fluxo completo de distribuição
- [ ] Testar fluxo completo de follow-up
- [ ] Otimizar queries do banco de dados
- [ ] Testar com dados reais da planilha

## Fase 10: Documentação e Entrega
- [ ] Documentar API (procedures)
- [ ] Documentar fluxos de uso
- [ ] Criar guia de usuário para corretores
- [ ] Criar guia de usuário para gestores
- [ ] Preparar checkpoint final

## Nova Feature: Distribuição Automática Inteligente
- [x] Implementar função de verificação de elegibilidade de corretores (status "Presente")
- [x] Implementar cálculo de taxa de trabalho (60% dos leads trabalhados)
- [x] Implementar otimização por taxa de conversão por projeto/região
- [x] Criar procedure de distribuição automática no backend
- [x] Criar interface para trigger manual da distribuição automática
- [ ] Criar job/cron para distribuição automática periódica
- [ ] Testar algoritmo com dados reais

## Nova Feature: Importação Automática do Google Sheets
- [x] Configurar integração com Google Sheets API
- [x] Criar função de leitura de dados da planilha
- [x] Implementar mapeamento de colunas (ID, Nome, E-mail, Telefone, Origem, Status, Data Distribuição, Distribuído)
- [x] Implementar detecção de duplicatas por ID ou telefone
- [x] Criar procedure de importação no backend
- [x] Criar interface de importação na página de Distribuição
- [x] Implementar sincronização incremental (apenas novos leads)
- [x] Testar importação com a planilha real
- [x] Garantir preservação de dados durante importação

## Nova Feature: Interface Completa para Corretores
- [x] Criar visualização de leads em cards com informações resumidas
- [x] Criar visualização de leads em tabela com ordenação
- [x] Implementar filtros por status, projeto e data
- [x] Implementar busca por nome, telefone e email
- [x] Criar modal de detalhes do lead com todas as informações
- [x] Implementar visualização do histórico de interações
- [x] Criar formulário de registro de novo contato (ligação, WhatsApp, email, etc.)
- [x] Implementar atualização de status do lead
- [x] Adicionar campo de observações e notas
- [x] Implementar indicadores visuais de follow-up pendente
- [x] Mostrar contador de dias consecutivos de follow-up
- [x] Garantir que cada corretor veja apenas seus próprios leads
- [x] Adicionar badges de status coloridos
- [x] Implementar ações rápidas (ligar, WhatsApp, email)

## Bug Fix: Erro de Autenticação da API do Google Sheets
- [x] Solicitar GOOGLE_SHEETS_API_KEY via webdev_request_secrets
- [x] Atualizar código do googleSheets.ts para usar a API Key
- [x] Testar importação com API Key configurada
- [x] Documentar processo de obtenção da API Key no Google Cloud Console

## Bug Fix: Importação Incompleta de Leads
- [x] Investigar por que 9510 leads foram marcados como duplicatas
- [x] Investigar os 88 erros de importação (Failed query)
- [x] Corrigir lógica de detecção de duplicatas
- [x] Melhorar tratamento de erros na importação
- [x] Implementar importação em lotes (batch) para evitar timeout
- [x] Adicionar logs detalhados de importação

## Performance: Otimizar para Grande Volume de Leads
- [ ] Implementar paginação na listagem de leads
- [x] Adicionar índices no banco de dados para queries rápidas
- [ ] Implementar lazy loading na interface
- [x] Otimizar queries SQL para evitar N+1
- [ ] Adicionar cache para estatísticas do dashboard
- [ ] Implementar virtualização de listas longas

## Feature: Replicar Interface de Projetos
- [ ] Buscar código da página de projetos do outro projeto
- [ ] Replicar layout em formato "estante" com cards visuais
- [ ] Implementar filtros e busca de projetos
- [ ] Adicionar imagens e informações detalhadas dos projetos
- [ ] Apagar projetos de teste atuais

## Nova Tarefa: Copiar Página de Projetos do Projeto Anterior
- [x] Acessar projeto compartilhado em https://manus.im/share/JrHQID44wz77L9GalxDeZe?replay=1
- [x] Analisar a estrutura e design da página de projetos
- [x] Copiar código da página de projetos
- [ ] Adaptar para o schema do CRM atual
- [ ] Testar a nova interface
- [ ] Validar responsividade e funcio## Implementau00e7u00e3o Completa - Funcionalidades do Projeto Anterior
- [x] Adicionar campos especu00edficos ao schema de projetos (zona, enquadramento, dormitorios, vagas, developer)
- [x] Migrar banco de dados com novos campos- [ ] Atualizar procedures do backend para suportar novos campos
- [ ] Implementar filtros avançados na página de Projetos (zona, enquadramento, dormitórios, vagas)
- [ ] Melhorar interface de cards com hover effects e badges
- [ ] Criar CompareContext para gerenciar comparação de projetos
- [ ] Criar componente CompareBar (barra flutuante)
- [ ] Adicionar botões de adicionar/remover projetos nos cards
- [ ] Criar página de comparação lado a lado
- [ ] Criar página de detalhes completa do projeto
- [ ] Testar todas as funcionalidades
- [ ] Validar responsividade

- [ ] Implementar Google Maps na página de detalhes do projeto
- [ ] Adicionar marcador no endereço do projeto
- [ ] Adicionar botão "Ver no Google Maps" para abrir em nova aba

## Nova Feature: Gestão Completa de Projetos
- [x] Adicionar procedure de edição de projetos no backend
- [x] Adicionar procedure de exclusão de projetos no backend
- [x] Implementar botão de editar na página de detalhes (apenas gestor)
- [x] Implementar botão de excluir na página de detalhes (apenas gestor)
- [x] Criar modal de edição de projeto
- [x] Criar confirmação de exclusão de projeto
- [x] Apagar todos os projetos existentes do banco de dados
- [ ] Criar funcionalidade de inclusão em massa (upload CSV/Excel ou formulário)
- [ ] Testar edição, exclusão e inclusão em massa

## Nova Feature: Importação de Projetos do Google Sheets
- [x] Analisar estrutura da planilha de projetos
- [x] Criar função de leitura da planilha de projetos
- [x] Implementar mapeamento de colunas para campos do sistema
- [x] Implementar detecção de duplicatas por nome do projeto
- [x] Criar procedure de importação de projetos no backend
- [x] Criar interface de importação na página de Projetos
- [x] Implementar sincronização incremental (apenas novos projetos)
- [ ] Testar importação com a planilha real

## Bug: Erro de Dynamic Import no googleapis
- [x] Corrigir erro "Dynamic require of googleapis is not supported"
- [x] Alterar importação dinu00e2mica para importação estu00e1tica
- [ ] Testar importação de projetos apu00f3s correção
## Nova Feature: Gestão de Corretores
- [x] Criar tabela de corretores no schema (já existia)
- [x] Implementar CRUD de corretores no backend
- [x] Criar página de listagem de corretores (/corretores)
- [x] Implementar formulário de cadastro de corretor
- [x] Implementar formulário de edição de corretor
- [x] Adicionar campos: nome, email (obrigatório), telefone, status de plantão
- [x] Implementar controle de status (Presente/Ausente)
- [x] Adicionar permissões (apenas gestor pode gerenciar)
- [x] Criar interface responsiva e moderna
- [x] Criar testes unitários para CRUD de corretores

## Nova Feature: Dashboard Individual de Performance
- [ ] Criar página de performance individual (/minha-performance)
- [ ] Implementar métricas pessoais (taxa de conversão, tempo médio de resposta)
- [ ] Mostrar leads convertidos por projeto
- [ ] Criar ranking comparativo com a equipe
- [ ] Implementar gamificação (badges, conquistas)
- [ ] Criar gráficos e visualizações de dados
- [ ] Adicionar filtros por período (semana, mês, trimestre)
- [ ] Implementar metas e objetivos pessoais

## Nova Feature: Integração WhatsApp Business API
- [ ] Pesquisar e configurar WhatsApp Business API
- [ ] Implementar autenticação e webhook
- [ ] Criar função de envio de mensagens
- [ ] Implementar templates pré-aprovados
- [ ] Registrar conversas automaticamente no histórico
- [ ] Criar interface de envio de mensagem na página do lead
- [ ] Implementar recebimento e processamento de mensagens
- [ ] Adicionar botão de WhatsApp nos cards de leads
- [ ] Testar fluxo completo de comunicação

## Bug Crítico: Menu Lateral Desaparecendo
- [x] Investigar problema de navegação que faz o menu lateral desaparecer
- [x] Corrigir roteamento para manter o DashboardLayout em todas as páginas (Projetos, ProjetoDetalhes, Corretores)
- [x] Testar navegação entre todas as páginas

## ## Bug Crítico: Perda de Dados de Projetos e Clientes
- [x] Investigar por que os projetos e clientes sumiram do banco de dados
- [x] Verificar se houve alguma operação de limpeza acidental (rollback de checkpoint)
- [x] Restaurar dados do backup ou reimportar da planilha (139 projetos importados com sucesso)
- [ ] Implementar mecanismo de proteção contra perda de dadosados futura

## Bug Crítico: Perda de Dados Persistente
- [ ] Investigar por que os dados (projetos e clientes) somem ao sair e voltar
- [ ] Verificar configuração do banco de dados e persistência
- [ ] Verificar se o problema está relacionado a checkpoints ou ambiente
- [ ] Implementar solução para garantir persistência permanente dos dados
- [ ] Testar que os dados permanecem após sair e voltar ao sistema

## Bug: Importação de Leads Criando Projetos Indevidamente
- [x] Investigar por que a importação de leads está criando novos projetos
- [x] Corrigir lógica para que projetos só sejam criados manualmente ou por importação em massa (alterado getOrCreateProject para findExistingProject)
- [x] Testar importação de leads para garantir que não cria projetos (testes unitários passando)

## Bug: Menu Lateral Sumindo ao Alternar Abas
- [x] Identificar quais páginas ainda não têm DashboardLayout (todas as 10 páginas principais já têm)
- [x] Adicionar DashboardLayout nas páginas faltantes (já estava implementado)
- [x] Testar navegação entre todas as abas (servidor reiniciado)

## Nova Feature: Logos de Construtoras nos Projetos
- [x] Adicionar campo logoUrl ao schema de projetos
- [x] Migrar banco de dados (pnpm db:push)
- [x] Fazer upload das logos das construtoras (Cury, Plano&Plano, Metrocasa, Vivaz) para S3
- [x] Criar mapeamento construtora → logo URL (arquivo construtoraLogos.ts)
- [x] Atualizar função de importação de projetos para associar logo automaticamente
- [x] Atualizar interface do catálogo de projetos para exibir logos
- [x] Testar importação e exibição das logos (logos aparecendo corretamente nos cards)

## Nova Feature: Dashboard Individual de Performance
- [x] Criar função para calcular taxa de conversão do corretor
- [x] Criar função para calcular tempo médio de resposta
- [x] Criar função para listar leads convertidos por projeto
- [x] Criar função para calcular ranking comparativo com a equipe
- [x] Criar procedures tRPC para expor métricas (performance.minhas e performance.ranking)
- [x] Criar página /minha-performance
- [x] Implementar visualizações de métricas (cards, gráficos)
- [x] Adicionar ranking visual com posição do corretor
- [x] Implementar sistema de gamificação (badges, medalhas, posição)
- [x] Adicionar item de menu no DashboardLayout
- [x] Criar testes unitários para cálculos de performance (6 testes passando)
## Nova Feature: Filtro por Período no Dashboard de Performance
- [x] Adicionar parâmetro de período nos procedures tRPC (dataInicio, dataFim)
- [x] Atualizar funções de cálculo para filtrar por período
- [x] Criar componente de seleção de período na interface (Semana, Mês, Ano, Todos)
- [x] Atualizar queries do frontend para passar período selecionado
- [x] Testar filtros de período (4 testes passando)

## Nova Feature: Sistema de Convite Automático para Corretores
- [x] Criar função para gerar email de convite com instruções
- [x] Integrar com sistema de notificações (notifica gestor para compartilhar projeto)
- [x] Adicionar opção de enviar convite ao cadastrar corretor (enviarConvite: boolean)
- [x] Criar template de mensagem de boas-vindas
- [x] Testar envio de convites (4 testes passando)

## Bug Crítico: Perda de Leads Recorrente
- [x] Investigar por que os leads estão sumindo entre sessões (problema de versionamento de checkpoints)
- [x] Verificar se o problema é no banco de dados ou nos checkpoints (checkpoints salvam estado do banco)
- [ ] Criar tabela de controle de importação no schema
- [ ] Implementar script de verificação de dados ao iniciar sistema
- [ ] Criar função de reimportação automática da planilha
- [ ] Integrar verificação no startup do servidor
- [ ] Testar que os dados persistem após sair e voltar

## Nova Feature: Sistema de Autenticação Próprio para Corretores
- [ ] Criar tabela de senhas/credenciais para corretores
- [ ] Implementar endpoints de login/logout para corretores
- [ ] Criar sistema de geração automática de senha temporária
- [ ] Implementar envio de email com credenciais ao cadastrar corretor
- [ ] Criar página de login para corretores
- [ ] Manter OAuth do Manus apenas para gestores/admins
- [ ] Testar fluxo completo de cadastro e acesso de corretor

## Nova Feature: Documento PDF de Boas-Vindas para Corretores
- [x] Criar conteúdo do documento em Markdown com instruções completas
- [x] Incluir seções: boas-vindas, como acessar, funcionalidades, dicas de uso
- [x] Converter documento para PDF
- [x] Entregar PDF ao gestor para envio manual via WhatsApp

## Tarefa: Reimportação Final de Leads
- [x] Reimportar todos os leads da planilha do Google Sheets (usuário importou)
- [x] Verificar quantidade total de leads importados (5442 leads + 153 projetos ativos)
- [ ] Salvar checkpoint final com todos os dados
- [ ] Confirmar nome e data do checkpoint para o usuário
