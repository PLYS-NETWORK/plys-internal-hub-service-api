import { describe, expect, it } from '@jest/globals';
import { maskEmailForLog } from '@plys/libraries/common-nest/utils/mask-email.util';

describe('maskEmailForLog', () => {
  it('masks the local part while preserving the domain', () => {
    expect(maskEmailForLog('alice@example.com')).toBe('al***@example.com');
  });
});
