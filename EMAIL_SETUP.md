# 📧 Configuração de Notificações por Email

## Visão Geral

O sistema envia notificações automáticas por email para corretores quando recebem leads via webhook do Facebook. Esta funcionalidade **NÃO** envia emails para leads da distribuição automática, apenas para leads que chegam via webhook.

---

## ⚙️ Configuração

### Passo 1: Escolher Provedor de Email

Você pode usar qualquer provedor SMTP. Recomendações:

#### **Gmail (Recomendado para Testes)**
- Gratuito
- Fácil configuração
- Limite: 500 emails/dia

#### **SendGrid**
- Gratuito: 100 emails/dia
- Pago: a partir de $19.95/mês (40.000 emails)
- Melhor para produção

#### **Amazon SES**
- Muito barato: $0.10 por 1.000 emails
- Requer configuração de domínio

#### **Mailgun**
- Gratuito: 5.000 emails/mês (primeiros 3 meses)
- Pago: a partir de $35/mês

---

### Passo 2: Obter Credenciais SMTP

#### **Para Gmail:**

1. Acesse https://myaccount.google.com/security
2. Ative a **Verificação em duas etapas**
3. Vá em **Senhas de app** (https://myaccount.google.com/apppasswords)
4. Selecione:
   - App: **Email**
   - Dispositivo: **Outro (nome personalizado)** → Digite "CRM Seu Metro Quadrado"
5. Clique em **Gerar**
6. Copie a senha de 16 dígitos gerada

**Credenciais:**
```
HOST: smtp.gmail.com
PORT: 587
USER: seu-email@gmail.com
PASS: xxxx xxxx xxxx xxxx (senha de app gerada)
FROM: "CRM Seu Metro Quadrado <seu-email@gmail.com>"
```

#### **Para SendGrid:**

1. Cadastre-se em https://sendgrid.com
2. Vá em **Settings → API Keys**
3. Clique em **Create API Key**
4. Dê um nome (ex: "CRM Seu Metro Quadrado")
5. Selecione **Full Access**
6. Copie a API Key gerada

**Credenciais:**
```
HOST: smtp.sendgrid.net
PORT: 587
USER: apikey (literalmente "apikey")
PASS: SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (sua API Key)
FROM: "CRM Seu Metro Quadrado <crm@seudominio.com.br>"
```

---

### Passo 3: Configurar no Manus

1. Acesse o painel do projeto no Manus
2. Vá em **Settings → Secrets**
3. Adicione as seguintes variáveis de ambiente:

```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=seu-email@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx
EMAIL_FROM="CRM Seu Metro Quadrado <seu-email@gmail.com>"
```

**⚠️ IMPORTANTE:**
- Substitua os valores pelos dados do seu provedor
- Para Gmail, use a **senha de app**, não sua senha normal
- O campo `EMAIL_FROM` deve incluir o nome e o email entre aspas

---

### Passo 4: Testar Configuração

Após configurar as variáveis, você pode testar o envio de email:

```bash
# No console do servidor (opcional)
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"seu-email-teste@gmail.com"}'
```

Ou simplesmente **distribua um lead de teste via webhook do Facebook** e verifique se o corretor recebe o email.

---

## 📨 Como Funciona

### Fluxo Automático:

1. **Lead chega via webhook do Facebook**
2. Sistema cria o lead no banco de dados
3. Sistema distribui automaticamente pela roleta
4. **Sistema envia email para o corretor atribuído**
5. Corretor recebe email com:
   - Nome do lead
   - Telefone
   - Email (se disponível)
   - Projeto
   - Faixa de renda
   - Campanha
   - Botão direto para WhatsApp

### Exemplo de Email:

```
Assunto: 🔔 Novo Lead: João Silva - Facebook

Olá Guilherme Nunes,

Um novo lead chegou via Facebook e foi distribuído automaticamente para você. 
Entre em contato o mais rápido possível!

📋 Informações do Lead
Nome: João Silva
Telefone: (11) 99999-9999
Email: joao@exemplo.com
Projeto: Residencial Parque das Flores
Faixa de Renda: R$ 5.000 - R$ 10.000

[💬 Contatar via WhatsApp]

💡 Dica: Leads do Facebook têm alta taxa de conversão quando contatados 
nas primeiras 5 minutos!
```

---

## 🔧 Troubleshooting

### Email não está sendo enviado

1. **Verifique as variáveis de ambiente:**
   ```bash
   echo $EMAIL_HOST
   echo $EMAIL_PORT
   echo $EMAIL_USER
   # EMAIL_PASS não mostra por segurança
   ```

2. **Verifique os logs do servidor:**
   - Procure por `[Email] Notificação enviada` (sucesso)
   - Procure por `[Email] Erro ao enviar` (falha)

3. **Erros comuns:**

   **"Invalid login"** → Senha incorreta ou autenticação em 2 etapas não configurada
   - Gmail: Use senha de app, não sua senha normal
   - SendGrid: Use "apikey" como usuário

   **"Connection timeout"** → Firewall bloqueando porta 587
   - Tente porta 465 (SSL) ao invés de 587 (TLS)
   - Verifique se seu servidor permite conexões SMTP

   **"Sender address rejected"** → Email remetente inválido
   - Verifique se `EMAIL_FROM` está no formato correto
   - Gmail: Use o mesmo email do `EMAIL_USER`

### Email cai na caixa de spam

1. **Configure SPF e DKIM** (requer domínio próprio)
2. **Use um domínio profissional** ao invés de Gmail
3. **Evite palavras como "urgente", "promoção"** no assunto
4. **Peça aos corretores para marcarem como "não spam"**

---

## 🎯 Boas Práticas

### 1. Use Domínio Próprio em Produção

Ao invés de `crm@gmail.com`, use `crm@seumetroquadrado.com.br`:
- Mais profissional
- Menor chance de cair em spam
- Maior confiabilidade

### 2. Monitore Limites de Envio

- **Gmail**: 500 emails/dia
- **SendGrid Free**: 100 emails/dia
- **SendGrid Essentials**: 40.000 emails/mês

### 3. Personalize o Template

Você pode editar o template HTML do email em:
```
server/emailService.ts → função enviarNotificacaoLeadWebhook()
```

### 4. Teste Regularmente

Envie leads de teste para verificar se:
- Email chega rapidamente (< 1 minuto)
- Formatação está correta
- Links funcionam
- Não cai em spam

---

## 📊 Estatísticas

Para monitorar envios de email, verifique os logs do servidor:

```bash
# Ver últimos emails enviados
grep "[Email]" logs/server.log | tail -20

# Contar emails enviados hoje
grep "[Email] Notificação enviada" logs/server.log | grep "$(date +%Y-%m-%d)" | wc -l
```

---

## 🔐 Segurança

**⚠️ NUNCA:**
- Commit credenciais no código
- Compartilhe senhas de app
- Use a mesma senha para múltiplos serviços

**✅ SEMPRE:**
- Use variáveis de ambiente
- Rotacione senhas periodicamente
- Use senhas de app ao invés de senha principal
- Monitore logs de acesso

---

## 📞 Suporte

Se tiver problemas, verifique:
1. Logs do servidor (`[Email]` no console)
2. Configuração das variáveis de ambiente
3. Credenciais do provedor SMTP
4. Firewall e portas abertas

**Documentação dos provedores:**
- Gmail: https://support.google.com/mail/answer/7126229
- SendGrid: https://docs.sendgrid.com/for-developers/sending-email/integrating-with-the-smtp-api
- Amazon SES: https://docs.aws.amazon.com/ses/latest/dg/send-email-smtp.html
