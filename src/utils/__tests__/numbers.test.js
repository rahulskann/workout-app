import { parseTyped, cleanWeight, cleanReps } from '../numbers';

describe('parseTyped', () => {
  it('reads whole and decimal numbers', () => {
    expect(parseTyped('45')).toBe(45);
    expect(parseTyped('47.5')).toBe(47.5);
    expect(parseTyped('.5')).toBe(0.5);
  });

  it('accepts a decimal comma and surrounding spaces', () => {
    expect(parseTyped('47,5')).toBe(47.5);
    expect(parseTyped(' 12 ')).toBe(12);
  });

  it('treats a trailing point as the number so far', () => {
    expect(parseTyped('47.')).toBe(47);
  });

  it('returns null for things that are not numbers yet', () => {
    expect(parseTyped('')).toBeNull();
    expect(parseTyped('.')).toBeNull();
    expect(parseTyped('-5')).toBeNull();
    expect(parseTyped('4a')).toBeNull();
    expect(parseTyped('1.2.3')).toBeNull();
    expect(parseTyped(undefined)).toBeNull();
  });
});

describe('cleanWeight', () => {
  it('never goes below zero', () => {
    expect(cleanWeight(-2.5)).toBe(0);
  });

  it('keeps 2.5 lb steps exact on top of a typed value', () => {
    expect(cleanWeight(47.3 + 2.5)).toBe(49.8);
    expect(cleanWeight(0.1 + 0.2)).toBe(0.3);
  });
});

describe('cleanReps', () => {
  it('rounds to a whole rep and never drops below 1', () => {
    expect(cleanReps(10.6)).toBe(11);
    expect(cleanReps(0)).toBe(1);
    expect(cleanReps(-3)).toBe(1);
  });
});
