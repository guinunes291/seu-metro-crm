# Configuração Zapier → WhatsApp para Notificação de Leads

Este documento explica como configurar a integração entre o CRM e o WhatsApp via Zapier para notificar corretores quando receberem novos leads vindos de webhook (Facebook, Google Sheets, etc).

---

## 📋 Pré-requisitos

1. Conta no Zapier (gratuita ou paga)
2. Acesso ao WhatsApp Business API ou serviço compatível:
   - **Twilio** (recomendado - tem integração nativa com Zapier)
   - **MessageBird**
   - **360Dialog**
   - Ou outro provedor de WhatsApp Business API

---

## 🔧 Passo 1: Criar o Zap no Zapier

### 1.1 Trigger: Webhooks by Zapier

1. Acesse [zapier.com](https://zapier.com) e clique em **"Create Zap"**
2. No **Trigger**, busque por **"Webhooks by Zapier"**
3. Escolha o evento: **"Catch Hook"**
4. Clique em **"Continue"**
5. O Zapier irá gerar uma **URL de webhook**. Exemplo:
   ```
   https://hooks.zapier.com/hooks/catch/123456/abcdef/
   ```
6. **COPIE ESTA URL** - você precisará configurá-la no CRM

### 1.2 Testar o Webhook

Antes de continuar, você precisa enviar um teste do CRM para o Zapier capturar a estrutura dos dados.

**Estrutura do payload enviado pelo CRM:**

```json
{
  "evento": "lead_distribuido",
  "timestamp": "2026-01-12T10:30:00.000Z",
  "corretor": {
    "id": 5,
    "nome": "João Silva",
    "telefone": "+5511999999999",
    "email": "joao@exemplo.com"
  },
  "lead": {
    "id": 1234,
    "nome": "Maria Santos",
    "telefone": "+5511888888888",
    "email": "maria@exemplo.com",
    "origem": "facebook",
    "projeto": "Residencial Parque das Flores",
    "campanha": "Campanha Verão 2026",
    "faixaRenda": "R$ 5.000 - R$ 10.000"
  }
}
```

---

## 🔧 Passo 2: Configurar Action (Enviar WhatsApp)

### 2.1 Escolher o App de WhatsApp

No Zapier, adicione uma **Action** e escolha seu provedor de WhatsApp:

**Opção A: Twilio (Recomendado)**
1. Busque por **"Twilio"**
2. Escolha a ação: **"Send WhatsApp Message"**
3. Conecte sua conta Twilio
4. Configure os campos:
   - **From**: Seu número WhatsApp Business (formato: `whatsapp:+5511XXXXXXXX`)
   - **To**: `whatsapp:{{corretor__telefone}}` (campo dinâmico do webhook)
   - **Body**: Mensagem personalizada (veja exemplo abaixo)

**Opção B: MessageBird**
1. Busque por **"MessageBird"**
2. Escolha a ação: **"Send WhatsApp Message"**
3. Conecte sua conta MessageBird
4. Configure os campos conforme documentação do MessageBird

### 2.2 Exemplo de Mensagem WhatsApp

```
🎯 *NOVO LEAD ATRIBUÍDO!*

Olá {{corretor__nome}}! 👋

Você recebeu um novo lead do Facebook:

📋 *Dados do Cliente:*
• Nome: {{lead__nome}}
• Telefone: {{lead__telefone}}
• Email: {{lead__email}}

🏢 *Interesse:*
• Projeto: {{lead__projeto}}
• Campanha: {{lead__campanha}}
• Faixa de Renda: {{lead__faixaRenda}}

⏰ *Ação Imediata:*
Entre em contato em até 5 minutos para maximizar a conversão!

🔗 Acesse o CRM: https://seu-crm.manus.space
```

---

## 🔧 Passo 3: Configurar URL no CRM

### 3.1 Adicionar a URL do Zapier no Sistema

A URL do webhook do Zapier já está configurada automaticamente no sistema através da variável de ambiente `ZAPIER_WEBHOOK_URL`.

**Para verificar ou atualizar:**
1. Acesse o painel de administração do Manus
2. Vá em **Settings → Secrets**
3. Localize a variável `ZAPIER_WEBHOOK_URL`
4. Cole a URL fornecida pelo Zapier no Passo 1.1

### 3.2 Verificar se está funcionando

Após configurar:
1. Crie um lead de teste via webhook do Facebook
2. O sistema irá distribuir para um corretor
3. O corretor receberá a mensagem no WhatsApp automaticamente

---

## 📊 Dados Enviados ao Zapier

O sistema envia os seguintes dados para o Zapier:

| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| `evento` | Tipo de evento | `"lead_distribuido"` |
| `timestamp` | Data/hora do evento | `"2026-01-12T10:30:00.000Z"` |
| `corretor.id` | ID do corretor | `5` |
| `corretor.nome` | Nome do corretor | `"João Silva"` |
| `corretor.telefone` | Telefone do corretor | `"+5511999999999"` |
| `corretor.email` | Email do corretor | `"joao@exemplo.com"` |
| `lead.id` | ID do lead | `1234` |
| `lead.nome` | Nome do lead | `"Maria Santos"` |
| `lead.telefone` | Telefone do lead | `"+5511888888888"` |
| `lead.email` | Email do lead | `"maria@exemplo.com"` |
| `lead.origem` | Origem do lead | `"facebook"` |
| `lead.projeto` | Projeto de interesse | `"Residencial Parque"` |
| `lead.campanha` | Campanha do Facebook | `"Campanha Verão"` |
| `lead.faixaRenda` | Faixa de renda | `"R$ 5.000 - R$ 10.000"` |

---

## ⚠️ Observações Importantes

### Quando a notificação é enviada?

A notificação via Zapier é enviada **APENAS** quando:
- ✅ Lead vem de **origem webhook** (Facebook, Google Sheets, Site, etc)
- ✅ Lead é **distribuído automaticamente** pela roleta
- ❌ **NÃO** é enviado para leads de "Captação Própria" do corretor
- ❌ **NÃO** é enviado para distribuições manuais pelo gestor

### Formato do telefone

- O telefone do corretor deve estar cadastrado no formato internacional: `+5511999999999`
- Se o telefone não tiver o `+55`, você pode adicionar no Zapier usando formatação

### Custos

- **Zapier**: Plano gratuito permite 100 tarefas/mês. Planos pagos a partir de $19.99/mês
- **Twilio**: ~$0.005 por mensagem WhatsApp
- **MessageBird**: Preços variam por região

### Troubleshooting

**Problema: Webhook não está sendo recebido pelo Zapier**
- Verifique se a URL está correta no painel de Secrets
- Teste manualmente enviando um POST para a URL do Zapier

**Problema: Mensagem não chega no WhatsApp**
- Verifique se o número do corretor está no formato correto
- Confirme que sua conta Twilio/MessageBird está ativa
- Verifique os logs do Zapier para ver erros

**Problema: Mensagem chega mas campos estão vazios**
- Verifique o mapeamento de campos no Zapier
- Use os nomes exatos dos campos: `corretor__nome`, `lead__telefone`, etc

---

## 🎯 Próximos Passos

Após configurar a notificação básica, você pode:

1. **Adicionar filtros** no Zapier para enviar apenas leads de campanhas específicas
2. **Criar múltiplos Zaps** para diferentes tipos de notificação (transferências, follow-ups)
3. **Integrar com outros apps** como Slack, Email, SMS, etc
4. **Adicionar delays** para enviar lembretes se o corretor não responder em X minutos

---

## 📞 Suporte

Para dúvidas sobre:
- **Configuração do CRM**: Acesse [help.manus.im](https://help.manus.im)
- **Zapier**: Acesse [zapier.com/help](https://zapier.com/help)
- **Twilio**: Acesse [twilio.com/docs](https://www.twilio.com/docs)
