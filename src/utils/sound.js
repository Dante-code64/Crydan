// src/utils/sound.js
// Pequeno "motor de som" do jogo -- sons de clique, passo, sucesso e erro,
// feitos com a API de audio do proprio navegador (sem biblioteca externa).
// regAudioCtx fica só aqui dentro (ninguém de fora precisa saber que ele
// existe), mas regGetAudioCtx e regTone são usados também por outra parte
// do app (o uiSound, que ainda mora no main.js), por isso são exportados.

let regAudioCtx = null;
export function regGetAudioCtx() {
  if (!regAudioCtx) {
    try { regAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return null; }
  }
  if (regAudioCtx.state === 'suspended') regAudioCtx.resume();
  return regAudioCtx;
}
export function regTone(freq, start, dur, vol, type) {
  const ctx = regGetAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vol, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start); osc.stop(start + dur);
}
export function regSoundClick() { const ctx = regGetAudioCtx(); if (ctx) regTone(700, ctx.currentTime, 0.05, 0.06, 'triangle'); }
export function regSoundStep() {
  const ctx = regGetAudioCtx(); if (!ctx) return;
  regTone(520, ctx.currentTime, 0.08, 0.05, 'sine');
  regTone(780, ctx.currentTime + 0.05, 0.1, 0.05, 'sine');
}
export function regSoundSuccess() {
  const ctx = regGetAudioCtx(); if (!ctx) return;
  [523.25, 659.25, 783.99].forEach((f, i) => regTone(f, ctx.currentTime + i * 0.09, 0.35, 0.07, 'triangle'));
}
export function regSoundError() {
  const ctx = regGetAudioCtx(); if (!ctx) return;
  regTone(220, ctx.currentTime, 0.18, 0.07, 'sawtooth');
  regTone(160, ctx.currentTime + 0.1, 0.22, 0.06, 'sawtooth');
}
