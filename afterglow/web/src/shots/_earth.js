// Earth kit test: E1 night side over Europe/Africa with a thin dawn crescent; E2 full day disc; E3 tiny pale blue dot
import { createEarth } from '../lib/earth.js';
export async function create(ctx) {
  const { THREE, kit, W, H } = ctx;
  const scene = new THREE.Scene();
  const cam = kit.filmCamera(W, H, { focalMM: 50 });
  const earth = await createEarth(ctx, { radius: 1 });
  scene.add(earth.group);
  scene.add(kit.starfield({ count: 15000, seed: 9, radius: 500, H }));
  return {
    render(shot, f) {
      const t = f.lt;
      if (shot.id === 'E1') {
        // look at lon 20E lat 30N from 2.2 radii, sun nearly behind the planet (just off the right limb)
        earth.group.rotation.y = -(20 + t * 1.5) * Math.PI / 180;
        cam.position.set(0, 0.9, 2.3); cam.lookAt(0, 0.25, 0);
        earth.setSun(new THREE.Vector3(1.0, 0.2, -0.9));
      } else if (shot.id === 'E2') {
        earth.group.rotation.y = -(110 + t * 2) * Math.PI / 180;
        cam.position.set(0, 0.4, 3.6); cam.lookAt(0, 0, 0);
        earth.setSun(new THREE.Vector3(0.6, 0.3, 1.0));
      } else {
        earth.group.rotation.y = 0.5;
        cam.position.set(0, 0, 300); cam.lookAt(0, 0, 0);
        earth.setSun(new THREE.Vector3(-0.3, 0.2, 1.0));
      }
      earth.update();
      ctx.renderer.setRenderTarget(f.target);
      ctx.renderer.render(scene, cam);
    },
    post(shot) { return shot.id === 'E3' ? { bloom: 1.2, exposure: 1.5 } : { bloom: 0.6, streak: 0.15 }; },
  };
}
