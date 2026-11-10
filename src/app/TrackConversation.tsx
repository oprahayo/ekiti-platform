import * as React from 'react';
import { Link, useParams } from 'react-router';
import { demoTimeline } from './fixtures.ts';
import { useApp, speechSupported } from './state.tsx';
import { playAnswer, stopSpeech } from './speech.ts';
import { DRAFT_STORAGE_KEY } from './report-conversation.ts';

const DEMO = 'DEMO-EKP-2026-00001';
interface Message { id: number; role: 'assistant' | 'user'; text: string; }

export default function TrackConversation() {
  const { publicId } = useParams();
  const { openVoice, trackSpeech, setTrackSpeech, language } = useApp();
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<Message[]>([
    { id: 1, role: 'assistant', text: 'I can explain how report tracking will work. Online reporting is not active, so there are no real cases to retrieve yet. Do you have a report reference?' },
  ]);
  const [demo, setDemo] = React.useState(false);
  const [hasDraft, setHasDraft] = React.useState(false);
  const [audioNote, setAudioNote] = React.useState('');
  const editor = React.useRef<HTMLTextAreaElement>(null);
  const end = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      const stored: unknown = raw ? JSON.parse(raw) : null;
      const candidate = stored as { draft?: { description?: unknown } } | null;
      setHasDraft(typeof candidate?.draft?.description === 'string' && candidate.draft.description.trim().length >= 20);
    } catch { setHasDraft(false); }
  }, []);
  React.useEffect(() => {
    if (publicId === DEMO) {
      setDemo(true);
      setMessages(current => current.some(item => item.text.startsWith('Here is a fictional case timeline'))
        ? current : [...current, { id: current.length + 1, role: 'assistant',
          text: 'Here is a fictional case timeline to show the future experience. It is NOT evidence of a report being sent, acknowledged, or resolved.' }]);
    }
  }, [publicId]);
  React.useEffect(() => {
    if (!trackSpeech) return;
    setInput(trackSpeech); setTrackSpeech(''); editor.current?.focus();
  }, [trackSpeech, setTrackSpeech]);
  React.useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length, demo]);
  React.useEffect(() => () => stopSpeech(), []);

  const reply = (value: string) => {
    setMessages(current => [...current,
      { id: current.length + 1, role: 'user', text: value },
      { id: current.length + 2, role: 'assistant',
        text: 'There is no live case database yet, so I cannot look up or confirm ' +
          'any real report reference. You can view a clearly labeled fictional tracking example below or continue your draft.' },
    ]);
  };
  const send = () => {
    const text = input.trim().slice(0, 160);
    if (!text) return;
    setInput('');
    if (/^demo$/i.test(text) || text === DEMO) showDemo();
    else reply(text);
  };
  const showDemo = () => {
    setDemo(true);
    setMessages(current => [...current, {
      id: current.length + 1, role: 'assistant',
      text: 'Here is a fictional case timeline to show the future experience. It is NOT evidence of a report being sent, acknowledged, or resolved.',
    }]);
  };
  const lastAgent = [...messages].reverse().find(item => item.role === 'assistant');

  return <main className="page civic-conversation-page track-page" id="main">
    <header className="page-heading conversation-heading">
      <p className="eyebrow">Ekiti Civic / Tracking</p>
      <h1>Check a report</h1>
      <p className="help-text">Conversation preview · No live case lookup yet</p>
    </header>
    <div className="conversation-history" role="log" aria-label="Tracking conversation" aria-live="polite">
      {messages.map(message => <div className={'conversation-turn turn-' + message.role} key={message.id}>
        {message.role === 'assistant' && <span className="conversation-author">Ekiti Civic</span>}
        <p>{message.text}</p>
      </div>)}
      <div ref={end} />
    </div>
    {hasDraft && <p className="saved-draft-note">
      A private draft may be saved on this browser. It is not a submitted case. <Link to="/report">Continue the draft</Link>
    </p>}
    {!demo && <button type="button" className="text-link conversation-shortcut" onClick={showDemo}>Show a fictional tracking example</button>}
    {demo && <section className="track-result conversation-example" aria-labelledby="demo-timeline-title">
      <h2 id="demo-timeline-title">Example timeline · not a real case</h2>
      <p className="metadata">Example reference: {DEMO}. No token is required for this fictional preview.</p>
      <ol className="case-timeline">
        {demoTimeline.map((event, i) => <li key={i} className={'event-' + event.state}>
          <h3>{event.title}</h3>
          <p>{event.detail}</p>
          <small>Example evidence: {event.evidence}</small>
        </li>)}
      </ol>
      <p className="privacy-notice">No government agency has been contacted. A real reference will only be issued following successful future database submission.</p>
    </section>}
    <form className="conversation-composer" onSubmit={event => { event.preventDefault(); send(); }}>
      <label className="visually-hidden" htmlFor="tracking-message">Reply to Ekiti Civic</label>
      <textarea id="tracking-message" ref={editor} rows={2} maxLength={160}
        value={input} onChange={event => setInput(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }}
        placeholder="Type your reference or ask about tracking" />
      <div className="conversation-composer-actions">
        <span className="metadata">No case details sent to a server</span>
        {speechSupported() && <button type="button" className="icon-control" aria-label="Speak tracking question" onClick={openVoice}>🎙</button>}
        <button type="submit" className="conversation-send" disabled={!input.trim()}>Reply ↑</button>
      </div>
    </form>
    {lastAgent && <button type="button" className="text-link" onClick={() => {
      setAudioNote(playAnswer(lastAgent.text, language).message);
    }}>Listen to assistant</button>}
    {audioNote && <p className="metadata" role="status">{audioNote}</p>}
  </main>;
}
