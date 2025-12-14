import { useCallback, useRef } from 'react';

// Create audio context lazily to avoid issues with autoplay policies
let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// Generate sounds programmatically for better performance and no external dependencies
const playTone = (frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) => {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio context might not be available
  }
};

const playNoise = (duration: number, volume: number = 0.1) => {
  try {
    const ctx = getAudioContext();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    
    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    source.start(ctx.currentTime);
  } catch (e) {
    // Audio context might not be available
  }
};

export const useSoundEffects = () => {
  const lastPlayedRef = useRef<Record<string, number>>({});
  
  const throttleSound = useCallback((key: string, minInterval: number = 50) => {
    const now = Date.now();
    if (lastPlayedRef.current[key] && now - lastPlayedRef.current[key] < minInterval) {
      return false;
    }
    lastPlayedRef.current[key] = now;
    return true;
  }, []);

  // Win sound - triumphant ascending tones
  const playWin = useCallback(() => {
    if (!throttleSound('win', 200)) return;
    setTimeout(() => playTone(523, 0.15, 'sine', 0.25), 0);    // C5
    setTimeout(() => playTone(659, 0.15, 'sine', 0.25), 100);  // E5
    setTimeout(() => playTone(784, 0.15, 'sine', 0.25), 200);  // G5
    setTimeout(() => playTone(1047, 0.3, 'sine', 0.3), 300);   // C6
  }, [throttleSound]);

  // Big win sound - more elaborate
  const playBigWin = useCallback(() => {
    if (!throttleSound('bigwin', 300)) return;
    setTimeout(() => playTone(523, 0.1, 'sine', 0.3), 0);
    setTimeout(() => playTone(659, 0.1, 'sine', 0.3), 80);
    setTimeout(() => playTone(784, 0.1, 'sine', 0.3), 160);
    setTimeout(() => playTone(1047, 0.15, 'sine', 0.35), 240);
    setTimeout(() => playTone(1319, 0.15, 'sine', 0.35), 340);
    setTimeout(() => playTone(1568, 0.3, 'sine', 0.4), 440);
  }, [throttleSound]);

  // Lose sound - descending minor tone
  const playLose = useCallback(() => {
    if (!throttleSound('lose', 200)) return;
    setTimeout(() => playTone(400, 0.2, 'sawtooth', 0.15), 0);
    setTimeout(() => playTone(300, 0.3, 'sawtooth', 0.12), 150);
  }, [throttleSound]);

  // Spin/roll sound - mechanical whirring
  const playSpin = useCallback(() => {
    if (!throttleSound('spin', 100)) return;
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        playTone(200 + Math.random() * 100, 0.05, 'square', 0.08);
      }, i * 30);
    }
  }, [throttleSound]);

  // Slot reel stop sound
  const playReelStop = useCallback(() => {
    if (!throttleSound('reelstop', 50)) return;
    playTone(150, 0.08, 'square', 0.15);
    playNoise(0.05, 0.1);
  }, [throttleSound]);

  // Card deal/flip sound
  const playCardDeal = useCallback(() => {
    if (!throttleSound('card', 80)) return;
    playNoise(0.06, 0.15);
    playTone(800, 0.04, 'sine', 0.1);
  }, [throttleSound]);

  // Chip/bet placed sound
  const playChip = useCallback(() => {
    if (!throttleSound('chip', 50)) return;
    playTone(600, 0.05, 'sine', 0.2);
    playTone(1200, 0.03, 'sine', 0.15);
  }, [throttleSound]);

  // Button click sound
  const playClick = useCallback(() => {
    if (!throttleSound('click', 30)) return;
    playTone(800, 0.03, 'sine', 0.15);
  }, [throttleSound]);

  // Ball bounce (Plinko)
  const playBounce = useCallback(() => {
    if (!throttleSound('bounce', 20)) return;
    const freq = 300 + Math.random() * 400;
    playTone(freq, 0.04, 'sine', 0.12);
  }, [throttleSound]);

  // Ball drop sound
  const playDrop = useCallback(() => {
    if (!throttleSound('drop', 100)) return;
    playTone(200, 0.1, 'sine', 0.2);
  }, [throttleSound]);

  // Tile reveal (Mines)
  const playReveal = useCallback(() => {
    if (!throttleSound('reveal', 50)) return;
    playTone(880, 0.08, 'sine', 0.2);
    setTimeout(() => playTone(1100, 0.06, 'sine', 0.15), 50);
  }, [throttleSound]);

  // Mine explosion
  const playExplosion = useCallback(() => {
    if (!throttleSound('explosion', 200)) return;
    playNoise(0.3, 0.25);
    playTone(100, 0.3, 'sawtooth', 0.2);
    setTimeout(() => playTone(60, 0.2, 'sawtooth', 0.15), 100);
  }, [throttleSound]);

  // Roulette ball
  const playRouletteBall = useCallback(() => {
    if (!throttleSound('roulette', 30)) return;
    const freq = 500 + Math.random() * 300;
    playTone(freq, 0.03, 'sine', 0.1);
  }, [throttleSound]);

  // Cash out sound
  const playCashout = useCallback(() => {
    if (!throttleSound('cashout', 200)) return;
    playTone(440, 0.1, 'sine', 0.25);
    setTimeout(() => playTone(554, 0.1, 'sine', 0.25), 80);
    setTimeout(() => playTone(659, 0.15, 'sine', 0.3), 160);
  }, [throttleSound]);

  return {
    playWin,
    playBigWin,
    playLose,
    playSpin,
    playReelStop,
    playCardDeal,
    playChip,
    playClick,
    playBounce,
    playDrop,
    playReveal,
    playExplosion,
    playRouletteBall,
    playCashout,
  };
};
