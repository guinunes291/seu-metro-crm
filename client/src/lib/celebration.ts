import confetti from 'canvas-confetti';
import { toast } from 'sonner';

/**
 * Toca animação de confete comemorativo
 */
export function playConfetti() {
  const duration = 3000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const interval: ReturnType<typeof setInterval> = setInterval(function() {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);
    
    // Confete da esquerda
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
    });
    
    // Confete da direita
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
    });
  }, 250);
}

/**
 * Toca som de conquista
 */
export function playVictorySound() {
  try {
    // Criar contexto de áudio
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Criar oscilador para som de vitória (melodia ascendente)
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    let startTime = audioContext.currentTime;
    
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.3);
      
      startTime += 0.15;
    });
  } catch (error) {
    console.warn('Não foi possível tocar som de vitória:', error);
  }
}

/**
 * Celebração completa: confete + som + toast
 */
export function celebrate() {
  playConfetti();
  playVictorySound();
  
  toast.success('🎉 Parabéns! Sistema desbloqueado!', {
    description: 'Você atingiu a meta de 60% dos follow-ups. Continue assim!',
    duration: 5000,
    className: 'text-lg font-bold',
  });
}
