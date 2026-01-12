# Sistema de Bloqueio Gamificado de Follow-ups

**Autor:** Manus AI  
**Data:** 12 de janeiro de 2026  
**Versão do Sistema:** Checkpoint a7e22434 (último com bloqueio ativo)  
**Status:** Documentação para reimplementação futura

---

## Visão Geral

O sistema de bloqueio gamificado de follow-ups foi projetado para incentivar corretores a completarem suas tarefas diárias de acompanhamento de leads antes de acessarem outras funcionalidades do CRM. O mecanismo implementa uma estratégia de **gamificação progressiva** que bloqueia o acesso a abas específicas até que o corretor atinja uma meta mínima de 60% de conclusão dos follow-ups programados para o dia.

Este documento apresenta uma especificação técnica completa do sistema, incluindo lógica de backend, componentes visuais, fluxo de dados e código-fonte para restauração futura. A análise foi realizada com base no checkpoint **a7e22434**, que representa a última versão estável do sistema antes da desativação emergencial.

---

## Arquitetura do Sistema

O sistema de bloqueio é composto por três camadas principais que trabalham de forma integrada para criar uma experiência de usuário coesa e responsiva.

### Camada de Backend (Lógica de Negócio)

A lógica central do sistema reside no arquivo `server/routers.ts`, especificamente na procedure **`progressoFollowUps.getProgresso`**. Esta procedure é responsável por calcular o progresso diário de follow-ups de cada corretor e determinar se o sistema deve permanecer bloqueado ou desbloqueado.

O cálculo do progresso segue uma estratégia de **persistência de desbloqueio**, onde um corretor que atinge a meta de 60% permanece desbloqueado pelo resto do dia, mesmo que o percentual caia posteriormente devido à criação de novos follow-ups. Esta abordagem foi implementada para evitar frustração do usuário e garantir que o esforço inicial seja recompensado de forma permanente.

A função auxiliar **`getTotalFollowUpsDoDia`** (localizada em `server/db.ts`) é invocada para buscar todos os follow-ups ativos do corretor que estão programados para o dia atual. Esta função implementa uma lógica sofisticada que considera tanto follow-ups ainda não trabalhados quanto aqueles já concluídos no dia, garantindo que o contador total permaneça estável durante o período de 24 horas.

### Camada de Frontend (Interface e Experiência)

A interface do usuário é gerenciada pelo componente **`DashboardLayout.tsx`**, que integra múltiplos elementos visuais para criar uma experiência de bloqueio coerente e informativa. O hook customizado **`useFollowUpProgress`** centraliza a lógica de consulta e atualização de progresso, fornecendo dados em tempo real para todos os componentes que necessitam desta informação.

O componente **`LockedTabOverlay.tsx`** implementa o overlay visual de bloqueio que é exibido quando o corretor tenta acessar uma aba restrita sem ter atingido a meta mínima. Este componente apresenta informações claras sobre o progresso atual e oferece um caminho direto para a página de "Tarefas do Dia", onde o corretor pode completar seus follow-ups pendentes.

### Camada de Celebração (Feedback Positivo)

O módulo de celebração (`client/src/lib/celebration.ts`) implementa efeitos visuais e sonoros que são acionados automaticamente quando o corretor atinge a meta de 60%. Esta camada utiliza a biblioteca **canvas-confetti** para criar animações de confete e gera sons de vitória através da Web Audio API, proporcionando um feedback imediato e gratificante que reforça o comportamento desejado.

---

## Lógica de Backend Detalhada

### Procedure: `progressoFollowUps.getProgresso`

A procedure principal do sistema implementa um algoritmo de cálculo de progresso com persistência de desbloqueio. O fluxo de execução pode ser descrito da seguinte forma:

**Etapa 1: Inicialização de Timezone**

O sistema utiliza o timezone de São Paulo (GMT-3) como referência padrão para todos os cálculos de data e hora. A função `inicioDoDiaHoje()` retorna um objeto Date representando a meia-noite do dia atual no timezone configurado, garantindo consistência em todos os cálculos temporais.

```typescript
const { inicioDoDiaHoje } = await import('./timezone');
const hoje = inicioDoDiaHoje();
const amanha = new Date(hoje);
amanha.setDate(amanha.getDate() + 1);
```

**Etapa 2: Verificação de Desbloqueio Prévio**

