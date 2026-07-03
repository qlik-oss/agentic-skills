import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function createReporter() {
  const errors = [];
  const warnings = [];
  return {
    fail: (msg) => errors.push(msg),
    warn: (msg) => warnings.push(msg),
    relPath: (p) => p.replace(`${ROOT}/`, ""),
    report() {
      for (const w of warnings) console.warn(`warning: ${w}`);
      for (const e of errors) console.error(`error: ${e}`);
      if (errors.length) {
        console.error(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
        process.exit(1);
      }
      console.log(`ok — 0 errors, ${warnings.length} warning(s)`);
    },
  };
}
