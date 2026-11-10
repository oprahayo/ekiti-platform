import {
  KNOWLEDGE, NEWS_CATEGORY_FEED, NEWS_FALLBACK, NEWS_FEED,
  topicFor, type AskResult, type AskSource, type Language,
} from './ask-knowledge.ts';

/** This module never runs an LLM. Responses are bounded, source-backed and deterministic. */
function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity: string) => {
      const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
      if (entity[0] !== '#') return named[entity.toLowerCase()] || '';
      const radix = entity[1]?.toLowerCase() === 'x' ? 16 : 10;
      const point = parseInt(entity.slice(radix === 16 ? 2 : 1), radix);
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point) : '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}
function xmlValue(item: string, tag: string): string {
  return decodeXml(item.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'i'))?.[1] || '');
}

export function parseOfficialFeed(xml: string, now = new Date()): AskSource[] {
  if (!/<(?:rss|feed)\b/i.test(xml)) return [];
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].slice(0, 30);
  const news: AskSource[] = [];
  for (const item of items) {
    const title = xmlValue(item[1], 'title').slice(0, 220);
    const link = xmlValue(item[1], 'link');
    const rawDate = xmlValue(item[1], 'pubDate');
    const time = Date.parse(rawDate);
    if (!title || !Number.isFinite(time) || time > now.getTime() + 86_400_000) continue;
    let url: URL;
    try { url = new URL(link); } catch { continue; }
    if (url.protocol !== 'https:' || !['ekitistate.gov.ng', 'www.ekitistate.gov.ng'].includes(url.hostname)) continue;
    news.push({
      title,
      url: url.href,
      published: new Date(time).toISOString().slice(0, 10),
      publisher: 'Ekiti State Government',
    });
  }
  return news.sort((a, b) => (b.published || '').localeCompare(a.published || '')).slice(0, 5);
}

async function boundedText(response: Response): Promise<string> {
  if (!response.ok || !response.body) return '';
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > 160_000) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 160_000) return '';
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { await reader.cancel().catch(() => {}); }
}

let cachedNews: { expires: number; items: AskSource[] } | undefined;
/**
 * Allowlisted official WordPress RSS only. The endpoint can be unavailable;
 * never convert an old fallback into a "today" claim.
 */
export async function latestOfficialNews(
  fetcher: typeof fetch = fetch, now = new Date(),
): Promise<AskSource[]> {
  if (fetcher === fetch && cachedNews && cachedNews.expires > now.getTime()) return cachedNews.items;
  let news: AskSource[] = [];
  for (const endpoint of [NEWS_FEED, NEWS_CATEGORY_FEED]) {
    try {
      const response = await fetcher(endpoint, {
        headers: { Accept: 'application/rss+xml,application/xml;q=0.9' },
        signal: AbortSignal.timeout(2800),
        redirect: 'error',
      });
      news = parseOfficialFeed(await boundedText(response), now);
      if (news.length) break;
    } catch { /* Public server may be inaccessible or temporarily down. */ }
  }
  if (fetcher === fetch) cachedNews = { expires: now.getTime() + 15 * 60_000, items: news };
  return news;
}

export async function answerQuestion(
  question: string, language: Language,
  fetcher: typeof fetch = fetch, now = new Date(),
): Promise<AskResult> {
  const topic = topicFor(question);
  const checkedAt = now.toISOString();
  if (topic === 'news') {
    const live = await latestOfficialNews(fetcher, now);
    const sources = live.length ? live.slice(0, 3) : [NEWS_FALLBACK];
    const newest = sources[0]?.published;
    const today = checkedAt.slice(0, 10);
    const isToday = newest === today;
    const intro = language === 'yo'
      ? isToday
        ? 'Mo rí ìròyìn tí ìjọba Èkìtì tẹ̀jáde lónìí: '
        : 'Mi ò lè fìdí ìròyìn tuntun lónìí múlẹ̀. Èyí ni ìròyìn tó ní ọjọ́ kedere tí mo rí: '
      : isToday
        ? 'The official Ekiti site lists these updates dated today: '
        : 'I could not verify a government update published today. The latest dated item available to this service is: ';
    const list = sources.map(s => s.title + ' (' + (s.published || 'date unavailable') + ')').join('; ');
    return {
      answer: intro + list + '. ' +
        (language === 'yo'
          ? 'Tẹ àwọn ìtọ́kasí láti ka ìròyìn ní kíkún. Kì í ṣe ìmúdójúìwọ̀n ní gbogbo ìṣẹ́jú.'
          : 'Open the sources for the full releases. This is not a live feed of everything happening in the state.'),
      language, topic, sources, checkedAt,
      confidence: live.length ? 'source-backed' : 'limited',
      limitation: live.length
        ? 'Official government publications only; independently verify urgent or contested claims.'
        : 'The live official feed could not be checked. This is the dated fallback, not a live update.',
    };
  }
  if (topic === 'unknown') {
    return {
      answer: language === 'yo'
        ? 'Mi ò tíì rí ẹ̀rí tó tó láti dáhùn ìbéèrè yìí. Gbìyànjú ìbéèrè nípa ìjọba ìbílẹ̀, ìròyìn, ìṣúná, ilé ìwòsàn, tàbí ìrìn-àjò.'
        : 'I cannot verify an answer to that yet. Try asking about Ekiti LGAs, official news, the budget, ministries, health, education or tourism. I will not invent an answer.',
      language, topic, sources: [], checkedAt, confidence: 'not-verified',
      limitation: 'A free source-backed search service, not an unrestricted generative AI model.',
    };
  }
  const fact = KNOWLEDGE[topic];
  return {
    answer: fact[language], language, topic, sources: fact.sources, checkedAt,
    confidence: 'source-backed',
    limitation: language === 'yo'
      ? 'Ìdáhùn yìí dá lórí orísun tó wà; kò jẹ́ ìjíròrò AI tí ó lè dáhùn ohun gbogbo.'
      : 'This answer uses reviewed sources; it is not a full generative AI conversation.',
  };
}