Antes de calcular o progresso atual, o sistema verifica se o corretor já desbloqueou o sistema anteriormente no mesmo dia. Esta verificação é realizada consultando o campo `ultimoDesbloqueio` na tabela de usuários.

```typescript
const usuario = await db.getUserById(ctx.user.id);
const ultimoDesbloqueio = usuario?.ultimoDesbloqueio;
const jaDesbloqueouHoje = ultimoDesbloqueio && 
  new Date(ultimoDesbloqueio) >= hoje && 
  new Date(ultimoDesbloqueio) < amanha;
```

Se `jaDesbloqueouHoje` for verdadeiro, o sistema retorna imediatamente `desbloqueado: true`, independente do percentual atual. Esta é a implementação da **persistência de desbloqueio**, que garante que o corretor não seja penalizado por novos follow-ups criados após atingir a meta.

**Etapa 3: Cálculo do Total de Follow-ups**

A função `getTotalFollowUpsDoDia` é invocada para buscar todos os follow-ups relevantes do dia. Esta função implementa uma lógica complexa que considera:

1. **Follow-ups ainda não trabalhados**: Aqueles cuja `proximaTentativa` é menor ou igual ao dia atual
2. **Follow-ups já concluídos hoje**: Aqueles cuja `ultimaTentativa` foi registrada no dia atual

A query SQL utiliza uma cláusula `OR` para capturar ambos os casos:

```typescript
return await db.select({...})
  .from(followUps)
  .where(and(
    eq(followUps.corretorId, corretorId),
    eq(followUps.status, "ativo"),
    or(
      lte(followUps.proximaTentativa, amanha),
      and(
        gte(followUps.ultimaTentativa, hoje),
        lt(followUps.ultimaTentativa, amanha)
      )
    )
  ));
```

**Etapa 4: Contagem de Follow-ups Concluídos**

Os follow-ups concluídos são identificados através da presença de um timestamp `ultimaTentativa` dentro do intervalo do dia atual. O sistema aplica um filtro em memória sobre os resultados da query:

```typescript
const concluidos = totalFollowUps.filter(f => {
  if (!f.ultimaTentativa) return false;
  const ultimaTentativaDate = new Date(f.ultimaTentativa);
  return ultimaTentativaDate >= hoje && ultimaTentativaDate < amanha;
}).length;
```

**Etapa 5: Cálculo do Percentual e Determinação de Bloqueio**

O percentual de conclusão é calculado através de uma divisão simples, com tratamento especial para o caso onde não há follow-ups (retorna 100%):

```typescript
const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 100;
const desbloqueado = percentual >= 60;
```

**Etapa 6: Registro de Desbloqueio**

Se o corretor acabou de atingir a meta (60% ou mais) e ainda não havia desbloqueado anteriormente no dia, o sistema registra o timestamp atual no campo `ultimoDesbloqueio`:

```typescript
if (desbloqueado && !jaDesbloqueouHoje) {
  await db.updateUser(ctx.user.id, { ultimoDesbloqueio: new Date() });
}
```

Este registro é crucial para implementar a persistência de desbloqueio nas próximas consultas.

### Tabela: Estrutura de Retorno da Procedure

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `total` | number | Número total de follow-ups do dia | 10 |
| `concluidos` | number | Número de follow-ups com tentativa registrada hoje | 6 |
| `percentual` | number | Percentual de conclusão (0-100) | 60 |
| `desbloqueado` | boolean | Se o sistema está desbloqueado (≥60% ou desbloqueio prévio) | true |

---

## Componentes Visuais e Efeitos

### Hook: `useFollowUpProgress`

O hook customizado `useFollowUpProgress` é o ponto central de integração entre backend e frontend. Ele implementa as seguintes funcionalidades:

**Polling Automático**

O hook configura um intervalo de atualização de 10 segundos através da opção `refetchInterval` do tRPC, garantindo que o progresso seja atualizado automaticamente sem intervenção do usuário:

```typescript
const { data, isLoading, refetch } = trpc.progressoFollowUps.getProgresso.useQuery(
  undefined,
  {
    enabled: shouldFetchProgress,
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  }
);
```

**Detecção de Desbloqueio para Celebração**

O hook utiliza `useRef` e `useEffect` para detectar a transição de estado bloqueado para desbloqueado, acionando a celebração apenas uma vez:

