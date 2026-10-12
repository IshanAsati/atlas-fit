/// <reference types="node" />
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/design/tokens.css', 'utf8');

const token = (name: string, theme = 'light') => {
  const themeCss = theme === 'dark' ? css.match(/:root\[data-theme='dark'\]\s*\{([^}]+)\}/)?.[1] ?? '' : css;
  const value = themeCss.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
  if (!value) throw new Error(`Missing color token: ${name}`);
  return value;
};
const luminance = (hex: string) => {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (foreground: string, background: string) => {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

describe.each(['light', 'dark'])('%s app text contrast', (theme) => {
  for (const foreground of ['text', 'text-2', 'action-text', 'danger', 'good', 'warn']) {
    for (const background of ['bg', 'surface', 'surface-2', 'surface-3']) {
      it(`${foreground} is readable on ${background}`, () => {
        expect(contrast(token(foreground, theme), token(background, theme))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it('keeps dark labels readable on muted actions', () => {
    expect(contrast(token('action-ink', theme), token('action', theme))).toBeGreaterThanOrEqual(4.5);
  });
  it('keeps supporting text readable in the sticky app header', () => {
    expect(contrast(token('text-2', theme), token('header-bg', theme))).toBeGreaterThanOrEqual(4.5);
  });
});
