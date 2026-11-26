const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const rootPrefix = `${root}${path.sep}`;
const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.sql': 'text/plain; charset=utf-8'
};

const server = http.createServer((request, response) => {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    } catch (error) {
        response.writeHead(400).end('Invalid URL');
        return;
    }

    const relativePath = path.normalize(pathname).replace(/^[/\\]+/, '') || 'index.html';
    const filePath = path.resolve(root, relativePath);
    if (filePath !== root && !filePath.startsWith(rootPrefix)) {
        response.writeHead(403).end('Forbidden');
        return;
    }

    fs.readFile(filePath, (error, contents) => {
        if (error) {
            response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
            return;
        }
        response.writeHead(200, {
            'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        }).end(contents);
    });
});

server.listen(4176, '127.0.0.1', () => {
    console.log('E2E test server listening at http://127.0.0.1:4176');
});
