import { describe, expect, it } from 'vitest';
import { devPageFile } from './devPages';

describe('the pages under npm run dev', () => {
  it.each([
    ['/daily-schedule/', 'index.html'],
    ['/daily-schedule/index.html', 'index.html'],
    ['/daily-schedule/settings', 'settings.html'],
    ['/daily-schedule/settings.html', 'settings.html'],
    ['/daily-schedule/tv', 'tv.html'],
    ['/daily-schedule/tv.html?day=2026-11-13', 'tv.html'],
  ])('opens %s from %s', (url, file) => {
    expect(devPageFile(url)).toBe(file);
  });

  it.each([
    '/daily-schedule/api/roster',
    '/daily-schedule/src/main.tsx',
    '/daily-schedule/@vite/client',
    '/daily-schedule/nothing.html',
    '/daily-schedule/export.html',
    '/settings.html',
    '/',
  ])('leaves %s to the Worker and Vite', (url) => {
    expect(devPageFile(url)).toBeNull();
  });
});
