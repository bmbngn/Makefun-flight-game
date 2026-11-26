// Sound, synthesised live with WebAudio: no audio files to ship, and the
// engine's voice follows the throttle. Everything starts on a user gesture,
// because browsers will not let audio start before one.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineFilter = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    started = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);

      // Engine: a sawtooth and a sub sine through a low-pass, pitched by throttle.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sine';
      engineOsc2.frequency.value = 28;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();

      // Wind: looped white noise through a band-pass, louder when fast.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      windSource = ctx.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSource.start();
    } catch {
      ctx = null;
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  function setEngine(throttle, speedNorm) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    engineOsc.frequency.setTargetAtTime(52 + throttle * 66 + speedNorm * 12, t, 0.08);
    engineOsc2.frequency.setTargetAtTime(26 + throttle * 30, t, 0.08);
    engineFilter.frequency.setTargetAtTime(320 + throttle * 900, t, 0.1);
    engineGain.gain.setTargetAtTime(0.05 + throttle * 0.11, t, 0.1);
    windGain.gain.setTargetAtTime(speedNorm * speedNorm * 0.12, t, 0.15);
    windFilter.frequency.setTargetAtTime(380 + speedNorm * 700, t, 0.15);
  }

  function chime() {
    if (!ctx || muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.07;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.55);
    });
  }

  function thud(hard) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hard ? 90 : 60, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.35);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(hard ? 0.5 : 0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.5;
  }
  function isMuted() {
    return muted;
  }

  return { ensure, resume, setEngine, chime, thud, setMuted, isMuted };
}
