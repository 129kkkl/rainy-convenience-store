import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(toolsDir, '..');
const templatePath = path.join(projectDir, 'src', 'template.html');
const appPath = path.join(projectDir, 'src', 'scene.js');
const threePath = path.join(projectDir, 'three.min.js');
const outputPath = path.resolve(projectDir, '..', '雨夜便利店街角_离线版.html');

const [template, threeSource, appSource] = await Promise.all([
  readFile(templatePath, 'utf8'),
  readFile(threePath, 'utf8'),
  readFile(appPath, 'utf8'),
]);

const safeScript = (source) => source.replace(/<\/script/gi, '<\\/script');
const output = template
  .replace('/*__THREE_BUNDLE__*/', safeScript(threeSource))
  .replace('/*__SCENE_BUNDLE__*/', safeScript(appSource));

if (output.includes('/*__THREE_BUNDLE__*/') || output.includes('/*__SCENE_BUNDLE__*/')) {
  throw new Error('Build placeholders were not replaced.');
}

await writeFile(outputPath, output, 'utf8');
console.log(`BUILD_OK=${outputPath}`);
console.log(`BYTES=${Buffer.byteLength(output, 'utf8')}`);
