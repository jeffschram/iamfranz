#!/usr/bin/env node
import { spawn } from 'node:child_process';

function easternDate() {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const date = process.argv[2] || easternDate();
const child = spawn('node', ['scripts/importLatestIamfranzArtifact.mjs', '--date', date], {
  cwd: '/Users/skippy/src/iamfranz',
  stdio: 'inherit',
});
child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
