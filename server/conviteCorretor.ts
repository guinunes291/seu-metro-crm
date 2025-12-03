import { notifyOwner } from "./_core/notification";

/**
 * Envia convite de boas-vindas para novo corretor
 * 
 * Como o sistema usa autenticação OAuth do Manus, o gestor precisa:
 * 1. Compartilhar o projeto no Manus com o email do corretor
 * 2. O corretor receberá convite por email do Manus
 * 
 * Esta função envia uma notificação ao gestor lembrando de compartilhar o projeto
 */
export async function enviarConviteCorretor(
  corretorNome: string,
  corretorEmail: string
): Promise<boolean> {
  const mensagem = `
📧 **Novo Corretor Cadastrado**

**Nome:** ${corretorNome}
**Email:** ${corretorEmail}

⚠️ **Ação Necessária:**
Para que o corretor possa acessar o sistema, você precisa:

1. Acessar as configurações do projeto no Manus
2. Clicar em "Compartilhar"
3. Adicionar o email: ${corretorEmail}
4. Definir permissão como "Membro"

O corretor receberá automaticamente um convite por email do Manus para acessar o sistema.
  `.trim();

  try {
    const sucesso = await notifyOwner({
      title: `Novo Corretor: ${corretorNome}`,
      content: mensagem,
    });

    return sucesso;
  } catch (error) {
    console.error("Erro ao enviar notificação de novo corretor:", error);
    return false;
  }
}

/**
 * Gera instruções de acesso para enviar manualmente ao corretor
 */
export function gerarInstrucoesAcesso(
  corretorNome: string,
  urlSistema: string
): string {
  return `
Olá ${corretorNome}!

Você foi cadastrado no sistema CRM Seu Metro Quadrado.

**Como acessar:**
1. Aguarde receber um email de convite do Manus (verifique sua caixa de spam)
2. Clique no link do convite para aceitar
3. Acesse o sistema em: ${urlSistema}
4. Faça login com sua conta Manus

**Suas credenciais:**
- Email: (o mesmo que você recebeu este convite)
- Senha: Use sua senha do Manus ou crie uma nova conta

Em caso de dúvidas, entre em contato com o gestor.

Bem-vindo à equipe!
  `.trim();
}
