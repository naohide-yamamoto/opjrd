import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const defaultDmgDirectory = path.join(
  'src-tauri',
  'target',
  'universal-apple-darwin',
  'release',
  'bundle',
  'dmg',
);

const dmgDirectory = path.resolve(process.argv[2] ?? defaultDmgDirectory);

const hashFile = async (filePath) =>
  new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });

const entries = await readdir(dmgDirectory);
const dmgFiles = entries
  .filter((entry) => entry.endsWith('.dmg'))
  .sort((a, b) => a.localeCompare(b));

if (dmgFiles.length === 0) {
  throw new Error(`No DMG files found in ${dmgDirectory}.`);
}

for (const dmgFile of dmgFiles) {
  const dmgPath = path.join(dmgDirectory, dmgFile);
  const checksum = await hashFile(dmgPath);
  const checksumPath = `${dmgPath}.sha256`;
  await writeFile(checksumPath, `${checksum}  ${dmgFile}\n`, 'utf8');
  process.stdout.write(`Wrote ${path.basename(checksumPath)}\n`);
}
