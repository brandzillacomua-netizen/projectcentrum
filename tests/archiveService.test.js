import { describe, it, expect } from 'vitest';
import { calculatePaginationRange } from '../src/services/archiveService.js';

describe('Archive Service — Unit Tests', () => {
  it('correctly calculates pagination ranges for first page', () => {
    const range = calculatePaginationRange(0, 50);
    expect(range.from).toBe(0);
    expect(range.to).toBe(49);
    expect(range.safePage).toBe(0);
    expect(range.safePageSize).toBe(50);
  });

  it('correctly calculates pagination ranges for arbitrary pages', () => {
    const range = calculatePaginationRange(3, 25);
    expect(range.from).toBe(75);
    expect(range.to).toBe(99);
    expect(range.safePage).toBe(3);
    expect(range.safePageSize).toBe(25);
  });

  it('sanitizes negative or invalid page parameters', () => {
    const negativePage = calculatePaginationRange(-5, 50);
    expect(negativePage.from).toBe(0);
    expect(negativePage.safePage).toBe(0);

    const invalidPageSize = calculatePaginationRange(0, -10);
    expect(invalidPageSize.safePageSize).toBe(50); // falls back to ARCHIVE_PAGE_SIZE
  });
});
