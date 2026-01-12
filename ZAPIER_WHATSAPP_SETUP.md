# Guia de Configuração: Notificação WhatsApp via Zapier

Este documento descreve como configurar a integração entre o CRM Seu Metro Quadrado e o Zapier para enviar notificações automáticas via WhatsApp quando um corretor recebe um novo lead do Facebook.

---

## Visão Geral do Fluxo

O sistema funciona da seguinte forma:

1. **Lead chega via Facebook Lead Ads** → Webhook do CRM recebe os dados
2. **Sistema distribui automaticamente** → Lead é atribuído a um corretor pela roleta
3. **CRM envia dados ao Zapier** → Webhook HTTP POST com informações estruturadas
4. **Zapier processa e envia WhatsApp** → Mensagem formatada é enviada ao corretor

---

## Pré-requisitos

Antes de começar, você precisará de:

- **Conta no Zapier** (plano gratuito ou pago)
- **Serviço de WhatsApp Business API** (escolha uma das opções abaixo):
  - **Twilio** - Serviço pago, mais confiável e estável
  - **MessageBird** - Alternativa ao Twilio com preços competitivos
  - **Evolution API** - Solução open-source gratuita (requer servidor próprio)
  - **WATI** - Plataforma brasileira especializada em WhatsApp Business
- **Telefones dos corretores cadastrados** no sistema CRM

---

## Passo 1: Criar o Zap no Zapier

### 1.1 Criar Novo Zap

