import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Connect, Plugin } from 'vite';
import { buildSeedDb } from '../src/data/seed';
import { applyServerAssignments, mergePatch } from '../src/lib/merge';
import type { Patch, PosDb } from '../src/data/posData';

/** Best-guess Wi-Fi/LAN IPv4 of this PC (prefers 192.168.x / 10.x / 172.16-31.x). */
export function lanIp(): string {
  const all: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family === 'IPv4' && !i.internal) all.push(i.address);
    }
  }
  return (
    all.find((a) => a.startsWith('192.168.')) ||
    all.find((a) => a.startsWith('10.')) ||
    all.find((a) => /^172\.(1[6-9]|2\d|3[01])\./.test(a)) ||
    all[0] ||
    '127.0.0.1'
  );
}

/**
 * LAN database for every device in the restaurant (PC, tablets, phones).
 * Stored at ./data/ligaya-db.json.
 *   GET  /api/pos/state?v=<version>  → full db (or {unchanged:true})
 *   POST /api/pos/patch              → merge records, returns full db
 *   POST /api/pos/reset              → restore demo data
 *   GET  /api/pos/backup             → download JSON backup
 */
export function posApiPlugin(): Plugin {
  const dir = path.resolve(process.cwd(), 'data');
  const file = path.join(dir, 'ligaya-db.json');
  let db: PosDb;

  const save = () => {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, file);
  };
  const load = () => {
    try {
      db = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (!db?.settings || !Array.isArray(db.orders)) throw new Error('bad db');
    } catch {
      db = buildSeedDb();
      save();
    }
  };

  const readBody = (req: Connect.IncomingMessage) =>
    new Promise<string>((resolve, reject) => {
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > 10_000_000) reject(new Error('Payload too large'));
      });
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });

  const send = (res: any, status: number, data: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(data));
  };

  const handler: Connect.NextHandleFunction = async (req, res, next) => {
    if (!req.url?.startsWith('/api/pos/')) return next();
    const url = new URL(req.url, 'http://local');
    try {
      if (req.method === 'GET' && url.pathname === '/api/pos/state') {
        const v = Number(url.searchParams.get('v') ?? -1);
        if (v === db.version) return send(res, 200, { unchanged: true, lanIp: lanIp() });
        return send(res, 200, { db, lanIp: lanIp() });
      }
      if (req.method === 'POST' && url.pathname === '/api/pos/patch') {
        const patch = JSON.parse((await readBody(req)) || '{}') as Patch;
        const now = Date.now();
        db = mergePatch(applyServerAssignments(db, patch, now), patch);
        db.version += 1;
        save();
        return send(res, 200, { db, lanIp: lanIp() });
      }
      if (req.method === 'POST' && url.pathname === '/api/pos/reset') {
        const prev = db.version;
        db = buildSeedDb();
        db.version = prev + 1;
        save();
        return send(res, 200, { db, lanIp: lanIp() });
      }
      if (req.method === 'GET' && url.pathname === '/api/pos/backup') {
        res.setHeader('Content-Disposition', `attachment; filename="ligaya-pos-backup-${Date.now()}.json"`);
        return send(res, 200, db);
      }
      return send(res, 404, { error: 'Not found' });
    } catch (err) {
      return send(res, 400, { error: String(err) });
    }
  };

  return {
    name: 'ligaya-pos-lan-api',
    configureServer(server) {
      load();
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      load();
      server.middlewares.use(handler);
    },
  };
}
