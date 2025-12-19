# Como Testar o Webhook do Facebook Lead Ads

## Ferramenta de Teste Oficial

O Facebook oferece uma ferramenta de teste em:
**https://developers.facebook.com/tools/lead-ads-testing/**

### Passos para testar:

1. Acesse a ferramenta de teste
2. Selecione a página no dropdown "Choose a page"
3. Selecione o formulário no dropdown "Choose a form"
4. Clique em "Create a test lead"
5. Clique em "Track Status" para ver se o webhook recebeu

### Importante:
- Só é possível criar 1 lead de teste por formulário
- Para criar outro, primeiro clique em "Delete lead"
- A ferramenta NÃO funciona em modo desenvolvedor (developer mode)
- O app precisa estar em modo "Live" para receber webhooks

## Verificar Status do Webhook

No Facebook Developers:
1. Vá em Webhooks
2. Clique em "Test" ao lado do evento "leadgen"
3. Verifique se o status mostra "success"

## Requisitos para o Webhook Funcionar

1. **App em modo Live** (não Developer)
2. **Página assinada** para eventos leadgen
3. **Permissões corretas**: leads_retrieval, pages_read_engagement
4. **Token de acesso válido** com as permissões necessárias

## URL do Webhook Configurado

```
https://seumetrocrm-gjgl2sfx.manus.space/api/webhook/facebook/49865176a1794282b43b0756d79faac3
```

Verify Token: `49865176a1794282b43b0756d79faac3`