1. Acesse [zapier.com](https://zapier.com) e faça login
2. Clique em **"Create Zap"** no canto superior direito
3. Dê um nome ao Zap: **"CRM → WhatsApp Corretor"**

### 1.2 Configurar Trigger (Gatilho)

1. **Trigger App**: Selecione **"Webhooks by Zapier"**
2. **Trigger Event**: Escolha **"Catch Hook"**
3. Clique em **"Continue"**
4. **Pick off a Child Key** (opcional): Deixe em branco
5. Clique em **"Continue"**
6. **Copie a URL do Webhook** gerada pelo Zapier (formato: `https://hooks.zapier.com/hooks/catch/XXXXXX/YYYYYY/`)

> ⚠️ **IMPORTANTE**: Guarde esta URL! Você precisará configurá-la no painel do Manus.

### 1.3 Testar o Trigger

Antes de continuar, você precisa enviar um payload de teste para o Zapier reconhecer a estrutura dos dados.

**Exemplo de payload que o CRM envia:**

```json
{
  "evento": "lead_criado",
  "timestamp": "2026-01-12T14:30:00Z",
  "lead": {
    "id": 1234,
    "nome": "Maria Santos",
    "telefone": "11987654321",
    "email": "maria@exemplo.com",
    "status": "aguardando_atendimento",
    "origem": "facebook",
    "projeto": "Residencial Parque das Flores"
  },
  "corretor": {
    "id": 5,
    "nome": "João Silva",
    "telefone": "11999999999",
    "email": "joao@exemplo.com"
  },
  "metadata": {
    "tipo": "notificacao_corretor",
    "origem_webhook": true
  }
}
```

Você pode enviar este payload usando **curl** ou **Postman** para testar:

```bash
curl -X POST https://hooks.zapier.com/hooks/catch/XXXXXX/YYYYYY/ \
  -H "Content-Type: application/json" \
  -d '{
    "evento": "lead_criado",
    "timestamp": "2026-01-12T14:30:00Z",
    "lead": {
      "id": 1234,
      "nome": "Maria Santos",
      "telefone": "11987654321",
      "email": "maria@exemplo.com",
      "origem": "facebook",
      "projeto": "Residencial Parque"
    },
    "corretor": {
      "id": 5,
      "nome": "João Silva",
      "telefone": "11999999999",
      "email": "joao@exemplo.com"
    }
  }'
```

Após enviar, clique em **"Test trigger"** no Zapier. Você deverá ver os dados recebidos.

---

## Passo 2: Configurar Action (Ação) - Enviar WhatsApp

### Opção A: Usando Twilio

1. **Action App**: Selecione **"Twilio"**
2. **Action Event**: Escolha **"Send WhatsApp Message"**
3. Clique em **"Continue"** e conecte sua conta Twilio
4. Configure os campos:
   - **From**: Seu número Twilio WhatsApp (formato: `whatsapp:+5511XXXXXXXX`)
   - **To**: `whatsapp:+55{{corretor__telefone}}` (campo dinâmico do trigger)
   - **Body** (corpo da mensagem):

```
🚨 *NOVO LEAD RECEBIDO!* 🚨

Olá {{corretor__nome}}! Você recebeu um novo lead via {{lead__origem}}.

👤 *Cliente:* {{lead__nome}}
📱 *Telefone:* {{lead__telefone}}
🏠 *Interesse:* {{lead__projeto}}

⏰ *ATENÇÃO:* Entre em contato o mais rápido possível!

Acesse o sistema para ver mais detalhes e registrar o atendimento.

_Seu Metro Quadrado - Sistema CRM_ 🏡
```

5. Clique em **"Test action"** para enviar uma mensagem de teste
6. Se funcionar, clique em **"Publish"** para ativar o Zap

### Opção B: Usando MessageBird

1. **Action App**: Selecione **"MessageBird"**
2. **Action Event**: Escolha **"Send WhatsApp Message"**
3. Conecte sua conta MessageBird
4. Configure:
   - **Channel ID**: Seu canal WhatsApp no MessageBird
   - **To**: `+55{{corretor__telefone}}`
   - **Type**: `text`
   - **Content**: Use o mesmo template de mensagem acima

### Opção C: Usando Evolution API (Open Source)

1. **Action App**: Selecione **"Webhooks by Zapier"**
2. **Action Event**: Escolha **"POST"**
3. Configure:
   - **URL**: `https://seu-servidor-evolution.com/message/sendText/sua-instancia`
   - **Payload Type**: `json`
   - **Data**:

```json
{
  "number": "55{{corretor__telefone}}",
  "text": "🚨 *NOVO LEAD RECEBIDO!* 🚨\n\nOlá {{corretor__nome}}! Você recebeu um novo lead via {{lead__origem}}.\n\n👤 *Cliente:* {{lead__nome}}\n📱 *Telefone:* {{lead__telefone}}\n🏠 *Interesse:* {{lead__projeto}}\n\n⏰ *ATENÇÃO:* Entre em contato o mais rápido possível!"
}
```

   - **Headers**:
     - `Content-Type`: `application/json`
     - `apikey`: `sua-api-key-evolution`

---

## Passo 3: Configurar URL do Webhook no Manus

Agora você precisa configurar a URL do Zapier no painel do Manus:

1. Acesse o **Painel de Gestão** do projeto Manus
2. Vá em **Settings → Secrets**
3. Clique em **"Add Secret"**
4. Configure:
   - **Key**: `ZAPIER_WEBHOOK_URL`
   - **Value**: Cole a URL do webhook copiada no Passo 1.2
5. Clique em **"Save"**

> 🔄 **Reinicie o servidor** após adicionar o secret para que a variável de ambiente seja carregada.

---

## Passo 4: Testar a Integração Completa

### 4.1 Teste Manual via Webhook do Facebook

1. Acesse o **Facebook Ads Manager**
2. Vá em **Ferramentas → Formulários de Cadastro**
3. Selecione um formulário ativo
4. Clique em **"Testar"** e preencha o formulário de teste
5. Aguarde alguns segundos

**O que deve acontecer:**
- Lead é criado no CRM
- Lead é distribuído automaticamente para um corretor
- Zapier recebe os dados
- Corretor recebe mensagem WhatsApp

### 4.2 Verificar Logs

**No Zapier:**
1. Acesse **"Zap History"** no menu lateral
2. Verifique se o Zap foi executado com sucesso
3. Se houver erro, clique para ver detalhes

**No CRM (servidor):**
```bash
# Verificar logs do servidor
tail -f /var/log/seu-metro-crm.log | grep Zapier
```

Você deve ver mensagens como:
```
[Zapier] Notificando corretor sobre novo lead: { corretor: 'João Silva', lead: 'Maria Santos', origem: 'facebook' }
[Zapier] Evento lead_criado enviado com sucesso
```

---

## Estrutura Completa do Payload

O CRM envia os seguintes dados para o Zapier:

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `evento` | string | Tipo do evento | `"lead_criado"` |
| `timestamp` | string | Data/hora ISO 8601 | `"2026-01-12T14:30:00Z"` |
| `lead.id` | number | ID do lead no CRM | `1234` |
| `lead.nome` | string | Nome do cliente | `"Maria Santos"` |
| `lead.telefone` | string | Telefone do cliente | `"11987654321"` |
| `lead.email` | string | Email do cliente | `"maria@exemplo.com"` |
| `lead.status` | string | Status atual | `"aguardando_atendimento"` |
| `lead.origem` | string | Origem do lead | `"facebook"` |
| `lead.projeto` | string | Projeto de interesse | `"Residencial Parque"` |
| `corretor.id` | number | ID do corretor | `5` |
| `corretor.nome` | string | Nome do corretor | `"João Silva"` |
| `corretor.telefone` | string | Telefone do corretor | `"11999999999"` |
| `corretor.email` | string | Email do corretor | `"joao@exemplo.com"` |
| `metadata.tipo` | string | Tipo de notificação | `"notificacao_corretor"` |
| `metadata.origem_webhook` | boolean | Se veio de webhook | `true` |

---

## Personalização da Mensagem

Você pode personalizar a mensagem WhatsApp usando os campos dinâmicos do Zapier. Exemplos:

### Mensagem Simples
```
Novo lead: {{lead__nome}}
Telefone: {{lead__telefone}}
```

### Mensagem Completa com Emojis
```
🚨 *NOVO LEAD RECEBIDO!* 🚨

Olá {{corretor__nome}}! 

👤 *Cliente:* {{lead__nome}}
📱 *Telefone:* {{lead__telefone}}
📧 *Email:* {{lead__email}}
🏠 *Interesse:* {{lead__projeto}}
📍 *Origem:* {{lead__origem}}

⏰ Entre em contato AGORA!

Acesse: https://seu-crm.manus.space/leads

_Seu Metro Quadrado_ 🏡
```

### Mensagem com Link Direto para WhatsApp
```
Novo lead recebido!

Cliente: {{lead__nome}}
Telefone: {{lead__telefone}}

Clique para iniciar conversa:
https://wa.me/55{{lead__telefone}}?text=Olá%20{{lead__nome}}!%20Sou%20{{corretor__nome}}%20da%20Seu%20Metro%20Quadrado.
```

---

## Troubleshooting (Resolução de Problemas)

### Problema: Corretor não recebe mensagem

**Verificações:**

1. **Zapier está ativo?**
   - Acesse o Zap e verifique se está **"ON"**
   - Veja em "Zap History" se há execuções recentes

2. **URL configurada corretamente?**
   - Vá em Settings → Secrets no Manus
   - Verifique se `ZAPIER_WEBHOOK_URL` está preenchida
   - Confirme que a URL começa com `https://hooks.zapier.com/`

3. **Telefone do corretor está cadastrado?**
   - Acesse a página de Corretores no CRM
   - Verifique se o campo "Telefone" está preenchido
   - Formato correto: `11999999999` (sem +55, sem espaços)

4. **Serviço de WhatsApp está ativo?**
   - Twilio: Verifique saldo e status do número
   - MessageBird: Confirme que o canal WhatsApp está aprovado
   - Evolution API: Teste se a instância está conectada

### Problema: Mensagem chega mas sem formatação

WhatsApp Business API tem limitações de formatação. Use:
- `*negrito*` para **negrito**
- `_itálico_` para _itálico_
- Emojis funcionam normalmente
- Quebras de linha: use `\n` no JSON ou Enter no Zapier

### Problema: Erro 400 no Zapier

**Causa comum**: Campos obrigatórios faltando no payload.

**Solução**:
1. Acesse "Zap History" e veja o erro detalhado
2. Verifique se todos os campos do corretor estão preenchidos no CRM
3. Teste com um payload completo usando curl (ver Passo 1.3)

### Problema: Muitas notificações duplicadas

**Causa**: Lead sendo distribuído múltiplas vezes.

**Solução**:
1. Verifique os logs do servidor: `grep "Zapier" /var/log/seu-metro-crm.log`
2. Confirme que o webhook do Facebook não está duplicado
3. Adicione um filtro no Zapier: **"Only continue if... evento is lead_criado"**

---

## Custos Estimados

### Twilio
- **WhatsApp Business**: ~R$ 0,25 por mensagem enviada
- **Número WhatsApp**: ~R$ 50/mês
- **Estimativa**: 100 leads/mês = R$ 75/mês

### MessageBird
- **WhatsApp Business**: ~R$ 0,20 por mensagem
- **Sem custo fixo de número**
- **Estimativa**: 100 leads/mês = R$ 20/mês

### Evolution API (Open Source)
- **Custo zero** (self-hosted)
- **Requer**: Servidor VPS (~R$ 30-50/mês)
- **Vantagem**: Sem limite de mensagens

### Zapier
- **Plano Free**: 100 tarefas/mês (suficiente para testes)
- **Plano Starter**: R$ 100/mês - 750 tarefas
- **Plano Professional**: R$ 250/mês - 2.000 tarefas

---

## Próximos Passos

Após configurar a notificação básica, você pode expandir o sistema:

1. **Notificar gestor sobre leads não atendidos** (após 30 minutos sem resposta)
2. **Enviar lembretes de follow-up** para corretores
3. **Notificar sobre agendamentos confirmados**
4. **Alertas de leads urgentes** (alta renda, projetos prioritários)
5. **Relatórios diários via WhatsApp** (resumo de performance)

---

## Suporte

Para dúvidas ou problemas:

- **Documentação Zapier**: https://zapier.com/help
- **Twilio WhatsApp Docs**: https://www.twilio.com/docs/whatsapp
- **Evolution API**: https://doc.evolution-api.com
- **Suporte Manus**: https://help.manus.im

---

**Última atualização**: Janeiro 2026  
**Versão do documento**: 1.0
