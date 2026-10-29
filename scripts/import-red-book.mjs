#!/usr/bin/env node
// Compatibility entry point. The verified book importer replaces binary text scanning.
process.argv.push('--book=cr');
await import('./import-books.mjs');
