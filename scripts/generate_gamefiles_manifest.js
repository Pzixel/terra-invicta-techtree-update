#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GAMEFILES_ROOT = path.resolve(__dirname, '../public/gamefiles');

const shouldSkip = (name) => name.startsWith('.') || name === 'index.json';

const walk = (dirPath, relativePath = '') => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    if (shouldSkip(entry.name)) continue;

    const absolute = path.join(dirPath, entry.name);
    const relative = path.posix.join(relativePath, entry.name);

    if (entry.isDirectory()) {
      result.push({
        type: 'directory',
        name: entry.name,
        path: `${relative}/`,
        children: walk(absolute, relative),
      });
    } else if (entry.isFile()) {
      const stat = fs.statSync(absolute);
      result.push({
        type: 'file',
        name: entry.name,
        path: relative,
        size: stat.size,
        modified: stat.mtime.toISOString(),
      });
    }
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
};

if (!fs.existsSync(GAMEFILES_ROOT)) {
  console.error('public/gamefiles directory not found at', GAMEFILES_ROOT);
  process.exit(1);
}

const entries = walk(GAMEFILES_ROOT);
const manifest = {
  generatedAt: new Date().toISOString(),
  rootPath: 'gamefiles',
  entries,
};

fs.writeFileSync(path.join(GAMEFILES_ROOT, 'index.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Gamefiles manifest generated with ${entries.length} top-level entries at ${path.join(GAMEFILES_ROOT, 'index.json')}`);
