#!/usr/bin/env node
// Offline repository checks for portable packages, not full schema or runtime certification.
import { ROOT, createReporter } from "./lib/reporter.mjs";
import { validatePortablePlugins } from "./lib/plugin-validation.mjs";

const reporter = createReporter();
for (const error of validatePortablePlugins(ROOT).errors) reporter.fail(error);
reporter.report();