```typescript
const previousDesbloqueado = useRef<boolean>(false);
const celebrationShown = useRef<boolean>(false);

useEffect(() => {
  const desbloqueado = data?.desbloqueado ?? false;
  
  if (!previousDesbloqueado.current && desbloqueado && !celebrationShown.current) {
    celebrate();
    celebrationShown.current = true;
  }
  
  previousDesbloqueado.current = desbloqueado;
}, [data?.desbloqueado]);
```

**Animação +1 no Progresso**

Quando o número de follow-ups concluídos aumenta, o hook aciona uma animação visual "+1" que aparece brevemente no indicador de progresso:

```typescript
const previousConcluidos = useRef<number>(0);
const [showPlusOne, setShowPlusOne] = useState(false);

useEffect(() => {
  const concluidos = data?.concluidos ?? 0;
  
  if (concluidos > previousConcluidos.current && previousConcluidos.current >= 0) {
    setShowPlusOne(true);
    setTimeout(() => setShowPlusOne(false), 1500);
  }
  
  previousConcluidos.current = concluidos;
}, [data?.concluidos]);
```

**Tratamento de Roles Diferentes**

O hook implementa lógica diferenciada para gestores e corretores. Gestores visualizam o indicador de progresso mas nunca são bloqueados, enquanto outros roles (como admin) não visualizam o indicador:

```typescript
const isCorretor = user?.role === 'corretor';
const isGestor = user?.role === 'gestor';
const shouldFetchProgress = isCorretor || isGestor;

if (!shouldFetchProgress) {
  return {
    total: 0,
    concluidos: 0,
    percentual: 100,
    desbloqueado: true,
    isLoading: false,
    refetch,
    showPlusOne: false,
  };
}
```

### Componente: `DashboardLayout` - Indicador de Progresso

O componente `DashboardLayout` integra o indicador de progresso no header da aplicação, visível apenas para corretores e gestores. O indicador apresenta três elementos visuais principais:

**Contador Numérico com Código de Cores**

O contador exibe a fração de follow-ups concluídos sobre o total, com cores que indicam o estado atual:

```typescript
<span className={`font-bold ${desbloqueado ? 'text-green-600' : 'text-red-600'}`}>
  {concluidos}/{total}
</span>
<span className={`text-xs font-semibold ${desbloqueado ? 'text-green-600' : 'text-red-600'}`}>
  ({percentual}%)
</span>
```

**Animação +1 Flutuante**

Quando `showPlusOne` é verdadeiro, uma animação CSS é acionada para exibir "+1" acima do contador:

```typescript
{showPlusOne && (
  <span 
    className="absolute -top-6 left-1/2 -translate-x-1/2 text-green-600 font-bold text-lg animate-[slideUp_1.5s_ease-out_forwards] pointer-events-none"
    style={{
      animation: 'slideUp 1.5s ease-out forwards',
    }}
  >
    +1
  </span>
)}
```

**Barra de Progresso Horizontal**

Uma barra de progresso visual complementa o contador numérico, preenchendo-se gradualmente conforme os follow-ups são concluídos:

```typescript
<div className="h-2 bg-muted rounded-full overflow-hidden">
  <div 
    className={`h-full transition-all duration-500 ${desbloqueado ? 'bg-green-500' : 'bg-red-500'}`}
    style={{ width: `${Math.min(percentual, 100)}%` }}
  />
</div>
```

### Componente: `DashboardLayout` - Indicadores no Menu Lateral

O menu lateral exibe alertas visuais nas abas bloqueadas através de badges animados e mudanças de cor no texto:

**Badge Pulsante Vermelho**

Abas bloqueadas exibem um badge vermelho com animação de pulso:

```typescript
{(item as any).showAlert && !desbloqueado && (
  <span className="absolute -top-1 -right-1 flex h-3 w-3">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
  </span>
)}
```

**Texto em Vermelho**

O label da aba também muda para vermelho e negrito quando bloqueada:

```typescript
<span className={!desbloqueado && (item as any).showAlert ? "font-semibold text-red-600" : ""}>
  {item.label}
</span>
```

### Componente: `LockedTabOverlay`

O overlay de bloqueio é o elemento visual mais proeminente do sistema. Ele é renderizado como um modal em tela cheia que impede interação com o conteúdo subjacente:

**Estrutura Visual**

O overlay apresenta uma estrutura hierárquica clara com ícone de cadeado, título, descrição, barra de progresso e botão de ação:

