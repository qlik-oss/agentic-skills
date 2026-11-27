#!/usr/bin/env node
// Checks Claude manifests and exact-path legacy selections.
import { ROOT, createReporter } from "./lib/reporter.mjs";
import { validateClaudePlugins } from "./lib/plugin-validation.mjs";

const reporter = createReporter();
for (const error of validateClaudePlugins(ROOT).errors) reporter.fail(error);
reporter.report();
