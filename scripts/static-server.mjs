import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
const root = process.argv[2] || 'dist'
const port = Number(process.argv[3] || 5199)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8' }
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    let filePath = join(root, normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, ''))
    const info = await stat(filePath).catch(() => null)
    if (!info || info.isDirectory()) filePath = join(root, 'index.html')
    const body = await readFile(filePath)
    res.writeHead(200, { 'content-type': TYPES[extname(filePath)] || 'application/octet-stream' })
    res.end(body)
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(String(error))
  }
}).listen(port, () => console.log('static server on http://127.0.0.1:' + port + '/'))