```typescript
<div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
  <div className="max-w-md space-y-6 rounded-lg border-2 border-red-500 bg-card p-8 shadow-2xl">
    {/* Ícone de cadeado */}
    <div className="flex justify-center">
      <div className="rounded-full bg-red-100 p-4">
        <Lock className="h-12 w-12 text-red-600" />
      </div>
    </div>
    
    {/* Título e descrição */}
    <div className="space-y-2 text-center">
      <h2 className="text-2xl font-bold text-foreground">
        Complete seus Follow-ups
      </h2>
      <p className="text-muted-foreground">
        Você precisa concluir <span className="font-semibold text-red-600">{faltam} follow-up{faltam !== 1 ? 's' : ''}</span> para desbloquear esta aba
      </p>
    </div>
    
    {/* Barra de progresso */}
    <div className="space-y-3">
      <Progress value={percentual} className="h-3" />
      <p className="text-center text-xs text-muted-foreground">
        Meta: 60% dos follow-ups concluídos
      </p>
    </div>
    
    {/* Botão de ação */}
    <Button onClick={() => setLocation("/tarefas-do-dia")} className="w-full" size="lg">
      Ir para Tarefas do Dia
    </Button>
  </div>
</div>
```

**Cálculo de Follow-ups Faltantes**

O overlay calcula dinamicamente quantos follow-ups ainda são necessários para atingir a meta:

```typescript
const faltam = Math.ceil(total * 0.6) - concluidos;
```

**Condição de Renderização**

O overlay só é renderizado quando três condições são satisfeitas simultaneamente:

```typescript
{isCorretor && !desbloqueado && location !== "/tarefas-do-dia" && (
  <LockedTabOverlay total={total} concluidos={concluidos} percentual={percentual} />
)}
```

Esta lógica garante que:
1. Apenas corretores vejam o bloqueio (gestores nunca são bloqueados)
2. O overlay não apareça quando o sistema está desbloqueado
3. A página "Tarefas do Dia" permaneça sempre acessível

### Módulo: `celebration.ts`

O módulo de celebração implementa três funções principais que trabalham em conjunto para criar uma experiência de feedback positivo memorável:

**Função: `playConfetti()`**

Gera animações de confete utilizando a biblioteca canvas-confetti. A animação dura 3 segundos e dispara confetes de múltiplos pontos da tela:

```typescript
export function playConfetti() {
  const duration = 3000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

  const interval = setInterval(function() {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) return clearInterval(interval);

    const particleCount = 50 * (timeLeft / duration);
    
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
    });
    
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
    });
  }, 250);
}
```

**Função: `playVictorySound()`**

Gera um som de vitória através da Web Audio API, tocando uma melodia ascendente de três notas (C5, E5, G5):

```typescript
export function playVictorySound() {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
}
```

**Função: `celebrate()`**

Orquestra a celebração completa combinando confete, som e notificação toast:

```typescript
export function celebrate() {
  playConfetti();
  playVictorySound();
  
  toast.success('🎉 Parabéns! Sistema desbloqueado!', {
    description: 'Você atingiu a meta de 60% dos follow-ups. Continue assim!',
    duration: 5000,
    className: 'text-lg font-bold',
  });
}
```

---

## Fluxo de Dados Completo

O sistema de bloqueio implementa um fluxo de dados unidirecional que pode ser descrito através das seguintes etapas sequenciais:

**1. Inicialização do Componente**

Quando o `DashboardLayout` é montado, o hook `useFollowUpProgress` é inicializado e verifica o role do usuário. Se o usuário for corretor ou gestor, uma query tRPC é disparada para buscar o progresso atual.

**2. Consulta ao Backend**

A query tRPC invoca a procedure `progressoFollowUps.getProgresso`, que executa a lógica de cálculo descrita anteriormente. O resultado é serializado através do Superjson (preservando tipos Date) e retornado ao cliente.

**3. Atualização do Estado Frontend**

O hook recebe os dados e atualiza seu estado interno. Se detectar uma transição de bloqueado para desbloqueado, aciona a função `celebrate()`. Se detectar aumento no número de concluídos, ativa a flag `showPlusOne`.

**4. Renderização Condicional**

O `DashboardLayout` utiliza os valores retornados pelo hook para renderizar condicionalmente:
- Cores do indicador de progresso (verde/vermelho)
- Badges de alerta no menu lateral
- Overlay de bloqueio nas abas restritas

