// a_descent — A3 (stub while the shared files are written): clouds only.
import { createClouds, cloudsPost } from './_clouds.js';
export async function create(ctx) {
  const clouds = createClouds(ctx);
  return {
    render(shot, f) { clouds.render(f); },
    post(shot, f) { return cloudsPost(f.frame); },
  };
}
