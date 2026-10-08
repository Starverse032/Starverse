// m_asking — II · the montage's last two cuts: S23 天线 (112.083 → 112.5, f2690–2699) and
// S26 俯冲 (112.5 → 113.0, f2700–2711).
//
//   S23  m_asking/antenna.js — a radio dish in a karst sinkhole, pure silhouette against the Milky Way
//                              and the airglow; the only light on it is the sky on its rim (one
//                              elliptical line) and the feed's red indicator lamp at R. msaa (timeline).
//   S26  m_asking/dive.js    — straight down onto the city at R, 100 km → 2.4 km in 12 frames, through a
//                              hole in a cloud deck, into the amber flash. The timeline's motionBlur 4
//                              sub-frames are served from one cached render per frame, which integrates
//                              a 45° shutter analytically (8 taps of the zoom).
import { createAntenna } from './m_asking/antenna.js';
import { createDive } from './m_asking/dive.js';

export async function create(ctx) {
  const antenna = createAntenna(ctx);
  const dive = createDive(ctx);
  return {
    render(shot, f) { (shot.id === 'S23' ? antenna : dive).render(shot, f); },
    post(shot, f) { return (shot.id === 'S23' ? antenna : dive).post(shot, f); },
  };
}