**5. Interação do Usuário**

Quando o corretor completa um follow-up na página "Tarefas do Dia", o sistema registra a `ultimaTentativa` no banco de dados. Na próxima atualização automática (máximo 10 segundos), o progresso é recalculado e a interface atualizada.

**6. Desbloqueio e Celebração**

Quando o percentual atinge ou ultrapassa 60%, o backend registra o timestamp de desbloqueio e retorna `desbloqueado: true`. O frontend detecta esta mudança, remove o overlay de bloqueio, atualiza as cores para verde e dispara a celebração completa.

**7. Persistência Durante o Dia**

Nas consultas subsequentes, o backend detecta que já houve desbloqueio no dia atual e retorna imediatamente `desbloqueado: true`, independente do percentual atual. Esta persistência garante que o corretor não seja penalizado por novos follow-ups criados após atingir a meta.

### Diagrama de Fluxo Simplificado

```
[Corretor acessa sistema]
         ↓
[useFollowUpProgress inicializa]
         ↓
[Query tRPC: progressoFollowUps.getProgresso]
         ↓
[Backend: Verifica desbloqueio prévio]
         ↓
    [Sim] → [Retorna desbloqueado=true]
         ↓
    [Não] → [Calcula progresso atual]
         ↓
         [percentual >= 60%?]
              ↓
         [Sim] → [Registra desbloqueio] → [Retorna desbloqueado=true]
              ↓
         [Não] → [Retorna desbloqueado=false]
         ↓
[Frontend atualiza interface]
         ↓
    [desbloqueado=true] → [Remove overlay, cores verdes, celebração]
         ↓
    [desbloqueado=false] → [Exibe overlay, cores vermelhas, badges]
         ↓
[Polling automático a cada 10s]
```

---

## Código-Fonte para Restauração

Esta seção apresenta os trechos de código exatos que devem ser restaurados para reativar o sistema de bloqueio. Todos os códigos foram extraídos do checkpoint **a7e22434**.

### Arquivo: `server/routers.ts`

**Localização:** Procedure `progressoFollowUps.getProgresso` (aproximadamente linha 2056)

**Código a ser restaurado:**

```typescript
// Calcular progresso de follow-ups do dia (para bloqueio gamificado)
getProgresso: corretorProcedure
  .query(async ({ ctx }) => {
    const { inicioDoDiaHoje } = await import('./timezone');
    const hoje = inicioDoDiaHoje();
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    
    // Verificar se já desbloqueou hoje (persistência de desbloqueio)
    const usuario = await db.getUserById(ctx.user.id);
    const ultimoDesbloqueio = usuario?.ultimoDesbloqueio;
    const jaDesbloqueouHoje = ultimoDesbloqueio && 
      new Date(ultimoDesbloqueio) >= hoje && 
      new Date(ultimoDesbloqueio) < amanha;
    
    // Se já desbloqueou hoje, retornar desbloqueado independente do percentual atual
    if (jaDesbloqueouHoje) {
      const totalFollowUps = await db.getTotalFollowUpsDoDia(ctx.user.id, hoje, amanha);
      const total = totalFollowUps.length;
      const concluidos = totalFollowUps.filter(f => {
        if (!f.ultimaTentativa) return false;
        const ultimaTentativaDate = new Date(f.ultimaTentativa);
        return ultimaTentativaDate >= hoje && ultimaTentativaDate < amanha;
      }).length;
      const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 100;
      
      return {
        total,
        concluidos,
        percentual,
        desbloqueado: true, // Forçar desbloqueado se já desbloqueou hoje
      };
    }
    
    // TOTAL FIXO: Contar TODOS os follow-ups que tinham proximaTentativa <= hoje
    const totalFollowUps = await db.getTotalFollowUpsDoDia(ctx.user.id, hoje, amanha);
    const total = totalFollowUps.length;
    
    // CONCLUÍDOS: Contar follow-ups que tiveram ultimaTentativa atualizada HOJE
    const concluidos = totalFollowUps.filter(f => {
      if (!f.ultimaTentativa) return false;
      const ultimaTentativaDate = new Date(f.ultimaTentativa);
      return ultimaTentativaDate >= hoje && ultimaTentativaDate < amanha;
    }).length;
    
    const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 100;
    const desbloqueado = percentual >= 60;
    
    // Se acabou de desbloquear (>=60%), registrar timestamp
    if (desbloqueado && !jaDesbloqueouHoje) {
      await db.updateUser(ctx.user.id, { ultimoDesbloqueio: new Date() });
    }
    
    return {
      total,
      concluidos,
      percentual,
      desbloqueado,
    };
  }),
```

