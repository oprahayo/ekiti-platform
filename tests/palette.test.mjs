import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('../src/web/style.css', import.meta.url), 'utf8');

function luminance(hex) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(text, background) {
  const [lighter, darker] = [luminance(text), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const readablePairs = [
  ['forest body heading', '#176343', '#fbf9f5'],
  ['muted body text', '#52665b', '#fbf9f5'],
  ['water link', '#2b617a', '#fbf9f5'],
  ['red notice', '#af3335', '#fbf9f5'],
  ['white primary action', '#ffffff', '#176343'],
  ['small geographic attribution', '#51655a', '#f3eee3'],
  ['footer cream', '#f4f5ed', '#172f29'],
];

test('main text colors meet WCAG AA normal text ratio', () => {
  for (const [name, foreground, background] of readablePairs) {
    assert.ok(styles.includes(foreground), 'Missing '+name+' foreground token');
    assert.ok(styles.includes(background), 'Missing '+name+' background token');
    assert.ok(contrast(foreground, background) >= 4.5, name + ' contrast ratio ' + contrast(foreground, background).toFixed(2));
  }
});

test('site has no third-party font import or official government logo references', () => {
  assert.doesNotMatch(styles, /@import\s+url|fonts\.googleapis/i);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /(?:ekiti-logo|state-seal|government-logo)\.(?:png|svg|jpg)/i);
  assert.match(html, /Not affiliated with the Ekiti State Government/);
});
