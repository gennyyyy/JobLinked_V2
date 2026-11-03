import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

test("css carries the migrated token contract", () => {
  const css = readFileSync(resolve(here, "../index.css"), "utf8");
  for (const marker of ["--primary: #2563eb", "--navy: #12325b", ".page-container", ".portal-grid", "data-slot='button'"])
    expect(css).toContain(marker);
});
