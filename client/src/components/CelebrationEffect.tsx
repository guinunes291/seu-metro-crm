import { useEffect, useCallback } from "react";
import confetti from "canvas-confetti";

interface CelebrationEffectProps {
  trigger: boolean;
  onComplete?: () => void;
}

// Som de celebração via URL pública
const CELEBRATION_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3";

export function CelebrationEffect({ trigger, onComplete }: CelebrationEffectProps) {
  const playCelebration = useCallback(() => {
    // Tocar som de celebração
    const audio = new Audio(CELEBRATION_SOUND_URL);
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Ignorar erro se o navegador bloquear autoplay
    });

    // Confete colorido
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        onComplete?.();
        return;
      }

      const particleCount = 50 * (timeLeft / duration);

      // Confete dos dois lados
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#9370DB', '#32CD32']
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#9370DB', '#32CD32']
      });
    }, 250);

    // Explosão central inicial
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#9370DB', '#32CD32'],
      zIndex: 9999
    });
  }, [onComplete]);

  useEffect(() => {
    if (trigger) {
      playCelebration();
    }
  }, [trigger, playCelebration]);

  return null;
}

// Hook para disparar celebração manualmente
export function useCelebration() {
  const celebrate = useCallback(() => {
    // Tocar som
    const audio = new Audio(CELEBRATION_SOUND_URL);
    audio.volume = 0.5;
    audio.play().catch(() => {});

    // Confete
    const duration = 3000;
    const animationEnd = Date.now() + duration;

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      confetti({
        particleCount: 50 * (timeLeft / duration),
        startVelocity: 30,
        spread: 360,
        origin: { x: Math.random(), y: Math.random() - 0.2 },
        colors: ['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#9370DB', '#32CD32'],
        zIndex: 9999
      });
    }, 250);

    // Explosão inicial
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#9370DB', '#32CD32'],
      zIndex: 9999
    });
  }, []);

  return { celebrate };
}

export default CelebrationEffect;
