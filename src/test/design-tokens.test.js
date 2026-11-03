import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("css carries the migrated token contract", () => {
  const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");
  for (const marker of ["--primary: #2563eb", "--navy: #12325b", ".page-container", ".portal-grid", "data-slot='button'"])
    expect(css).toContain(marker);
});
