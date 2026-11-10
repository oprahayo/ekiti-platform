import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useApp } from './state.tsx';
import { detectIntent } from './intents.ts';
import { categoryForGroup } from './DirectoryCategories.tsx';
import type { AskResult, Language } from '../server/ask-knowledge.ts';

type ChatMessage = {
  id: number;
  question: string;
  language: Language;
  response?: AskResult;
  error?: string;
};
// Questions stay in this tab's memory, not in a URL, analytics or local storage.
let inMemoryMessages: ChatMessage[] = [];

function SendIcon() {
  return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m4 12 16-8-5 16-3.5-6.5L4 12Z"/><path d="M11.5 13.5 20 4"/>
  </svg>;
}

/** A plain editable message field. No microphone, recognition or playback. */
export function AskBar({ home = false, onSubmit }: { home?: boolean; onSubmit?: () => void }) {
  const { askDraft, setAskDraft, language } = useApp();
  return <div className="ask-bar" role="search">
    <input id={home ? 'home-ask-input' : 'ask-input'} type="search"
      aria-label={language === 'yo' ? 'Béèrè nípa Èkìtì' : 'Ask about Ekiti'}
      placeholder={language === 'yo' ? 'Kọ ìfiranṣẹ́…' : 'Type a message…'}
      value={askDraft} maxLength={400}
      autoComplete="off" enterKeyHint="send"
      onChange={event => setAskDraft(event.target.value)}
      onKeyDown={event => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
          event.preventDefault(); onSubmit?.();
        }
      }} />
  </div>;
}

export function Home() {
  return <Ask home />;
}

