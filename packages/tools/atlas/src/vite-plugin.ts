// Dev-only "Save to project" hook for the art bench (brief E, Could item).
// Not switched on by default: the integrator adds it to packages/web/vite.config.ts:
//   import { artSavePlugin } from '../tools/atlas/src/vite-plugin';
//   plugins: [preact(), artSavePlugin()]
// Node only, Vite-tooling only. The import function never imports this file.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

interface RequestLike {
  method?: string;
  url?: string;
  on(event: 'data' | 'end' | 'error', listener: (value?: unknown) => void): void;
}

interface ResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

interface ServerLike {
  middlewares: {
    use(handler: (request: RequestLike, response: ResponseLike, next: () => void) => void): void;
  };
}

export interface ArtSavePlugin {
  name: string;
  apply: 'serve';
  configureServer(server: ServerLike): void;
}

const ENDPOINT = '/__art/save';
const SPRITE_FILE = /^sprites\/[A-Za-z0-9_-]+\.png$/;
const SETTINGS_FILE = 'import.json';
const MAX_BODY = 12 * 1024 * 1024;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function send(response: ResponseLike, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(value));
}

/** Walk up from the Vite working folder until art/export is found. */
function findExportDir(start: string): string {
  let directory = start;
  for (let depth = 0; depth < 6; depth++) {
    const candidate = join(directory, 'art/export');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return resolve(start, 'art/export');
}

async function saveSettings(targetDir: string, incoming: unknown, merge: boolean): Promise<void> {
  if (!isRecord(incoming)) throw new Error('settings must be an object');
  const path = join(targetDir, SETTINGS_FILE);
  if (!merge) {
    await writeFile(path, `${JSON.stringify(incoming, null, 2)}\n`);
    return;
  }
  let current: Record<string, unknown> = { version: 1, sprites: {} };
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (isRecord(parsed)) current = parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const sprites = isRecord(current.sprites) ? current.sprites : {};
  const incomingSprites = isRecord(incoming.sprites) ? incoming.sprites : {};
  for (const [sprite, entry] of Object.entries(incomingSprites)) {
    const existing = isRecord(sprites[sprite]) ? (sprites[sprite] as Record<string, unknown>) : {};
    sprites[sprite] = { ...existing, ...(isRecord(entry) ? entry : {}) };
  }
  await writeFile(path, `${JSON.stringify({ version: 1, ...current, sprites }, null, 2)}\n`);
}

async function handle(body: string, response: ResponseLike, targetDir: string): Promise<void> {
  try {
    const data: unknown = JSON.parse(body);
    if (!isRecord(data) || typeof data.file !== 'string') throw new Error('file is required');
    if (data.file === SETTINGS_FILE) {
      await saveSettings(targetDir, data.json, data.merge === true);
      send(response, 200, { ok: true, file: data.file });
      return;
    }
    if (!SPRITE_FILE.test(data.file)) {
      throw new Error('only sprites/<name>.png and import.json may be saved');
    }
    if (typeof data.base64 !== 'string') throw new Error('base64 is required');
    const bytes = Buffer.from(data.base64, 'base64');
    if (bytes.length === 0) throw new Error('the sprite is empty');
    const path = join(targetDir, data.file);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
    send(response, 200, { ok: true, file: data.file });
  } catch (error) {
    send(response, 400, { error: message(error) });
  }
}

/** Development-only endpoint that writes the art bench result into art/export/. */
export function artSavePlugin(options: { targetDir?: string } = {}): ArtSavePlugin {
  return {
    name: 'boss-rush:art-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.method !== 'POST' || (request.url ?? '').split('?')[0] !== ENDPOINT) {
          next();
          return;
        }
        let body = '';
        let tooLarge = false;
        request.on('data', (chunk) => {
          if (tooLarge) return;
          body += String(chunk ?? '');
          if (body.length > MAX_BODY) tooLarge = true;
        });
        request.on('end', () => {
          if (tooLarge) {
            send(response, 413, { error: 'the request is too large' });
            return;
          }
          void handle(body, response, options.targetDir ?? findExportDir(process.cwd()));
        });
        request.on('error', () => send(response, 400, { error: 'the request failed' }));
      });
    },
  };
}
