// Keeps the last 3 seconds of the turn as small pictures, and saves the 3 seconds around the best count.
// Nothing here leaves the phone; the pictures live in memory until the next turn.
const N = 30, W = 288, H = 512;
const blank = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
export class Clip {
  private ring = Array.from({ length: N }, blank);
  private i = 0; private count = 0; private last = 0; private freezeAt = 0;
  frames: HTMLCanvasElement[] = [];
  /** Call every frame; it only keeps ten a second. */
  push(src: HTMLCanvasElement, t: number) {
    if (t - this.last < 0.098 || !src.width) return; this.last = t;
    const g = this.ring[this.i].getContext('2d')!, s = Math.max(W / src.width, H / src.height), w = src.width * s, h = src.height * s;
    g.drawImage(src, (W - w) / 2, (H - h) / 2, w, h);
    this.i = (this.i + 1) % N; this.count++;
    if (this.freezeAt && t >= this.freezeAt) this.freeze();
  }
  /** A new best count just happened: keep rolling a moment, then save. */
  mark(t: number) { this.freezeAt = t + 1.2; }
  private freeze() {
    const n = Math.min(this.count, N), out: HTMLCanvasElement[] = [];
    for (let k = 0; k < n; k++) { const c = blank(); c.getContext('2d')!.drawImage(this.ring[(this.i - n + k + N * 2) % N], 0, 0); out.push(c); }
    this.frames = out; this.freezeAt = 0;
  }
  end() { if (this.freezeAt || !this.frames.length) this.freeze(); }
}
