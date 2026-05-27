import { describe, expect, it } from '@jest/globals';
import {
  createCorsOriginDelegate,
  isLocalhostOrigin,
} from '@plys/libraries/common-nest/utils/cors-origin.util';

const ALLOWED = ['https://dev.ployos.com', 'https://dev.lona.run', 'https://dev.lona.my'];

function evaluate(origin: string | undefined, allowLocalhost: boolean): Promise<boolean> {
  const delegate = createCorsOriginDelegate(ALLOWED, allowLocalhost);
  return new Promise((resolve, reject) => {
    delegate(origin, (err, allow) => {
      if (err) reject(err);
      else resolve(allow);
    });
  });
}

describe('isLocalhostOrigin', () => {
  it('matches localhost and loopback hosts on any port', () => {
    expect(isLocalhostOrigin('http://localhost:5173')).toBe(true);
    expect(isLocalhostOrigin('http://127.0.0.1:3001')).toBe(true);
    expect(isLocalhostOrigin('http://[::1]:8080')).toBe(true);
  });

  it('rejects non-localhost origins', () => {
    expect(isLocalhostOrigin('https://dev.lona.run')).toBe(false);
    expect(isLocalhostOrigin('https://evil.example')).toBe(false);
  });
});

describe('createCorsOriginDelegate', () => {
  it('allows missing origin header', async () => {
    await expect(evaluate(undefined, false)).resolves.toBe(true);
  });

  it('allows localhost when corsAllowLocalhost is true', async () => {
    await expect(evaluate('http://localhost:5173', true)).resolves.toBe(true);
  });

  it('rejects localhost when corsAllowLocalhost is false', async () => {
    await expect(evaluate('http://localhost:5173', false)).resolves.toBe(false);
  });

  it('rejects unknown origin even when corsAllowLocalhost is true', async () => {
    await expect(evaluate('https://evil.example', true)).resolves.toBe(false);
  });

  it('allows listed frontend origin when corsAllowLocalhost is false', async () => {
    await expect(evaluate('https://dev.lona.run', false)).resolves.toBe(true);
  });
});
