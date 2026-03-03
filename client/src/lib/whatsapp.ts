/**
 * Gera um link do WhatsApp com mensagem personalizada pré-preenchida.
 *
 * @param telefone  Número do cliente (qualquer formato)
 * @param nome      Nome do cliente
 * @param projeto   Nome do projeto de interesse (opcional)
 * @returns         URL completa para abrir o WhatsApp com a mensagem
 */
export function gerarLinkWhatsApp(
  telefone: string,
  nome?: string | null,
  projeto?: string | null
): string {
  const numero = telefone.replace(/\D/g, "");
  const numeroComCodigo = numero.startsWith("55") ? numero : `55${numero}`;

  // Sanitizar: não usar projeto se for igual ao nome do cliente (evita confusão de campos)
  const nomeNorm = nome?.trim().toLowerCase() ?? "";
  const projetoNorm = projeto?.trim().toLowerCase() ?? "";
  const projetoValido =
    projeto &&
    projeto.trim().length > 0 &&
    projetoNorm !== nomeNorm
      ? projeto.trim()
      : null;

  let mensagem: string;

  if (nome && projetoValido) {
    mensagem = `Olá, ${nome}! Tudo bem? 😊 Vi que você demonstrou interesse no empreendimento *${projetoValido}*. Sou corretor(a) da Seu Metro Quadrado e estou aqui para te ajudar. Posso te passar mais informações?`;
  } else if (nome) {
    mensagem = `Olá, ${nome}! Tudo bem? 😊 Vi que você demonstrou interesse em nossos empreendimentos. Sou corretor(a) da Seu Metro Quadrado e estou aqui para te ajudar. Posso te passar mais informações?`;
  } else {
    mensagem = `Olá! Tudo bem? 😊 Vi que você demonstrou interesse em nossos empreendimentos. Sou corretor(a) da Seu Metro Quadrado e estou aqui para te ajudar. Posso te passar mais informações?`;
  }

  return `https://wa.me/${numeroComCodigo}?text=${encodeURIComponent(mensagem)}`;
}
