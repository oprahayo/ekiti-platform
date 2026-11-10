import * as React from 'react';

type Kind = 'Audio' | 'Video';

const LIMIT: Record<Kind, number> = { Audio: 15_000_000, Video: 25_000_000 };

/**
 * This is intentionally a DEVICE-ONLY capture component.
 * MediaRecorder chunks are held in volatile tab memory, not uploaded,
 * persisted, or transmitted to a government office. A streaming evidence
 * upload requires a separately approved private intake backend.
 */
export default function OnDeviceRecorder({
  kind, onCaptured,
}: { kind: Kind; onCaptured: (file: File) => void }) {
  const [status,setStatus] = React.useState<'idle' | 'requesting' | 'recording' | 'processing'>('idle');
  const [error,setError] = React.useState('');
  const [elapsed,setElapsed] = React.useState(0);
  const previewRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const bytesRef = React.useRef(0);
  const cancelledRef = React.useRef(false);
  const activeRef = React.useRef(true);

  const stopTracks = React.useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (previewRef.current) previewRef.current.srcObject = null;
  }, []);

  React.useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      cancelledRef.current = true;
      try {
        if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
      } catch { /* Recorder may already be disposed. */ }
      stopTracks();
    };
  }, [stopTracks]);

  React.useEffect(() => {
    if (status !== 'recording') return;
    const started = Date.now();
    const tick = window.setInterval(() => setElapsed(Math.round((Date.now()-started)/1000)),1000);
    return () => window.clearInterval(tick);
  }, [status]);

  async function startRecording() {
    if (status !== 'idle') return;
    setError('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === 'undefined') {
      setError('In-app recording is unavailable on this browser. Use the file picker or phone camera instead.');
      return;
    }
    setStatus('requesting');
    cancelledRef.current = false;
    chunksRef.current = [];
    bytesRef.current = 0;
    setElapsed(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === 'Video'
          ? {video:{facingMode:{ideal:'environment'}},audio:true}
          : {audio:true,video:false},
      );
      if (!activeRef.current || cancelledRef.current) {
        stream.getTracks().forEach(track=>track.stop());
        return;
      }
      streamRef.current = stream;
      if (kind === 'Video' && previewRef.current) {
        previewRef.current.srcObject = stream;
        void previewRef.current.play().catch(() => { /* Permission/UI fallback. */ });
      }
      const options = kind === 'Video'
        ? ['video/webm;codecs=vp8,opus','video/webm','video/mp4']
        : ['audio/webm;codecs=opus','audio/webm','audio/mp4'];
      const mimeType = options.find(candidate=>MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mimeType ? {mimeType} : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = event => {
        if (cancelledRef.current || !event.data.size) return;
        bytesRef.current += event.data.size;
        if (bytesRef.current > LIMIT[kind]) {
          cancelledRef.current = true;
          if (activeRef.current) setError('The recording exceeded the local preview limit. No video or audio was submitted.');
          if (recorder.state !== 'inactive') recorder.stop();
          return;
        }
        chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        cancelledRef.current = true;
        stopTracks();
        if (activeRef.current) {
          setError('Recording failed. Nothing was uploaded or saved.');
          setStatus('idle');
        }
      };
      recorder.onstop = () => {
        stopTracks();
        if (!activeRef.current) return;
        if (!cancelledRef.current && chunksRef.current.length) {
          const finalType = recorder.mimeType || (kind === 'Video' ? 'video/webm' : 'audio/webm');
          const extension = finalType.includes('mp4') ? 'mp4' : 'webm';
          const file = new File(chunksRef.current,
            'ekiti-private-preview-' + kind.toLowerCase() + '.' + extension,
            {type:finalType.split(';')[0]});
          if (file.size <= LIMIT[kind]) onCaptured(file);
        } else if (!cancelledRef.current) {
          setError('No usable recording data was produced. Try again or upload a file.');
        }
        chunksRef.current = [];
        setStatus('idle');
      };
      recorder.start(1000); // Chunking is LOCAL memory only, not network streaming.
      setStatus('recording');
    } catch {
      stopTracks();
      if (activeRef.current) {
        setError('Camera or microphone access was denied or unavailable. You may select an existing file instead.');
        setStatus('idle');
      }
    }
  }

  function stopRecording(discard:boolean) {
    if (discard) cancelledRef.current = true;
    setStatus('processing');
    try {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      else { stopTracks(); setStatus('idle'); }
    } catch { stopTracks(); setStatus('idle'); }
  }

  return <div className="guided-live-recorder">
    <p className="guided-recorder-warning">
      This records on your device only. It is <strong>not live-streamed, backed up, or sent to Ekiti Civic</strong>.
      If the tab closes before completion, it can be lost. For immediate danger, contact emergency services directly.
    </p>
    {kind === 'Video' && <video ref={previewRef} className="guided-recorder-camera"
      muted playsInline autoPlay aria-label="Live camera preview" />}
    {status === 'recording' && <p className="guided-recorder-timer" role="status">
      <span className="guided-record-dot" aria-hidden="true"/> Recording locally · {elapsed}s
    </p>}
    {status === 'idle'
      ? <button type="button" className="primary-action" onClick={() => void startRecording()}>
          Start {kind.toLowerCase()} recording
        </button>
      : status === 'recording'
        ? <div className="guided-recorder-actions">
            <button type="button" onClick={()=>stopRecording(false)}>Stop and review</button>
            <button type="button" onClick={()=>stopRecording(true)}>Discard</button>
          </div>
        : <p role="status">{status === 'requesting' ? 'Waiting for device permission…' : 'Preparing local preview…'}</p>}
    {error && <p className="guided-error" role="alert">{error}</p>}
  </div>;
}
