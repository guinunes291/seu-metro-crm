/**
 * Utilitário de alertas sonoros para o TimerLead.
 * Usa a Web Audio API para gerar beeps sintéticos — sem arquivos externos.
 *
 * Política de autoplay: navegadores modernos bloqueiam áudio até que o usuário
 * interaja com a página. Por isso, o AudioContext é criado na primeira chamada
 * após uma interação (click, keydown, etc.) e reutilizado nas demais.
 */

let audioCtx: AudioContext | null = null;

/** Retorna (ou cria) o AudioContext compartilhado. */
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx || audioCtx.state === "closed") {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  // Resume caso esteja suspenso (política de autoplay)
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => null);
  }
  return audioCtx;
}

/**
 * Toca um beep sintético.
 * @param frequency  Frequência em Hz (padrão 880 Hz — Lá5)
 * @param duration   Duração em segundos (padrão 0.15s)
 * @param volume     Volume 0–1 (padrão 0.4)
 * @param startDelay Atraso em segundos antes de tocar (padrão 0)
 */
function playBeep(
  frequency = 880,
  duration = 0.15,
  volume = 0.4,
  startDelay = 0
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime + startDelay;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, now);

  // Envelope: attack rápido → sustain → release suave
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume, now + 0.01);
  gainNode.gain.setValueAtTime(volume, now + duration - 0.03);
  gainNode.gain.linearRampToValueAtTime(0, now + duration);

  oscillator.start(now);
  oscillator.stop(now + duration);
}

/**
 * Alerta de entrada nos últimos 3 minutos.
 * 3 beeps ascendentes — "atenção!"
 */
export function playAlertaUrgencia(): void {
  playBeep(660, 0.12, 0.45, 0.00);   // Dó5
  playBeep(880, 0.12, 0.45, 0.15);   // Lá5
  playBeep(1100, 0.18, 0.50, 0.30);  // Dó#6 — tom mais alto
}

/**
 * Beep de lembrete periódico (a cada 30s nos últimos 3 minutos).
 * 1 beep curto e discreto.
 */
export function playLembrete(): void {
  playBeep(880, 0.10, 0.30, 0.00);
}

/**
 * Alerta de expiração do timer.
 * 5 beeps rápidos descendentes — "urgente!"
 */
export function playAlertaExpiracao(): void {
  for (let i = 0; i < 5; i++) {
    playBeep(1100 - i * 80, 0.10, 0.55, i * 0.14);
  }
}

/**
 * Inicializa (ou resume) o AudioContext.
 * Deve ser chamado em resposta a um evento de interação do usuário
 * para desbloquear o autoplay nos navegadores modernos.
 */
export function initAudio(): void {
  getAudioContext();
}
