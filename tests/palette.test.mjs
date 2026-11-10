import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('../src/app/styles.css', import.meta.url), 'utf8');
const jsx = readFileSync(new URL('../src/app/AskExperience.tsx', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function luminance(hex) {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const readablePairs = [
  ['light body', '#1b2325', '#ffffff'],
  ['light secondary', '#455357', '#ffffff'],
  ['light metadata', '#647477', '#ffffff'],
  ['light danger', '#a63139', '#ffffff'],
  ['dark body', '#f0f4f4', '#101b1e'],
  ['dark secondary', '#c2cecf', '#101b1e'],
  ['dark metadata', '#9aafb1', '#101b1e'],
  ['dark danger', '#ff979b', '#101b1e'],
  ['light primary action', '#ffffff', '#1b2325'],
  ['dark primary action', '#172326', '#f0f4f4'],
];

test('UI v2 theme tokens meet WCAG AA contrast for normal text', () => {
  for (const [name, foreground, background] of readablePairs) {
    assert.ok(styles.includes(foreground), name + ' foreground token missing');
    assert.ok(styles.includes(background), name + ' background token missing');
    assert.ok(contrast(foreground, background) >= 4.5,
      name + ' contrast ratio ' + contrast(foreground, background).toFixed(2));
  }
});

test('UI remains independent and avoids remote fonts and government seals', () => {
  assert.doesNotMatch(styles, /@import\s+url|fonts\.googleapis/i);
  assert.doesNotMatch(html, /(?:ekiti-logo|state-seal|government-logo)\.(?:png|svg|jpg)/i);
  assert.match(jsx, /Independent civic project · Not a government service/);
});

test('visual tokens, reduced-motion rules and low-data baseline exist', () => {
  for (const token of [
    '--text-primary','--text-secondary','--text-tertiary','--text-quaternary',
    '--surface','--surface-raised','--positive','--warning','--danger',
    '--chart-1','--chart-2','--chart-3','--chart-4','--chart-5',
  ]) assert.ok(styles.includes(token), token + ' missing');
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(jsx, /<img[^>]*https?:/);
});
