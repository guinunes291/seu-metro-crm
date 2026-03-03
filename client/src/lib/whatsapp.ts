/**
 * Gera um link do WhatsApp com mensagem genérica pré-preenchida.
 * Não menciona o empreendimento específico — apenas referencia interesse
 * em empreendimentos em São Paulo.
 *
 * @param telefone  Número do cliente (qualquer formato)
 * @param nome      Nome do cliente (opcional)
 * @returns         URL completa para abrir o WhatsApp com a mensagem
 */
export function gerarLinkWhatsApp(
  telefone: string,
  nome?: string | null,
  _projeto?: string | null
): string {
  const numero = telefone.replace(/\D/g, "");
  const numeroComCodigo = numero.startsWith("55") ? numero : `55${numero}`;

  const mensagem = nome
    ? `Olá, ${nome}! Tudo bem? 😊 Vi que você demonstrou interesse em empreendimentos em São Paulo. Sou corretor(a) da Seu Metro Quadrado e estou aqui para te ajudar. Posso te passar mais informações?`
    : `Olá! Tudo bem? 😊 Vi que você demonstrou interesse em empreendimentos em São Paulo. Sou corretor(a) da Seu Metro Quadrado e estou aqui para te ajudar. Posso te passar mais informações?`;

  return `https://wa.me/${numeroComCodigo}?text=${encodeURIComponent(mensagem)}`;
}
