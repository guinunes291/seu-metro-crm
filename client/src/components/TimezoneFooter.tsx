import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export function TimezoneFooter() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Formatar horário de São Paulo
  const timeString = currentTime.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const dateString = currentTime.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:left-64">
      <div className="flex items-center justify-center gap-3 px-4 py-2 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <div className="flex items-center gap-2">
          <span className="font-medium">{timeString}</span>
          <span className="text-muted-foreground/60">•</span>
          <span className="capitalize">{dateString}</span>
          <span className="text-muted-foreground/60">•</span>
          <span className="font-semibold text-primary">São Paulo (GMT-3)</span>
        </div>
      </div>
    </footer>
  );
}
