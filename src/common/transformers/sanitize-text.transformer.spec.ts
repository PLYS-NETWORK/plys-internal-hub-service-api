import { TranslatableException } from '@common/exceptions/translatable.exception';
import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';

import { SanitizeText } from './sanitize-text.transformer';

class TestDto {
  @SanitizeText({ fieldLabel: 'summary' })
  public readonly summary?: string | null;
}

// Build strings with explicit unicode escapes so source-file tooling
// (formatters, copy-paste) can't quietly drop the bytes we're testing.
const SOH = String.fromCharCode(0x01);
const BEL = String.fromCharCode(0x07);
const BS = String.fromCharCode(0x08);
const DEL = String.fromCharCode(0x7f);
const TAB = '\t';
const LF = '\n';
const CR = '\r';

describe('SanitizeText', () => {
  describe('normalisation', () => {
    it('NFC-normalises combining sequences', () => {
      // "café" composed (U+00E9) vs decomposed ('cafe' + U+0301).
      const composed = 'café';
      const decomposed = `café`;
      const a = plainToInstance(TestDto, { summary: composed });
      const b = plainToInstance(TestDto, { summary: decomposed });
      expect(a.summary).toBe(composed);
      expect(b.summary).toBe(composed);
    });

    it('strips C0 / DEL control chars but preserves tab/newline/CR', () => {
      const dirty = `A${SOH}B${BEL}C${BS}D${TAB}E${LF}F${CR}G${DEL}H`;
      const dto = plainToInstance(TestDto, { summary: dirty });
      expect(dto.summary).toBe(`ABCD${TAB}E${LF}F${CR}GH`);
    });

    it('trims outer whitespace; preserves internal newlines', () => {
      const dto = plainToInstance(TestDto, { summary: '  hello\n\n  world  ' });
      expect(dto.summary).toBe('hello\n\n  world');
    });

    it('passes null / undefined / non-strings through unchanged', () => {
      const a = plainToInstance(TestDto, { summary: null });
      const b = plainToInstance(TestDto, { summary: undefined });
      expect(a.summary).toBeNull();
      expect(b.summary).toBeUndefined();
    });
  });

  describe('HTML / scheme rejection', () => {
    const cases: Array<[string, string]> = [
      ['<script>alert(1)</script>', '<script tag'],
      ['plain <SCRIPT src=x>', 'uppercase script'],
      ['javascript:alert(1)', 'javascript: scheme'],
      ['data:text/html,<h1>x', 'data:text/html scheme'],
      ['hi <a onclick="x">link</a>', 'on… event handler'],
    ];

    for (const [input, label] of cases) {
      it(`throws on: ${label}`, () => {
        expect(() => plainToInstance(TestDto, { summary: input })).toThrow(TranslatableException);
      });
    }

    it('accepts strings that mention html words inline without markup', () => {
      // "javascript" without a colon is fine — patterns target the malicious
      // shapes, not the keyword.
      const dto = plainToInstance(TestDto, {
        summary: 'we are using javascript on the frontend',
      });
      expect(dto.summary).toBe('we are using javascript on the frontend');
    });
  });
});
