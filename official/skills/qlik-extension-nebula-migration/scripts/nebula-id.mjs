#!/usr/bin/env node
// Derives the side-by-side extension id from the ORIGINAL extension id.
//
//   node nebula-id.mjs <original-id>        e.g. node nebula-id.mjs "Acme Sales Report"   ->  acme-sales-report-nebula
//
// Rule: split camelCase and acronym boundaries, turn every run of characters other than letters and
// digits into "-", lower-case it, and append "-nebula". The result is a valid lower-case npm package
// name, sorts next to the original, and the original id is recorded in MIGRATION.md for the final rename.
// Pure function: reads nothing, writes nothing.
import { argv, exit } from "node:process";

export function nebulaId(original) {
  const stem = String(original)
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return stem ? `${stem}-nebula` : null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const id = argv[2];
  if (!id) {
    console.error('usage: node nebula-id.mjs "<original extension id>"');
    exit(2);
  }
  const out = nebulaId(id);
  if (!out) {
    console.error("could not derive an id: the original id has no letters or digits");
    exit(1);
  }
  console.log(out);
}
