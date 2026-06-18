import { describe, expect, it } from 'vitest';

describe('smoke', () => {
  it('arithmetic works', () => {
    expect(1 + 1).toBe(2);
  });

  it('localStorage is available under jsdom', () => {
    localStorage.setItem('smoke', 'ok');
    expect(localStorage.getItem('smoke')).toBe('ok');
    localStorage.removeItem('smoke');
  });

  it('crypto.randomUUID is available under jsdom', () => {
    const id = crypto.randomUUID();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
