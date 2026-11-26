const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const localScripts = [...html.matchAll(/<script\s+src=["']([^"']+)["']/g)]
    .map(match => match[1])
    .filter(source => !/^https?:\/\//i.test(source));
const requiredFiles = [
    'privacy.html',
    'manifest.webmanifest',
    'service-worker.js',
    'supabase-schema.sql',
    'icons/dungeon-logo-d.png',
    'icons/dungeon-192.png',
    'icons/dungeon-512.png',
    ...localScripts
];
const missingFiles = requiredFiles.filter(file => !fs.existsSync(path.join(root, file)));
if (missingFiles.length) {
    console.error(`Missing app files: ${missingFiles.join(', ')}`);
    process.exit(1);
}

for (const script of [...new Set([...localScripts, 'service-worker.js'])]) {
    if (!script.endsWith('.js')) continue;
    const result = spawnSync(process.execPath, ['--check', path.join(root, script)], { encoding: 'utf8' });
    if (result.status !== 0) {
        process.stderr.write(result.stderr || result.stdout);
        process.exit(result.status || 1);
    }
}

JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
console.log(`Build verification passed: ${new Set(localScripts).size} page scripts, PWA manifest, and offline shell.`);
