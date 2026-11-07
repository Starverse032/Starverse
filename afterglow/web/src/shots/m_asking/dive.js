// stub
import { POST } from './kit5.js';
export function createDive(ctx, shot) { return { render(s, f) { ctx.renderer.setRenderTarget(f.target); ctx.renderer.setClearColor(0x000000, 1); ctx.renderer.clear(); } }; }
export function divePost() { return { ...POST }; }
