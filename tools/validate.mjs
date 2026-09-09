import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(toolsDir, '..');
const scenePath = path.join(projectDir, 'src', 'scene.js');
const outputPath = path.resolve(projectDir, '..', '雨夜便利店街角_离线版.html');
const [html, sceneSource, fileInfo] = await Promise.all([
  readFile(outputPath, 'utf8'),
  readFile(scenePath, 'utf8'),
  stat(outputPath),
]);

const fail = (message) => { throw new Error(message); };
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
if (scripts.length !== 2) fail(`Expected two inline scripts, found ${scripts.length}.`);
scripts.forEach((script, index) => new vm.Script(script, { filename: `inline-${index + 1}.js` }));

const requiredTokens = [
  'createConvenienceStore', 'createInterior', 'createStreetDetails', 'createRainSystem',
  'createPuddleRipples', 'createPowerLines', 'createBicycle', 'createVendingMachine',
  'animateAutomaticDoor', 'updateRain', 'window.__RAINY_KONBINI__',
];
for (const token of requiredTokens) {
  if (!sceneSource.includes(token)) fail(`Missing required scene feature: ${token}`);
}

const remoteTags = [...html.matchAll(/<(?:script|img|link|iframe|audio|video|source)\b[^>]*(?:src|href)\s*=\s*["'](?:https?:)?\/\//gi)];
if (remoteTags.length) fail(`Found ${remoteTags.length} automatic remote resources.`);
if (!html.includes("connect-src 'none'")) fail('Offline CSP is missing connect-src none.');
if (/\b(?:fetch|WebSocket|EventSource)\s*\(/.test(sceneSource) || /new\s+XMLHttpRequest\b/.test(sceneSource)) {
  fail('Scene source contains a network API call.');
}
if ((html.match(/<canvas\b/gi) || []).length !== 0) {
  fail('Canvas should be created by the renderer, not duplicated in markup.');
}
if ((html.match(/<(?:button|nav|aside|dialog|form|input|select|textarea)\b/gi) || []).length !== 0) {
  fail('Visible UI elements were found in the document.');
}

const hash = createHash('sha256').update(html).digest('hex').toUpperCase();
console.log('FINAL_INLINE_JS_PARSE=OK scripts=2');
console.log('REQUIRED_SCENE_FEATURES=OK count=' + requiredTokens.length);
console.log('REMOTE_AUTO_RESOURCES=0');
console.log('SCENE_NETWORK_API_CALLS=0');
console.log('VISIBLE_UI_ELEMENTS=0');
console.log(`FINAL_BYTES=${fileInfo.size}`);
console.log(`FINAL_SHA256=${hash}`);
