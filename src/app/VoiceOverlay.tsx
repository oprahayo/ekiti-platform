import * as React from 'react';
import { voiceExamples } from './fixtures.ts';

type VoiceState = 'idle' | 'listening' | 'thinking' | 'no-speech';
type TranscriptEvent = { results: { [index: number]: { [index: number]: { transcript: string } } } };
interface BrowserRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: TranscriptEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type RecognitionConstructor = new () => BrowserRecognition;

function constructorForSpeech(): RecognitionConstructor | undefined {
  const host = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return host.SpeechRecognition || host.webkitSpeechRecognition;
}

export default function VoiceOverlay({
  onClose,
  onType,
  onTranscript,
}: {
  onClose: () => void;
  onType: () => void;
  onTranscript: (transcript: string) => void;
}) {
  const [state, setState] = React.useState<VoiceState>('idle');
  const [exampleIndex, setExampleIndex] = React.useState(0);
  const recognition = React.useRef<BrowserRecognition | null>(null);
  const finishTimeout = React.useRef<number | null>(null);
  const completed = React.useRef(false);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const id = window.setInterval(() => setExampleIndex((index) => (index + 1) % voiceExamples.length), 2600);
    closeRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', keydown);
    return () => {
      clearInterval(id);
      window.removeEventListener('keydown', keydown);
      recognition.current?.abort();
      if (finishTimeout.current !== null) clearTimeout(finishTimeout.current);
    };
  }, [onClose]);

  const startListening = () => {
    const Speech = constructorForSpeech();
    if (!Speech) {
      setState('no-speech');
      return;
    }
    recognition.current?.abort();
    completed.current = false;
    const instance = new Speech();
    recognition.current = instance;
    instance.lang = 'en-NG';
    instance.interimResults = false;
    instance.continuous = false;
    instance.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript?.trim();
      if (!text) {
        setState('no-speech');
        return;
      }
      completed.current = true;
      setState('thinking');
      // This only prepares an editable transcript; it never submits a question.
      finishTimeout.current = window.setTimeout(() => onTranscript(text), 550);
    };
    instance.onerror = () => { if (!completed.current) setState('no-speech'); };
    instance.onend = () => { if (!completed.current) setState('no-speech'); };
    try {
      instance.start();
      setState('listening');
    } catch {
      setState('no-speech');
    }
  };

  return (
    <div className="voice-screen" role="dialog" aria-modal="true" aria-labelledby="voice-title">
      <div className="voice-top">
        <button className="icon-control voice-close" type="button" onClick={onClose} ref={closeRef} aria-label="Close voice mode">×</button>
        <span className="voice-label">EKITI / VOICE</span>
      </div>
      <div className="voice-body">
        <h2 id="voice-title">
          {state === 'no-speech' ? "Didn't catch that" : state === 'thinking' ? 'Transcript ready' : 'Speak now'}
        </h2>
        <p>{state === 'no-speech'
          ? 'Tap the microphone to try again'
          : state === 'thinking'
            ? 'Review the words before sending'
            : 'Ask about services, places, or projects'}</p>
        <div className={'voice-cluster ' + (state === 'listening' ? 'is-listening' : '')}>
          <span className="voice-ripple voice-ripple-one" aria-hidden="true" />
          <span className="voice-ripple voice-ripple-two" aria-hidden="true" />
          <span className="voice-ripple voice-ripple-three" aria-hidden="true" />
          <button type="button" className="voice-mic" aria-label={state === 'listening' ? 'Listening' : 'Start voice input'} onClick={startListening} disabled={state === 'thinking' || state === 'listening'}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="38" height="38">
              <rect x="9" y="2" width="6" height="13" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8" />
            </svg>
          </button>
        </div>
        <div className="voice-example" aria-live="off">
          <small>Try saying</small>
          <p key={exampleIndex}>{voiceExamples[exampleIndex]}</p>
        </div>
      </div>
      <button className="voice-type" type="button" onClick={onType}>Text always works — tap to type</button>
      <p className="voice-privacy">Speech processing is provided by your browser. No audio is stored by Ekiti Civic.</p>
    </div>
  );
}
