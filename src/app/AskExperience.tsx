import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useApp, speechSupported } from './state.tsx';
import { playAnswer, stopSpeech } from './speech.ts';
import type { AskResult, Language } from '../server/ask-knowledge.ts';

type ChatMessage = {
  id: number;
  question: string;
  language: Language;
  response?: AskResult;
  error?: string;
};
let inMemoryMessages: ChatMessage[] = [];

const examples: Record<Language, string[]> = {
  en: [
    'Ask me anything about Ekiti…',
    'Where can I go out in Ekiti?',
    'What is happening in Ekiti today?',
    'How many LGAs are in Ekiti?',
  ],
  yo: [
    'Béèrè ohunkóhun nípa Èkìtì…',
    'Kí ló ń ṣẹlẹ̀ ní Èkìtì lónìí?',
    'Mélòó ni ìjọba ìbílẹ̀ Èkìtì?',
  ],
};

function useTypingPrompt(language: Language, active: boolean): string {
  const [value, setValue] = React.useState('');
  React.useEffect(() => {
    if (!active || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(examples[language][0]);
      return;
    }
    let index = 0;
    let letters = 0;
    let deleting = false;
    let timer = 0;
    const tick = () => {
      const text = examples[language][index];
      letters += deleting ? -1 : 1;
      setValue(text.slice(0, Math.max(0, letters)));
      if (!deleting && letters === text.length) {
        deleting = true;
        timer = window.setTimeout(tick, 1750);
      } else if (deleting && letters <= 0) {
        index = (index + 1) % examples[language].length;
        deleting = false;
        timer = window.setTimeout(tick, 350);
      } else {
        timer = window.setTimeout(tick, deleting ? 36 : 65);
      }
    };
    tick();
    return () => clearTimeout(timer);
  }, [language, active]);
  return value;
}

function SearchIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>
  </svg>;
}
function MicIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8"/>
  </svg>;
}
function SpeakerIcon() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4V5Zm4 4a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12"/>
  </svg>;
}

export function AskBar({ home = false, onSubmit }: { home?: boolean; onSubmit?: () => void }) {
  const navigate = useNavigate();
  const { askDraft, setAskDraft, openVoice, language } = useApp();
  const [hasSpeech, setHasSpeech] = React.useState(false);
  React.useEffect(() => setHasSpeech(speechSupported()), []);
  const prompt = useTypingPrompt(language, home);
  const focusAsk = () => { if (home) navigate('/ask?focus=1'); };
  return <div className={'ask-bar ' + (home ? 'ask-home' : '')} role="search">
    <SearchIcon />
    <input id={home ? 'home-ask-input' : 'ask-input'} type="search"
      aria-label={language === 'yo' ? 'Béèrè nípa Èkìtì' : 'Ask about Ekiti'}
      placeholder={home ? (prompt || examples[language][0]) : language === 'yo' ? 'Béèrè nípa Èkìtì…' : 'Ask anything about Ekiti…'}
      readOnly={home} value={home ? '' : askDraft} maxLength={400}
      onFocus={focusAsk} onClick={focusAsk}
      onChange={event => setAskDraft(event.target.value)}
      onKeyDown={event => {
        if (event.key === 'Enter') { if (home) focusAsk(); else onSubmit?.(); }
      }} />
    {hasSpeech && <button type="button" className="icon-control mic-trigger" aria-label="Open voice mode"
      onClick={openVoice}><MicIcon /></button>}
  </div>;
}

export function Home() {
  const { language } = useApp();
  return <main className="home-page page" id="main">
    <div className="home-welcome">
      <h1>{language === 'yo' ? 'Káàbọ̀ sí Ekiti Civic' : 'Welcome to Ekiti Civic'}</h1>
      <p>{language === 'yo' ? 'Ẹnu ọ̀nà rẹ sí Ìpínlẹ̀ Èkìtì' : 'Your mobile gateway to Ekiti State'}</p>
    </div>
    <div className="home-actions">
      <AskBar home />
      <Link to="/report" className="home-row">
        <span className="row-icon icon-danger" aria-hidden="true">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 3 2.7 20h18.6L12 3Z"/><path d="M12 9v5m0 3v.2"/>
          </svg>
        </span>
        <span><strong>{language === 'yo' ? 'Jábọ̀ ìṣòro kan' : 'Report a problem'}</strong><small>{language === 'yo' ? 'Kọ àkọsílẹ̀ àdáni' : 'Start a private draft'}</small></span>
        <span aria-hidden="true" className="row-arrow">→</span>
      </Link>
      <Link to="/explore" className="home-row">
        <span className="row-icon" aria-hidden="true">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="12" cy="12" r="9"/><path d="m15 9-2 5-4 1 2-5z"/>
          </svg>
        </span>
        <span><strong>{language === 'yo' ? 'Ṣàwárí Èkìtì' : 'Explore Ekiti'}</strong><small>{language === 'yo' ? 'Àwọn agbègbè àti ibi' : 'Find places and local areas'}</small></span>
        <span aria-hidden="true" className="row-arrow">→</span>
      </Link>
    </div>
    <p className="independence">Independent civic project · Not a government service</p>
  </main>;
}

