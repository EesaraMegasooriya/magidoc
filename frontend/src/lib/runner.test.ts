import { describe, expect, it } from 'vitest';
import { isLocalTarget } from './runner';

describe('isLocalTarget', () => {
  it.each([
    ['http://localhost:8080/api', true],
    ['localhost:3000', true],
    ['http://127.0.0.1:5000', true],
    ['http://[::1]:8080', true],
    ['http://192.168.1.20/api', true],
    ['http://10.0.0.5', true],
    ['http://172.20.1.1', true],
    ['http://myapp.local', true],
    ['http://api.localhost', true],
    ['https://conference-dev.tiikm.lk', false],
    ['https://jsonplaceholder.typicode.com', false],
    ['http://172.32.0.1', false],
    ['not a url', false],
  ])('%s → %s', (url, expected) => {
    expect(isLocalTarget(url)).toBe(expected);
  });
});
