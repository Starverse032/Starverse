// Title cards, credits and the film title, drawn with canvas2D (crisp, not bloomed) and
// composited by post after tone mapping. Purely a function of time.
import * as THREE from 'three';
import { clamp, ease, smoothstep } from './lib/util.js';

export const FONTS = {
  zhSerif: '"Noto Serif CJK SC"',
  zhSans: '"Noto Sans CJK SC"',
  enSerif: '"Cormorant Garamond", "Noto Serif"',
  enSerifItalic: '"Cormorant Garamond Italic", "Cormorant Garamond", "Noto Serif"',
  mono: '"IBM Plex Mono", "Noto Sans Mono"',
  monoZh: '"IBM Plex Mono", "Noto Sans Mono CJK SC"',
};

export class Cards {
  constructor(W, H, timeline) {
    this.W = W; this.H = H; this.S = H / 1080;
    this.tl = timeline;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.flipY = false;
    this.tex.minFilter = THREE.LinearFilter; this.tex.magFilter = THREE.LinearFilter; this.tex.generateMipmaps = false;
    this.items = [
      ...(timeline.cards || []).map(c => ({ ...c, kind: 'card' })),
      ...(timeline.credits || []).map((c, i) => ({ id: `CR${i}`, fadeIn: 0.8, fadeOut: 0.8, ...c, kind: 'credit' })),
    ];
  }

  // envelope 0..1 with eased fade in/out
  env(item, t) {
    const fi = item.fadeIn ?? 1.0, fo = item.fadeOut ?? 1.0;
    if (t < item.start || t > item.end) return 0;
    const a = fi > 0 ? ease.inOutSine(clamp((t - item.start) / fi)) : 1;
    const b = fo > 0 ? ease.inOutSine(clamp((item.end - t) / fo)) : 1;
    return Math.min(a, b);
  }

  // Draws all active items at time t. Returns the texture, or null if nothing is visible.
  draw(t, bar) {
    const active = this.items.filter(it => t >= it.start && t <= it.end && it.style !== 'ui_terminal' && it.render !== 'module');
    const g = this.g;
    if (!active.length) { this._dirty && g.clearRect(0, 0, this.W, this.H); this._dirty = false; return null; }
    g.clearRect(0, 0, this.W, this.H);
    for (const it of active) this.drawItem(it, t, bar);
    this._dirty = true;
    this.tex.needsUpdate = true;
    return this.tex;
  }

  drawItem(it, t, bar) {
    const g = this.g, S = this.S, W = this.W, H = this.H;
    const e = this.env(it, t);
    if (e <= 0.001) return;
    const life = clamp((t - it.start) / Math.max(0.01, it.end - it.start));
    const blur = (1 - e) * 10 * S;
    const drift = (life - 0.5) * -6 * S; // slow upward drift through the card's life
    const style = it.style || 'cinema_center';
    const top = bar * H, bottom = H - bar * H, midY = (top + bottom) / 2;
    g.save();
    g.globalAlpha = e;
    g.filter = blur > 0.25 ? `blur(${blur.toFixed(2)}px)` : 'none';
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const shadow = () => { g.shadowColor = 'rgba(0,0,0,0.65)'; g.shadowBlur = 18 * S; };
    if (style === 'title') {
      // film title: large wide-tracked Chinese, English in spaced capitals
      const track = 0.42 + 0.06 * smoothstep(0, 1, life);
      g.fillStyle = it.color || '#f4efe6';
      g.font = `300 ${Math.round(96 * S)}px ${FONTS.zhSerif}`;
      g.letterSpacing = `${(96 * track * S).toFixed(1)}px`;
      shadow();
      if (it.zh) g.fillText(it.zh, W / 2 + 96 * track * S / 2, midY - 6 * S + drift);
      g.font = `400 ${Math.round(30 * S)}px ${FONTS.enSerif}`;
      g.letterSpacing = `${(30 * (0.55 + 0.1 * life) * S).toFixed(1)}px`;
      g.globalAlpha = e * 0.82;
      if (it.en) g.fillText(it.en.toUpperCase(), W / 2 + 30 * 0.6 * S / 2, midY + 62 * S + drift);
    } else if (style === 'credit') {
      const lines = it.lines || [it.zh, it.en].filter(Boolean);
      g.fillStyle = it.color || '#e9e4da';
      shadow();
      const lh = 46 * S; const y0 = midY - (lines.length - 1) * lh / 2;
      lines.forEach((l, i) => {
        const isZh = /[㐀-鿿]/.test(l);
        const small = i > 0 && !isZh;
        g.font = isZh ? `300 ${Math.round(30 * S)}px ${FONTS.zhSerif}` : `${small ? 400 : 500} ${Math.round((small ? 24 : 28) * S)}px ${FONTS.enSerif}`;
        g.letterSpacing = `${((isZh ? 10 : 6) * S).toFixed(1)}px`;
        g.globalAlpha = e * (small ? 0.75 : 1);
        g.fillText(l, W / 2, y0 + i * lh + drift);
      });
    } else {
      // cinema_center / cinema_lower: Chinese line + English line
      const lower = style === 'cinema_lower';
      const zhSize = (it.size || (lower ? 40 : 46)) * S, enSize = zhSize * 0.6;
      const cy = lower ? bottom - (bottom - top) * 0.2 : midY;
      g.fillStyle = it.color || '#efe9df';
      shadow();
      g.font = `300 ${Math.round(zhSize)}px ${FONTS.zhSerif}`;
      const zhTrack = zhSize * (0.28 + 0.04 * life);
      g.letterSpacing = `${zhTrack.toFixed(1)}px`;
      if (it.zh) g.fillText(it.zh, W / 2 + zhTrack / 2, cy - (it.en ? 8 * S : -zhSize * 0.35) + drift);
      if (it.en) {
        g.font = `italic 400 ${Math.round(enSize * 1.25)}px ${FONTS.enSerifItalic}`;
        const enTrack = enSize * 0.08;
        g.letterSpacing = `${enTrack.toFixed(1)}px`;
        g.globalAlpha = e * 0.78;
        g.fillText(it.en, W / 2 + enTrack / 2, cy + enSize * 1.55 + drift);
      }
    }
    g.restore();
  }
}
