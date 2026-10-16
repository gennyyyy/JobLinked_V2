import { describe, it, expect } from 'vitest';
import { toCSV } from '../routes/reports.js';

// B17 regression (live pentest phase 5): a user-controlled cell (full_name,
// job title, remarks, …) that starts with =, +, -, or @ executes as an Excel
// formula / DDE command when a super-admin opens the CSV export. RFC 4180
// quoting alone does not neutralize it — Excel interprets the cell content
// after unquoting. The builder must mark such cells as literal text.
describe('toCSV formula injection neutralization', () => {
  it('prefixes formula/command triggers with an apostrophe', () => {
    for (const evil of ['=cmd|\'/c calc\'!A1', '=SUM(1+1)', '+2+3', '-1', '@SUM(sheet1!A1)', '\tnewcol', '\rrow']) {
      const out = toCSV(['h'], [[evil]]);
      expect(out).toBe(`"h"\n"'${evil.replace(/"/g, '""')}"`);
    }
  });

  it('leaves ordinary values untouched', () => {
    expect(toCSV(['x'], [['plain name'], ['Fri Oct 16 2026']])).toBe('"x"\n"plain name"\n"Fri Oct 16 2026"');
  });

  it('keeps RFC 4180 quote doubling', () => {
    expect(toCSV(['h'], [['say "hi"']])).toBe('"h"\n"say ""hi"""');
  });
});
