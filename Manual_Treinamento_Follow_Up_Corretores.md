# Manual de Treinamento: Sistema de Follow-up para Corretores

**Seu Metro Quadrado - CRM Imobiliário**  
**Versão 1.0 | Fevereiro de 2026**

---

## Introdução

Este manual foi desenvolvido para orientar os corretores sobre o novo sistema de follow-up implementado no CRM da Seu Metro Quadrado. O objetivo é garantir que todos os leads recebam acompanhamento adequado, maximizando as chances de conversão enquanto mantém a produtividade da equipe.

O sistema foi projetado com três pilares fundamentais: **flexibilidade** (você escolhe se quer fazer follow-ups a cada dia), **responsabilidade** (leads inativos são redistribuídos automaticamente) e **transparência** (você sempre sabe o status dos seus leads e o que acontecerá com eles).

---

## 1. Visão Geral do Sistema

O sistema de follow-up funciona de forma integrada com a aba **"Tarefas do Dia"**, onde você encontrará todos os leads que precisam de acompanhamento. A lógica é simples: leads no status **"Em Atendimento"** aparecem automaticamente na aba no dia seguinte à mudança de status, e você deve registrar uma tentativa de contato.

A grande novidade é o **modal de escolha diária**, que aparece toda manhã quando você abre o sistema. Ele pergunta se você deseja realizar os follow-ups do dia, oferecendo duas opções com consequências distintas.

| Escolha | Consequência Imediata | Regra de Transferência |
|---------|----------------------|------------------------|
| **Sim, vou fazer!** | Sistema fica bloqueado até você completar 100% dos follow-ups | Leads só são transferidos se você não interagir por 2 dias |
| **Não, pular hoje** | Sistema desbloqueia imediatamente | Leads voltam para sua base, mas serão transferidos se não houver interação por 2 dias |

---

## 2. Modal de Escolha Diária

### 2.1. Quando o Modal Aparece

O modal aparece automaticamente na primeira vez que você abre o sistema a cada dia, **apenas se houver follow-ups pendentes** para aquele dia. Se você não tiver nenhum follow-up agendado, o modal não aparece e o sistema funciona normalmente.

### 2.2. Opção 1: Sim, Vou Fazer!

Ao escolher esta opção, você se compromete a realizar todos os follow-ups do dia. O sistema aplica um **bloqueio gamificado** que impede o acesso às outras abas (Meus Leads, Kanban, Performance, etc.) até que você complete 100% das tarefas. Você verá um indicador de progresso mostrando quantos follow-ups já foram concluídos.

**Vantagens:**
- Garante que você mantenha o ritmo de acompanhamento dos leads
- Seus leads ficam protegidos contra transferência automática enquanto você estiver ativo
- Você ganha pontos de produtividade por cada follow-up realizado

**Desvantagens:**
- Você precisa completar todos os follow-ups antes de acessar outras funcionalidades do sistema
- Se tiver muitos follow-ups pendentes, pode levar tempo para desbloquear

### 2.3. Opção 2: Não, Pular Hoje

Ao escolher esta opção, o sistema desbloqueia imediatamente e você tem acesso total a todas as funcionalidades. Porém, os leads que estavam agendados para follow-up hoje **voltam para sua base** e ficam sujeitos à regra de transferência automática por inatividade.

**Vantagens:**
- Liberdade total para trabalhar em outras atividades (agendamentos, visitas, contratos)
- Útil em dias de alta demanda ou quando você tem compromissos externos
- Você pode registrar interações nos leads pela aba "Meus Leads" para evitar transferência

**Desvantagens:**
- Leads que não receberem interação ou mudança de status por 2 dias serão transferidos automaticamente
- Você não ganha pontos de produtividade pelos follow-ups não realizados
- Pode impactar negativamente seu ranking de produtividade

---

## 3. Fluxo de Trabalho na Aba "Tarefas do Dia"

### 3.1. Como os Leads Chegam na Aba

Um lead aparece na aba "Tarefas do Dia" no dia seguinte à sua mudança para o status **"Em Atendimento"**. Isso significa que, quando você move um lead de "Aguardando Atendimento" para "Em Atendimento", ele automaticamente será agendado para follow-up no dia seguinte às 09:00 (horário de São Paulo).

### 3.2. Registrando o Follow-up

Ao abrir a aba "Tarefas do Dia", você verá a lista de leads pendentes. Para cada lead, você deve:

1. Realizar a tentativa de contato (ligação, WhatsApp, e-mail, etc.)
2. Clicar no lead para abrir os detalhes
3. Registrar a interação no sistema
4. Informar se o cliente **respondeu** ou **não respondeu**

### 3.3. Cenário 1: Cliente Respondeu

Quando você marca que o cliente respondeu, o sistema entende que houve progresso na negociação. O lead é removido da aba "Tarefas do Dia" e a contagem de tentativas consecutivas sem resposta é resetada para 0. Um novo follow-up é agendado automaticamente para o dia seguinte às 09:00, e o lead permanece no status "Em Atendimento".

**Importante:** Sempre que o cliente responder, a regra de transferência automática é reiniciada. Isso significa que você tem mais 2 dias de "folga" antes que o lead seja considerado inativo.

