import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";

const modulePath = path.resolve(__dirname, "../client/src/lib/timerSound.ts");

// Mock da Web Audio API
const mockOscillator = {
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  type: "sine",
  frequency: { setValueAtTime: vi.fn() },
};

const mockGainNode = {
  connect: vi.fn(),
  gain: {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  },
};

const mockAudioContext = {
  state: "running",
  currentTime: 0,
  destination: {},
  resume: vi.fn().mockResolvedValue(undefined),
  createOscillator: vi.fn().mockReturnValue(mockOscillator),
  createGain: vi.fn().mockReturnValue(mockGainNode),
};

vi.stubGlobal("AudioContext", vi.fn().mockImplementation(() => mockAudioContext));
vi.stubGlobal("window", { AudioContext: vi.fn().mockImplementation(() => mockAudioContext) });

beforeEach(() => {
  vi.clearAllMocks();
  // Resetar o módulo para limpar o audioCtx singleton entre testes
  vi.resetModules();
});

describe("timerSound", () => {
  it("playAlertaUrgencia cria 3 osciladores (3 beeps)", async () => {
    const { playAlertaUrgencia } = await import(modulePath);
    playAlertaUrgencia();
    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(3);
  });

  it("playLembrete cria 1 oscilador (1 beep)", async () => {
    const { playLembrete } = await import(modulePath);
    playLembrete();
    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(1);
  });

  it("playAlertaExpiracao cria 5 osciladores (5 beeps)", async () => {
    const { playAlertaExpiracao } = await import(modulePath);
    playAlertaExpiracao();
    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(5);
  });

  it("initAudio inicializa o AudioContext (cria oscilador após init)", async () => {
    const { initAudio, playLembrete } = await import(modulePath);
    // initAudio prepara o contexto; playLembrete confirma que ele está pronto
    initAudio();
    playLembrete();
    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(1);
  });

  it("osciladores são conectados ao gainNode e ao destination", async () => {
    const { playLembrete } = await import(modulePath);
    playLembrete();
    expect(mockOscillator.connect).toHaveBeenCalledWith(mockGainNode);
    expect(mockGainNode.connect).toHaveBeenCalledWith(mockAudioContext.destination);
  });

  it("start e stop são chamados em cada oscilador", async () => {
    const { playAlertaUrgencia } = await import(modulePath);
    playAlertaUrgencia();
    expect(mockOscillator.start).toHaveBeenCalledTimes(3);
    expect(mockOscillator.stop).toHaveBeenCalledTimes(3);
  });
});
