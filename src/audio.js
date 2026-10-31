export class GameAudio {
  constructor() { this.enabled = true; this.context = null; this.ambient = null; }
  unlock() {
    if (!this.enabled) return;
    try { this.context ??= new (window.AudioContext || window.webkitAudioContext)(); if (this.context.state === 'suspended') this.context.resume().catch(() => {}); }
    catch { this.context = null; }
  }
  setEnabled(value) { this.enabled = value; if (value) this.unlock(); else this.stopAmbient(); }
  tone(freq, duration = 0.15, type = 'sine', volume = 0.08, delay = 0) {
    if (!this.enabled || !this.context) return;
    const c = this.context, osc = c.createOscillator(), gain = c.createGain(), t = c.currentTime + delay;
    osc.type = type; osc.frequency.setValueAtTime(freq, t); osc.frequency.exponentialRampToValueAtTime(freq * 0.65, t + duration);
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(volume, t + 0.012); gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(c.destination); osc.start(t); osc.stop(t + duration + 0.02);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  play(event) {
    if (event === 'rescue') { this.tone(660, 0.2); this.tone(990, 0.25, 'sine', 0.05, 0.1); }
    if (event === 'web') this.tone(440, 0.35, 'triangle', 0.04);
    if (event === 'warning') { this.tone(180, 0.18, 'triangle'); this.tone(180, 0.18, 'triangle', 0.08, 0.23); }
    if (event === 'strike') this.tone(65, 0.23, 'triangle', 0.17);
    if (event === 'hurt' || event === 'lose') this.tone(110, 0.55, 'sawtooth', 0.035);
    if (event === 'win') [440, 554, 660, 880].forEach((n, i) => this.tone(n, 0.6, 'sine', 0.07, i * 0.13));
    if (event === 'recharge') this.tone(880, 0.12, 'sine', 0.025);
  }
  setPlaying(playing) {
    if (!playing || !this.enabled || !this.context) { this.stopAmbient(); return; }
    if (this.ambient) return;
    const c = this.context, gain = c.createGain(); gain.gain.value = 0.012; gain.connect(c.destination);
    const oscillators = [110, 164.81].map(freq => { const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq; osc.connect(gain); osc.start(); return osc; });
    this.ambient = { gain, oscillators };
  }
  stopAmbient() { if (!this.ambient) return; for (const osc of this.ambient.oscillators) { osc.stop(); osc.disconnect(); } this.ambient.gain.disconnect(); this.ambient = null; }
}