### 3.4. Cenário 2: Cliente Não Respondeu

Quando você marca que o cliente não respondeu, o lead é removido da aba "Tarefas do Dia" e a contagem de tentativas consecutivas avança para **1/1**. O lead permanece na sua base com o status "Em Atendimento", mas agora está sujeito à regra de transferência automática.

**Atenção:** A partir deste momento, você tem **2 dias** para registrar uma nova interação (ligação, WhatsApp, mudança de status, etc.) ou o lead será transferido automaticamente para outro corretor.

---

## 4. Regra de Transferência Automática (2 Dias de Inatividade)

### 4.1. Como Funciona

A regra de transferência automática foi criada para garantir que nenhum lead fique "esquecido" na base de um corretor. Ela funciona da seguinte forma: se um lead marcar **1/1** (não respondeu) e não houver **nenhum registro de interação ou mudança de status** por 2 dias consecutivos, ele entra automaticamente na fila de redistribuição.

| Dia | Ação do Corretor | Status do Lead | Risco de Transferência |
|-----|------------------|----------------|------------------------|
| Segunda | Registra "Não respondeu" (1/1) | Em Atendimento | ⚠️ Atenção: 2 dias restantes |
| Terça | Nenhuma interação | Em Atendimento | ⚠️ Alerta: 1 dia restante |
| Quarta | Nenhuma interação | Em Atendimento | 🚨 Crítico: Transferência às 00:00 |
| Quinta | — | Aguardando Atendimento (novo corretor) | ✅ Transferido |

### 4.2. Como Evitar a Transferência

Para evitar que um lead seja transferido, basta registrar **qualquer interação** ou **mudar o status** do lead. Exemplos de ações que resetam o contador de inatividade:

- Registrar uma ligação (mesmo que o cliente não atenda)
- Enviar um WhatsApp
- Mudar o status do lead (de "Em Atendimento" para "Agendamento Confirmado", por exemplo)
- Registrar uma visita
- Criar um agendamento
- Enviar documentação

**Dica Profissional:** Se você sabe que não conseguirá fazer follow-up em um dia específico, registre uma interação rápida (como um WhatsApp) para manter o lead ativo na sua base.

### 4.3. Badge de Alerta "Sob Noturno"

O sistema exibe um badge de alerta **"Lead será descartado hoje às 00:00 por falta de interação"** às 09:00 do dia em que o lead está programado para ser transferido. Este alerta aparece diretamente no card do lead na aba "Meus Leads", dando a você uma última chance de interagir antes da transferência automática.

### 4.4. O Que Acontece Após a Transferência

Quando um lead é transferido automaticamente, ele volta para o status **"Aguardando Atendimento"** e é redistribuído para outro corretor ativo da equipe. O novo corretor recebe o lead como se fosse um lead novo, e o ciclo de follow-up recomeça.

Se o lead passar por todos os corretores aptos a recebê-lo e nenhum conseguir convertê-lo, ele é movido automaticamente para o status **"Perdido"** e direcionado para a **"Lixeira"** (arquivo morto).

---

## 5. Exceções e Regras Especiais

### 5.1. Leads de Captação Própria

Leads com origem **"Captação Corretor"** (ou "Captação Própria") são **exceção** à regra de transferência automática. Isso significa que, se você captou o lead por conta própria (indicação, prospecção ativa, etc.), ele **nunca** será transferido automaticamente, mesmo que fique inativo por mais de 2 dias.

**Justificativa:** Leads captados pelo próprio corretor representam esforço pessoal e networking, e devem permanecer na base do corretor independentemente do ritmo de acompanhamento.

### 5.2. Leads em Status Avançado

Leads com status mais avançados que **"Em Atendimento"** (como "Agendamento Confirmado", "Visita Realizada", "Análise de Crédito", "Contrato em Negociação") **não** são transferidos automaticamente. A regra de transferência se aplica apenas a leads no status "Em Atendimento".

**Justificativa:** Leads em estágios avançados do funil já demonstraram interesse real e estão em processo de negociação ativa. Transferi-los poderia prejudicar a relação com o cliente.

### 5.3. Gestores e Administradores

Gestores e administradores **não** são bloqueados pelo sistema de follow-up. Eles têm acesso total a todas as funcionalidades do sistema, independentemente de terem follow-ups pendentes. Porém, eles ainda podem visualizar o indicador de progresso de follow-ups para acompanhar sua própria produtividade.

---

## 6. Sistema de Pontuação e Gamificação

### 6.1. Pontos por Atividade

O sistema atribui pontos de produtividade para cada atividade realizada. A tabela abaixo mostra a pontuação atualizada:

| Atividade | Pontos |
|-----------|--------|
| Ligação realizada | 2 pts |
| WhatsApp enviado | 1 pt |
| Agendamento confirmado | 100 pts |
| Visita realizada | 250 pts |
| Análise de crédito enviada | 400 pts |
| Contrato fechado (venda) | 1000 pts |

**Importante:** As atividades são atribuídas ao **corretor dono do lead**, não ao gestor ou admin que executou a ação. Isso garante que a pontuação reflita o trabalho real de cada corretor.