**Código atual (desativado):**

```typescript
// Calcular progresso de follow-ups do dia (BLOQUEIO DESATIVADO - SEMPRE DESBLOQUEADO)
getProgresso: corretorProcedure
  .query(async ({ ctx }) => {
    const { inicioDoDiaHoje } = await import('./timezone');
    const hoje = inicioDoDiaHoje();
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    
    // BLOQUEIO DESATIVADO: Calcular métricas apenas para exibição
    const totalFollowUps = await db.getTotalFollowUpsDoDia(ctx.user.id, hoje, amanha);
    const total = totalFollowUps.length;
    
    const concluidos = totalFollowUps.filter(f => {
      if (!f.ultimaTentativa) return false;
      const ultimaTentativaDate = new Date(f.ultimaTentativa);
      return ultimaTentativaDate >= hoje && ultimaTentativaDate < amanha;
    }).length;
    
    const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 100;
    
    // SEMPRE RETORNAR DESBLOQUEADO=TRUE (bloqueio desativado)
    return {
      total,
      concluidos,
      percentual,
      desbloqueado: true, // 🔓 BLOQUEIO DESATIVADO - SEMPRE DESBLOQUEADO
    };
  }),
```

### Instruções de Restauração

Para reativar o sistema de bloqueio, siga os seguintes passos:

1. **Abrir o arquivo** `server/routers.ts`
2. **Localizar** a procedure `progressoFollowUps.getProgresso` (buscar por "BLOQUEIO DESATIVADO")
3. **Substituir** todo o conteúdo da query pela versão "Código a ser restaurado" apresentada acima
4. **Salvar** o arquivo
5. **Reiniciar** o servidor de desenvolvimento com `webdev_restart_server`
6. **Testar** o sistema com uma conta de corretor

**Observação importante:** Não há necessidade de modificar outros arquivos. Os componentes visuais (`LockedTabOverlay.tsx`, `DashboardLayout.tsx`, `useFollowUpProgress.ts`, `celebration.ts`) já estão implementados e funcionais. A única mudança necessária é restaurar a lógica de backend que calcula o bloqueio corretamente.

---

## Considerações de Design e UX

O sistema de bloqueio foi projetado com atenção especial à experiência do usuário, implementando diversas estratégias para minimizar frustração e maximizar engajamento.

### Persistência de Desbloqueio

A decisão de implementar persistência de desbloqueio diário foi motivada por cenários onde novos follow-ups são criados após o corretor atingir a meta. Sem esta funcionalidade, um corretor que completasse 60% dos follow-ups às 9h da manhã poderia ser bloqueado novamente às 10h se novos leads fossem distribuídos. Esta experiência seria extremamente frustrante e desmotivadora.

A persistência garante que o esforço inicial seja recompensado de forma permanente durante o dia, incentivando o corretor a começar o dia completando suas tarefas prioritárias sem medo de penalizações posteriores.

### Exceção para "Tarefas do Dia"

A página "Tarefas do Dia" permanece sempre acessível, mesmo quando o sistema está bloqueado. Esta decisão é fundamental para evitar um paradoxo de bloqueio: o corretor precisa acessar a página de tarefas para completar follow-ups, mas não pode acessá-la porque está bloqueado.

A implementação verifica explicitamente a rota atual antes de renderizar o overlay:

```typescript
{isCorretor && !desbloqueado && location !== "/tarefas-do-dia" && (
  <LockedTabOverlay ... />
)}
```

### Feedback Visual Progressivo

O sistema implementa múltiplas camadas de feedback visual que aumentam em intensidade conforme o corretor se aproxima do bloqueio:

1. **Indicador no header**: Sempre visível, muda de cor (vermelho/verde) baseado no estado
2. **Badges no menu lateral**: Alertas visuais pulsantes nas abas bloqueadas
3. **Overlay em tela cheia**: Bloqueio físico que impede acesso ao conteúdo

Esta progressão garante que o corretor sempre tenha consciência do seu progresso sem ser excessivamente intrusivo.

