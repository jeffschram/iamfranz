#!/usr/bin/env node
import { execSync } from 'node:child_process';

function nyRunId(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}_${get('hour')}-${get('minute')}-${get('second')}`;
}

const runId = nyRunId();
const date = runId.slice(0, 10);
const dayDir = `runs/${runId}`;
const noImages = process.env.IAMFRANZ_NO_IMAGES === '1' ? ' --no-images' : '';

console.log('Running IAMFRANZ pilot now');
console.log(`runId=${runId}`);
console.log(`dayDir=${dayDir}`);

execSync(`node scripts/runAutonomyDay.mjs --runId ${runId} --dayDir ${dayDir} --date ${date}${noImages}`, {
  stdio: 'inherit',
});

execSync(`node scripts/syncPilotToConvex.mjs --runId ${runId} --dayDir ${dayDir} --date ${date}`, {
  stdio: 'inherit',
});

console.log(`Pilot run completed: ${runId}`);
