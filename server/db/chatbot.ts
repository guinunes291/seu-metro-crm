/**
 * server/db/chatbot.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Chatbot de pré-qualificação e FAQ.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export {
  createConversaChatbot,
  getConversaChatbotBySession,
  updateConversaChatbot,
  addMensagemChatbot,
  getFaqsChatbot,
  createFaqChatbot,
  converterConversaEmLead,
} from "../db";