### Celebração como Reforço Positivo

A celebração automática quando a meta é atingida implementa princípios de **gamificação** e **condicionamento operante**. O feedback imediato e gratificante (confete + som + notificação) cria uma associação positiva com o comportamento desejado, incentivando o corretor a repetir o padrão nos dias seguintes.

A celebração é acionada apenas uma vez por dia para evitar saturação e manter o efeito especial da conquista.

---

## Métricas e Parâmetros Configuráveis

O sistema utiliza alguns valores fixos que podem ser ajustados conforme necessário:

### Tabela de Parâmetros

| Parâmetro | Valor Atual | Localização | Descrição |
|-----------|-------------|-------------|-----------|
| Meta de desbloqueio | 60% | `server/routers.ts` linha ~2074 | Percentual mínimo para desbloquear |
| Intervalo de polling | 10000ms | `useFollowUpProgress.ts` linha 27 | Frequência de atualização automática |
| Duração da animação +1 | 1500ms | `useFollowUpProgress.ts` linha 54 | Tempo de exibição da animação |
| Duração do confete | 3000ms | `celebration.ts` linha 8 | Duração da animação de confete |
| Duração da notificação | 5000ms | `celebration.ts` linha 85 | Tempo de exibição do toast |

### Ajustes Recomendados

Para ajustar a meta de desbloqueio, modificar a linha:

```typescript
const desbloqueado = percentual >= 60; // Alterar 60 para o valor desejado
```

Para ajustar o intervalo de atualização, modificar a linha:

```typescript
refetchInterval: 10000, // Alterar 10000 para o valor desejado em milissegundos
```

---

## Limitações e Considerações Técnicas

O sistema atual apresenta algumas limitações que devem ser consideradas:

**Dependência de Polling**

O sistema utiliza polling a cada 10 segundos para atualizar o progresso. Em ambientes com muitos usuários simultâneos, esta abordagem pode gerar carga desnecessária no servidor. Uma implementação futura poderia utilizar WebSockets ou Server-Sent Events para atualizações em tempo real mais eficientes.

**Cálculo em Memória**

A filtragem de follow-ups concluídos é realizada em memória após a query SQL. Para corretores com centenas de follow-ups, esta abordagem pode ser ineficiente. Uma otimização futura poderia mover este cálculo para uma query SQL com agregação.

**Timezone Fixo**

O sistema utiliza o timezone de São Paulo (GMT-3) como padrão fixo. Para operações em múltiplos fusos horários, seria necessário implementar detecção automática de timezone ou permitir configuração por usuário.

**Sem Configuração por Gestor**

A meta de 60% está hardcoded no código. Uma melhoria futura seria permitir que gestores configurem este valor através de uma interface administrativa, possibilitando ajustes baseados em feedback da equipe.

---

## Conclusão

O sistema de bloqueio gamificado de follow-ups representa uma implementação sofisticada de princípios de gamificação aplicados a um CRM imobiliário. A arquitetura combina lógica de backend robusta com componentes visuais polidos para criar uma experiência que incentiva produtividade sem ser excessivamente punitiva.

A decisão de desativar temporariamente o sistema foi necessária para resolver um bloqueio operacional crítico, mas a documentação completa apresentada neste documento garante que a funcionalidade possa ser restaurada rapidamente quando apropriado. Todos os componentes visuais permanecem intactos e funcionais, sendo necessário apenas restaurar a lógica de backend descrita na seção "Código-Fonte para Restauração".

Para reimplementação futura, recomenda-se:

1. Restaurar o código exato da procedure `progressoFollowUps.getProgresso` conforme documentado
2. Testar extensivamente com múltiplos corretores em diferentes cenários
3. Monitorar métricas de engajamento para validar eficácia do sistema
4. Considerar implementação de configuração dinâmica da meta de desbloqueio
5. Avaliar migração de polling para WebSockets para melhor performance

Este documento serve como especificação técnica completa e guia de reimplementação, preservando todo o conhecimento necessário para restaurar e evoluir o sistema de bloqueio gamificado.

---

**Documento gerado em:** 12 de janeiro de 2026  
**Checkpoint de referência:** a7e22434  
**Status do sistema:** Bloqueio desativado (checkpoint 14993c1f)  
**Próxima ação recomendada:** Aguardar aprovação para reimplementação
