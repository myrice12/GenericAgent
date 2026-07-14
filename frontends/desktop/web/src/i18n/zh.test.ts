import { describe, expect, it } from 'vitest';
import { zh } from './zh';

describe('model guide translations', () => {
  it('contains every guide key used by ModelFormModal', () => {
    expect(zh['guide.step1']).toBeTruthy();
    expect(zh['guide.step2']).toBeTruthy();
    expect(zh['guide.step3']).toBeTruthy();
    expect(zh['guide.getKey']).toBeTruthy();
    expect(zh['guide.prefillTip']).toBeTruthy();
  });
});
