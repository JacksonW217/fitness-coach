import { describe, expect, it } from 'vitest';
import { dropIndex, moveItem } from './DragList';

const mids = [25, 85, 145, 205, 265]; // rows 60px apart

describe('drag to reorder', () => {
  it('stays put for small movements', () => {
    expect(dropIndex(2, 145, mids)).toBe(2);
    expect(dropIndex(2, 170, mids)).toBe(2);
    expect(dropIndex(2, 120, mids)).toBe(2);
  });

  it('moves down past each midpoint it crosses', () => {
    expect(dropIndex(0, 90, mids)).toBe(1);
    expect(dropIndex(0, 210, mids)).toBe(3);
    expect(dropIndex(0, 999, mids)).toBe(4);
  });

  it('moves up past each midpoint it crosses', () => {
    expect(dropIndex(4, 200, mids)).toBe(3);
    expect(dropIndex(4, 80, mids)).toBe(1);
    expect(dropIndex(4, -50, mids)).toBe(0);
  });

  it('moves items without losing or duplicating any', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
    const xs = ['a', 'b', 'c'];
    moveItem(xs, 0, 2);
    expect(xs).toEqual(['a', 'b', 'c']); // original untouched
  });
});
