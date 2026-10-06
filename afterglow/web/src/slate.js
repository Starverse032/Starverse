// Placeholder for shots whose module does not exist yet: an animatic slate with the shot's
// description, so the whole film can be timed (with music and cards) before every shot is built.
import * as THREE from 'three';
import { timecode } from './lib/util.js';

export function createSlate(ctx, name, err) {
  const { W, H, S } = ctx;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, depthTest: false, depthWrite: false });
  const fsq = new ctx.FSQ(mat);
  const wrap = (text, maxW) => {
    const out = []; let line = '';
    for (const ch of String(text || '')) {
      if (g.measureText(line + ch).width > maxW) { out.push(line); line = ch; } else line += ch;
    }
    if (line) out.push(line);
    return out;
  };
  return {
    render(shot, f) {
      g.fillStyle = '#0b0d12'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 2 * S;
      g.strokeRect(80 * S, f.barPx + 40 * S, W - 160 * S, H - 2 * f.barPx - 80 * S);
      g.fillStyle = '#e8e2d6'; g.textAlign = 'left'; g.textBaseline = 'top';
      g.font = `500 ${42 * S}px "IBM Plex Mono", "Noto Sans Mono CJK SC"`;
      g.fillText(`${shot.id}  ${shot.title || ''}`, 120 * S, f.barPx + 80 * S);
      g.font = `400 ${24 * S}px "IBM Plex Mono", "Noto Sans Mono CJK SC"`;
      g.fillStyle = '#9aa3b2';
      g.fillText(`${timecode(f.t)}   shot ${f.lt.toFixed(2)}s / ${f.dur.toFixed(2)}s   module ${name}${err ? ' (missing)' : ''}`, 120 * S, f.barPx + 140 * S);
      g.font = `400 ${26 * S}px "Noto Sans CJK SC"`;
      g.fillStyle = '#c9cfd9';
      let y = f.barPx + 200 * S;
      for (const [label, text] of [['画面', shot.visual], ['镜头', shot.camera], ['声音', shot.sound]]) {
        for (const l of wrap(`${label}：${text || ''}`, W - 260 * S).slice(0, 4)) { g.fillText(l, 120 * S, y); y += 38 * S; }
        y += 12 * S;
      }
      // progress bar
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(120 * S, H - f.barPx - 90 * S, W - 240 * S, 6 * S);
      g.fillStyle = '#d9b46a'; g.fillRect(120 * S, H - f.barPx - 90 * S, (W - 240 * S) * f.p, 6 * S);
      tex.needsUpdate = true;
      fsq.render(ctx.renderer, f.target);
    },
    post() { return { bloom: 0, grain: 0, vignette: 0, ca: 0 }; },
  };
}