export function Ask({ home = false }: { home?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, askDraft, setAskDraft, setPendingReportText,
    setExploreCategory, setExploreService, setExploreLga, setExploreQuery } = useApp();
  const [messages, setMessages] = React.useState<ChatMessage[]>(() => inMemoryMessages);
  const [sending, setSending] = React.useState(false);
  const threadEnd = React.useRef<HTMLDivElement>(null);
  const inputId = home ? 'home-ask-input' : 'ask-input';

  React.useEffect(() => {
    if (new URLSearchParams(location.search).has('focus')) document.getElementById(inputId)?.focus();
  }, [location.search, inputId]);
  React.useEffect(() => {
    if (messages.length > 0) threadEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  const send = async (question = askDraft) => {
    const clean = question.trim().slice(0, 400);
    if (!clean || sending) return;
    const intent = detectIntent(clean);
    if (intent.kind === 'report') {
      // Personal narratives stay in the local draft; never call /api/ask.
      setPendingReportText(clean.length >= 20 ? clean : '');
      setAskDraft('');
      navigate('/report');
      return;
    }
    if (intent.kind === 'track') {
      setAskDraft('');
      navigate('/track');
      return;
    }
    if (intent.kind === 'directory') {
      setExploreCategory(intent.category);
      setExploreService(categoryForGroup(intent.category)?.id ?? null);
      setExploreLga(intent.lgaId);
      setExploreQuery('');
      setAskDraft('');
      navigate('/explore');
      return;
    }
    const id = Date.now();
    const message: ChatMessage = { id, question: clean, language };
    inMemoryMessages = [...inMemoryMessages, message].slice(-40);
    setMessages([...inMemoryMessages]);
    setSending(true);
    setAskDraft('');
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({ question: clean, language }),
      });
      if (!response.ok) throw new Error(response.status === 429
        ? 'Too many questions right now. Please try again shortly.'
        : 'Answers are temporarily unavailable. Please try again.');
      const data = await response.json() as AskResult;
      inMemoryMessages = inMemoryMessages.map(item => item.id === id ? { ...item, response: data } : item);
    } catch (error) {
      inMemoryMessages = inMemoryMessages.map(item => item.id === id ? {
        ...item, error: error instanceof Error ? error.message : 'Could not get an answer.',
      } : item);
    } finally {
      setMessages([...inMemoryMessages]);
      setSending(false);
    }
  };

  const title = home
    ? language === 'yo' ? 'Káàbọ̀ sí Ekiti Civic' : 'Welcome to Ekiti Civic'
    : language === 'yo' ? 'Béèrè nípa Èkìtì' : 'Ask anything about Ekiti';

  return <main className="page chat-page ask-page" id="main">
    <header className="chat-conversation-top">
      <span className="chat-avatar" aria-hidden="true">e</span>
      <div className="chat-contact">
        <h1>{title}</h1>
        <p>{language === 'yo' ? 'Ìjíròrò àkọsílẹ̀ · Ìrànlọ́wọ́ Èkìtì' : 'Community help · Text chat'}</p>
      </div>
      {messages.length > 0 && <button className="chat-clear" type="button" onClick={() => {
        inMemoryMessages = []; setMessages([]);
      }}>Clear chat</button>}
    </header>

    <div className="chat-thread" role="log" aria-label="Ekiti Civic chat" aria-live="polite" aria-relevant="additions text">
      <p className="chat-day-label">{language === 'yo' ? 'Lónìí' : 'Today'}</p>
      <div className="chat-bubble chat-bot chat-intro-bubble">
        <span className="conversation-author">Ekiti Civic</span>
        <p>{language === 'yo'
          ? 'Báwo ni mo ṣe lè ràn ọ́ lọ́wọ́ ní Èkìtì? Kọ ìbéèrè tàbí yan ọ̀kan nísàlẹ̀.'
          : 'Hi! What would you like to do in Ekiti? Type a message or choose below.'}</p>
        <small>{language === 'yo'
          ? 'Àwọn ìdáhùn láti orísun tí a ti ṣàyẹ̀wò. Kì í ṣe iṣẹ́ ìjọba.'
          : 'Answers use reviewed sources. This is not a government service.'}</small>
      </div>
      {messages.length === 0 && <div className="chat-quick-replies" aria-label="Start a conversation">
        <Link to="/report">{language === 'yo' ? 'Jábọ̀ ìṣòro kan' : 'Report a problem'}</Link>
        <button type="button" onClick={() => document.getElementById(inputId)?.focus()}>
          {language === 'yo' ? 'Béèrè ìbéèrè' : 'Ask a question'}
        </button>
        <Link to="/explore">{language === 'yo' ? 'Wa iṣẹ́ kan' : 'Find a service'}</Link>
      </div>}

      {messages.map(message => <div className="chat-exchange" key={message.id}>
        <div className="chat-bubble chat-question"><p>{message.question}</p></div>
        {message.response ? <div className="chat-bubble chat-answer">
          <span className="conversation-author">Ekiti Civic</span>
          <p lang={message.language === 'yo' ? 'yo' : 'en'}>{message.response.answer}</p>
          {message.response.sources.length > 0 && <div className="answer-sources">
            <strong>{message.language === 'yo' ? 'Àwọn orísun' : 'Sources'}</strong>
            {message.response.sources.map(source =>
              <a href={source.url} key={source.url + source.title} target="_blank" rel="noopener noreferrer">
                {source.title}{source.published ? ' · ' + source.published : ''}
              </a>)}
          </div>}
          <p className="answer-disclaimer">{message.response.limitation}</p>
          <small className="metadata">{language === 'yo' ? 'A ṣàyẹ̀wò' : 'Checked'} {new Date(message.response.checkedAt).toLocaleDateString(message.language === 'yo' ? 'yo-NG' : 'en-NG')}</small>
        </div> : message.error ? <div className="chat-bubble chat-answer" role="alert">
          <p>{message.error}</p>
          <button className="text-link" type="button" onClick={() => void send(message.question)}>Try again</button>
        </div> : <div className="chat-bubble chat-answer" role="status">
          <p>{language === 'yo' ? 'À ń ṣàyẹ̀wò àwọn orísun…' : 'Checking sources…'}</p>
        </div>}
      </div>)}
      <div ref={threadEnd}/>
    </div>
    <form className="ask-composer chat-composer" onSubmit={event => { event.preventDefault(); void send(); }}>
      <div className="ask-input-row">
        <AskBar home={home} onSubmit={() => void send()} />
        <button className="send-button" type="submit" aria-label="Send" disabled={!askDraft.trim() || sending}>
          <SendIcon/><span className="visually-hidden">Send</span>
        </button>
      </div>
    </form>
  </main>;
}