### 6.2. Ranking de Produtividade

O ranking de produtividade é atualizado em tempo real e pode ser visualizado na aba **"Performance TV"**. Ele considera a soma de todos os pontos acumulados no período selecionado (dia, semana, mês ou todo o período).

### 6.3. Celebração de Desbloqueio

Quando você completa 100% dos follow-ups do dia (após escolher "Sim, vou fazer!"), o sistema exibe uma animação de celebração e desbloqueia todas as funcionalidades. Isso serve como reforço positivo e reconhecimento do seu esforço.

---

## 7. Dicas e Boas Práticas

### 7.1. Planeje Seu Dia

Ao abrir o sistema pela manhã, verifique quantos follow-ups você tem pendentes antes de fazer a escolha no modal. Se você tiver muitos follow-ups e compromissos externos agendados, considere escolher "Não, pular hoje" e registrar interações manuais nos leads mais quentes.

### 7.2. Priorize Leads Quentes

Se você escolheu "Não, pular hoje", foque em registrar interações nos leads que estão mais próximos de fechar negócio. Isso evita que leads valiosos sejam transferidos por inatividade.

### 7.3. Use o Badge "Sob Noturno" como Alerta

O badge de alerta que aparece às 09:00 é sua última chance de salvar um lead da transferência. Sempre que vir este badge, priorize aquele lead imediatamente.

### 7.4. Registre Todas as Interações

Mesmo interações rápidas (como um WhatsApp de "bom dia" ou uma ligação não atendida) devem ser registradas no sistema. Isso mantém o lead ativo na sua base e demonstra esforço de acompanhamento.

### 7.5. Mude o Status Quando Apropriado

Se um lead avançou no funil (confirmou agendamento, realizou visita, etc.), mude o status imediatamente. Isso não só reseta o contador de inatividade, mas também reflete com precisão o estágio da negociação.

### 7.6. Comunique-se com a Gestão

Se você está enfrentando dificuldades para completar os follow-ups diários (volume muito alto, problemas pessoais, etc.), comunique-se com a gestão. Eles podem ajustar a distribuição de leads ou oferecer suporte temporário.

---

## 8. Perguntas Frequentes (FAQ)

### 8.1. O que acontece se eu fechar o sistema sem completar os follow-ups?

Se você escolheu "Sim, vou fazer!" e fechou o sistema sem completar 100% dos follow-ups, o bloqueio permanece ativo. Quando você reabrir o sistema, verá o mesmo overlay de bloqueio e precisará completar as tarefas pendentes.

### 8.2. Posso mudar minha escolha durante o dia?

Não. A escolha feita no modal diário é válida apenas para aquele dia e não pode ser alterada. No dia seguinte, o modal aparecerá novamente e você poderá fazer uma nova escolha.

### 8.3. Se eu escolher "Não" todos os dias, serei penalizado?

Não há penalização direta por escolher "Não, pular hoje". Porém, você não ganhará pontos de produtividade pelos follow-ups não realizados, o que pode impactar seu ranking. Além disso, leads inativos serão transferidos, reduzindo sua base de leads.

### 8.4. Leads transferidos voltam para mim algum dia?

Não. Uma vez que um lead é transferido automaticamente, ele não volta para sua base. Ele será redistribuído para outro corretor e seguirá o ciclo de follow-up com o novo responsável.

### 8.5. Posso ver o histórico de transferências de um lead?

Sim. Na aba "Meus Leads", ao clicar em um lead, você pode visualizar o histórico completo de transferências na seção "Histórico de Atividades". Isso inclui quem eram os corretores anteriores e quando as transferências ocorreram.

### 8.6. O que acontece com leads que não respondem após várias tentativas?

Se um lead passar por todos os corretores aptos a recebê-lo e nenhum conseguir obter resposta, ele é movido automaticamente para o status "Perdido" e direcionado para a "Lixeira". A gestão pode revisar periodicamente a lixeira para decidir se vale a pena reativar algum lead.

### 8.7. Posso desativar o bloqueio de follow-up?

Não. O sistema de bloqueio é uma funcionalidade central do CRM e não pode ser desativado por corretores individuais. Apenas o gestor administrador tem controle sobre configurações globais do sistema.

### 8.8. Como funciona o fuso horário do sistema?

Todo o sistema opera no fuso horário de **São Paulo Capital (GMT-3)**. Isso significa que "hoje" é sempre de 00:00 às 23:59 no horário de SP, e follow-ups são agendados para 09:00 SP. Se você estiver em outro fuso horário, ajuste mentalmente os horários.

---

## 9. Suporte e Contato

Se você tiver dúvidas, problemas técnicos ou sugestões de melhoria, entre em contato com a gestão através dos canais oficiais da empresa. O sistema está em constante evolução, e seu feedback é fundamental para aprimorarmos a experiência de todos os corretores.

**Equipe Seu Metro Quadrado**  
*Transformando leads em negócios de sucesso*

---

**Versão do Manual:** 1.0  
**Data de Publicação:** Fevereiro de 2026  
**Autor:** Manus AI
