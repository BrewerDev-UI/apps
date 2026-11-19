// The judge: MediaPipe Pose Landmarker (Apache-2.0), running on the phone. Its files sit in this app's own
// folder (./mp), so the camera picture is never sent anywhere and nothing is fetched from another site.
import { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Body, Pt } from './pose';

let lm: PoseLandmarker | null = null, loading: Promise<PoseLandmarker> | null = null;
export function loadJudge(): Promise<PoseLandmarker> {
  if (lm) return Promise.resolve(lm);
  if (loading) return loading;
  const base = new URL('./mp/', location.href).href;
  const files = { wasmLoaderPath: base + 'vision_wasm_internal.js', wasmBinaryPath: base + 'vision_wasm_internal.wasm' };
  const make = (delegate: 'GPU' | 'CPU') => PoseLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: base + 'pose_landmarker_lite.task', delegate }, runningMode: 'VIDEO', numPoses: 1,
    minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
  loading = make('GPU').catch(() => make('CPU')).then(l => (lm = l));
  loading.catch(() => { loading = null; });
  return loading;
}
const IDX: [keyof Body, number][] = [['lSh', 11], ['rSh', 12], ['lEl', 13], ['rEl', 14], ['lWr', 15], ['rWr', 16], ['lHip', 23], ['rHip', 24], ['lKn', 25], ['rKn', 26], ['lAn', 27], ['rAn', 28]];
let last = 0;
/** Finds the player in the current video frame and maps them onto the mirrored screen (W x H, video fills it). */
export function see(video: HTMLVideoElement, W: number, H: number): Body | null {
  if (!lm || !video.videoWidth) return null;
  const ts = Math.max(last + 1, performance.now()); last = ts;
  let out: Body | null = null;
  try {
    lm.detectForVideo(video, ts, r => {
      const p = r.landmarks && r.landmarks[0]; if (!p) return;
      const vw = video.videoWidth, vh = video.videoHeight, s = Math.max(W / vw, H / vh), b = {} as Body;
      for (const [k, i] of IDX) { const q = p[i]; b[k] = { x: W - ((q.x * vw - vw / 2) * s + W / 2), y: (q.y * vh - vh / 2) * s + H / 2, v: q.visibility ?? 1 } as Pt; }
      out = b;
    });
  } catch { return null; }
  return out;
}
