// Records the canvas (picture) and the show's audio into one clip.
// The app draws each frame into the canvas; this only starts and stops MediaRecorder.
export type Rec = { stop: () => Promise<{ blob: Blob; ext: string }> };

const TYPES = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

function pickType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  return TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

export function startRecording(canvas: HTMLCanvasElement, audio: MediaStreamTrack | null): Rec {
  const tracks: MediaStreamTrack[] = [...canvas.captureStream(30).getVideoTracks()];
  if (audio) tracks.push(audio);
  const mime = pickType();
  const rec = new MediaRecorder(new MediaStream(tracks), mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  rec.start(250);
  return {
    stop: () =>
      new Promise((resolve, reject) => {
        rec.onerror = () => reject(new Error('recorder failed'));
        rec.onstop = () => {
          const type = rec.mimeType || mime || 'video/webm';
          resolve({ blob: new Blob(chunks, { type }), ext: type.includes('mp4') ? 'mp4' : 'webm' });
        };
        rec.stop();
      }),
  };
}
