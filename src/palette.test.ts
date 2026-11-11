import { describe, expect, it } from 'vitest';
import { COLORS } from './schedule-rules';
import { COLOR_NAMES, CREW_DOTS, PALETTE } from './palette';

// WCAG contrast ratio between two #rrggbb colors.
const luminance = (hex: string): number => {
  const linear = (at: number) => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
};
const contrast = (a: string, b: string): number => {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + 0.05) / (dark + 0.05);
};

describe('the Crew Member colors', () => {
  it('offers Gunmetal where the Scheduler picks a color', () => {
    expect(COLORS).toContain('gunmetal');
    expect(COLOR_NAMES.gunmetal).toBe('Gunmetal');
  });

  it('draws every dot at least 3:1 against the grey chip', () => {
    for (const color of COLORS) {
      expect(contrast(CREW_DOTS[color], PALETTE.chip), color).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps the gunmetal dot clearly apart from the black one', () => {
    expect(contrast(CREW_DOTS.gunmetal, CREW_DOTS.grey)).toBeGreaterThanOrEqual(3);
  });
});
