import type { Language } from '../server/ask-knowledge.ts';

export function speechOutputSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

/** Select only a voice advertising the requested language. Never fake Yoruba pronunciation with English. */
export function selectSpeechVoice(voices: SpeechSynthesisVoice[], language: Language): SpeechSynthesisVoice | undefined {
  const prefix = language === 'yo' ? 'yo' : 'en';
  const matches = voices.filter(voice => voice.lang.toLowerCase().split(/[-_]/)[0] === prefix);
  if (language === 'yo') return matches.find(voice => voice.lang.toLowerCase().startsWith('yo-ng')) || matches[0];
  return matches.find(voice => voice.lang.toLowerCase() === 'en-ng')
    || matches.find(voice => voice.lang.toLowerCase() === 'en-gb') || matches[0];
}

export function stopSpeech() {
  if (speechOutputSupported()) window.speechSynthesis.cancel();
}

export function playAnswer(text: string, language: Language): { ok: boolean; message: string } {
  if (!speechOutputSupported()) return {
    ok: false, message: 'Audio playback is unavailable in this browser.',
  };
  const voice = selectSpeechVoice(window.speechSynthesis.getVoices(), language);
  if (language === 'yo' && !voice) return {
    ok: false,
    message: 'A Yoruba voice is not installed in this browser. You can still read and type in Yoruba.',
  };
  window.speechSynthesis.cancel();
  try {
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 1500));
    utterance.lang = language === 'yo' ? 'yo-NG' : 'en-NG';
    utterance.rate = 0.95;
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
    return { ok: true, message: language === 'yo' ? 'À ń ka ìdáhùn náà.' : 'Playing answer.' };
  } catch {
    return { ok: false, message: 'Audio could not start. The text answer is still available.' };
  }
}