export function Ask() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, askDraft, setAskDraft } = useApp();
  const [messages, setMessages] = React.useState<ChatMessage[]>(() => inMemoryMessages);
  const [sending, setSending] = React.useState(false);
  const [audioStatus, setAudioStatus] = React.useState<Record<number, string>>({});
  const threadEnd = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (new URLSearchParams(location.search).has('focus')) document.getElementById('ask-input')?.focus();
  }, [location.search]);
  React.useEffect(() => { threadEnd.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' }); }, [messages]);
  React.useEffect(() => () => stopSpeech(), []);

  const send = async (question = askDraft) => {
    const clean = question.trim().slice(0, 400);
    if (!clean || sending) return;
    const id = Date.now();
    const message: ChatMessage = { id, question: clean, language };
    inMemoryMessages = [...inMemoryMessages, message].slice(-40);
    setMessages([...inMemoryMessages]);
    setSending(true);
    setAskDraft('');
    navigate('/ask', { replace: true });
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({ question: clean, language }),
      });
      if (!response.ok) throw new Error(response.status === 429
        ? 'Too many requests. Please try again shortly.'
        : 'The answer service is temporarily unavailable. Please retry.');
      const data = await response.json() as AskResult;
      inMemoryMessages = inMemoryMessages.map(item => item.id === id ? { ...item, response: data } : item);
    } catch (error) {
      inMemoryMessages = inMemoryMessages.map(item => item.id === id ? {
        ...item, error: error instanceof Error ? error.message : 'Unable to retrieve an answer.',
      } : item);
    } finally {
      setMessages([...inMemoryMessages]);
      setSending(false);
    }
  };

  const speak = (message: ChatMessage) => {
    if (!message.response) return;
    const result = playAnswer(message.response.answer, message.language);
    setAudioStatus(current => ({ ...current, [message.id]: result.message }));
  };

  return <main className="page ask-page" id="main">
    <header className="page-heading">
      <p className="eyebrow">Ekiti Civic / Ask</p>
      <h1>{language === 'yo' ? 'Kí ni o fẹ́ mọ̀?' : 'Ask anything about Ekiti'}</h1>
      <p className="help-text">{language === 'yo'
        ? 'Ìdáhùn láti orísun pẹ̀lú ìtọ́kasí; kì í ṣe AI tí ó mọ ohun gbogbo.'
        : 'Free source-backed answers with links—not unrestricted AI-generated responses.'}</p>
    </header>
    {messages.length === 0 && <section aria-label="Example questions">
      <p className="metadata">{language === 'yo' ? 'Gbìyànjú ìbéèrè' : 'Try asking'}</p>
      <div className="ask-suggestions">
        {(language === 'yo'
          ? ['Mélòó ni ìjọba ìbílẹ̀ Èkìtì?', 'Kí ló ń ṣẹlẹ̀ ní Èkìtì lónìí?', 'Ìwé ìṣúná Èkìtì']
          : ['How many LGAs are in Ekiti?', 'What is happening in Ekiti today?', 'Where can I find the 2026 budget?']
        ).map(question => <button type="button" className="ask-suggestion" key={question} onClick={() => void send(question)}>{question} <span aria-hidden="true">↗</span></button>)}
      </div>
    </section>}
    <div className="chat-thread" aria-live="polite" aria-relevant="additions">
      {messages.map(message => <div className="chat-exchange" key={message.id}>
        <p className="chat-question">{message.question}</p>
        {message.response ? <div className="chat-answer">
          <p lang={message.language === 'yo' ? 'yo' : 'en'}>{message.response.answer}</p>
          <div className="answer-toolbar">
            <button type="button" className="audio-play" aria-label={message.language === 'yo' ? 'Ka ìdáhùn náà sókè' : 'Play answer audio'}
              onClick={() => speak(message)}><SpeakerIcon /> <span>{message.language === 'yo' ? 'Gbọ́ ìdáhùn' : 'Listen'}</span></button>
            <button type="button" className="audio-stop" onClick={() => { stopSpeech(); setAudioStatus(current => ({...current, [message.id]: 'Audio stopped.'})); }}>Stop</button>
          </div>
          {audioStatus[message.id] && <p role="status" className="metadata">{audioStatus[message.id]}</p>}
          {message.response.sources.length ? <div className="answer-sources">
            <strong>{language === 'yo' ? 'Àwọn orísun' : 'Sources'}</strong>
            {message.response.sources.map(source => <a href={source.url} key={source.url + source.title} target="_blank" rel="noopener noreferrer">
              {source.title}{source.published ? ' · ' + source.published : ''} <span aria-hidden="true">↗</span>
            </a>)}
          </div> : null}
          <p className="answer-disclaimer">{message.response.limitation}</p>
          <p className="metadata">Checked {new Date(message.response.checkedAt).toLocaleDateString(language === 'yo' ? 'yo-NG' : 'en-NG')}</p>
        </div> : message.error ? <div className="chat-answer" role="alert">
          <p>{message.error}</p>
          <button className="text-link" type="button" onClick={() => void send(message.question)}>Retry question</button>
        </div> : <p className="chat-answer" role="status">Checking sources…</p>}
      </div>)}
      <div ref={threadEnd} />
    </div>
    {messages.length > 0 && <div className="chat-related">
      <Link to="/explore">Explore Ekiti</Link>
      <button type="button" className="text-link" onClick={() => { inMemoryMessages = []; setMessages([]); stopSpeech(); }}>Clear this chat</button>
    </div>}
    <div className="ask-composer">
      <div className="ask-input-row">
        <AskBar onSubmit={() => void send()} />
        <button className="send-button" type="button" onClick={() => void send()}
          disabled={!askDraft.trim() || sending}>{sending ? '…' : language === 'yo' ? 'Fi ránṣẹ́' : 'Send'}</button>
      </div>
    </div>
  </main>;
}
