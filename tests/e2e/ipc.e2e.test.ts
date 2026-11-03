import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { connect, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { MpvTracker } from '../../src/core/playback/mpvTracker.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'library');
const CLI = path.join(ROOT, 'dist', 'cli.js');

type _RunResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

describe('mm (e2e, IPC mpv falso)', () => {
  let workDir: string;
  let configPath: string;

  beforeAll(async () => {
    execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'pipe' });

    workDir = await mkdtemp(path.join(tmpdir(), 'mm-e2e-ipc-'));
    configPath = path.join(workDir, 'config.yaml');
    const _socketPath = path.join(workDir, 'mpv-socket');

    const quote = (value: string): string => `'${value.replaceAll("'", "''")}'`;

    await writeFile(
      configPath,
      [
        'library:',
        '  roots:',
        `    - path: ${quote(path.join(FIXTURES, 'series'))}`,
        '      type: series',
        `    - path: ${quote(path.join(FIXTURES, 'anime'))}`,
        '      type: series',
        `    - path: ${quote(path.join(FIXTURES, 'movies'))}`,
        '      type: movie',
        'database:',
        `  path: ${quote(path.join(workDir, 'library.db'))}`,
        'playback:',
        '  tracking: auto',
        '  resume: true',
        '  resumeMinSeconds: 30',
        '  completedThreshold: 0.9',
        '  completedTailSeconds: 30',
        '',
      ].join('\n'),
      'utf8',
    );

    const indexed = run(['index', '--json']);
    expect(indexed.status, indexed.stderr).toBe(0);
  }, 60_000);

  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  function run(args: string[], env: NodeJS.ProcessEnv = {}): _RunResult {
    const result = spawnSync(process.execPath, [CLI, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 20_000,
      env: { ...process.env, NO_COLOR: '1', MM_CONFIG: configPath, ...env },
    });

    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  function connectToMpvSocket(socketPath: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = connect(socketPath);
      socket.on('connect', () => resolve(socket));
      socket.on('error', reject);
      socket.setTimeout(5000, () => reject(new Error('Timeout conectando al socket')));
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('IPC fake server con mpv', () => {
    // No fake timers here - we need real async I/O for socket communication
    beforeEach(() => {
      vi.useRealTimers();
    });

    it('el tracker crea el socket y mpv se conecta', async () => {
      const testSocketPath = '/tmp/test-socket-' + Date.now();
      const mockRepo = {
        save: vi.fn((input) => ({
          mediaFileId: input.mediaFileId,
          positionSeconds: input.positionSeconds,
          durationSeconds: input.durationSeconds ?? null,
          completedAt: input.completedAt ?? null,
          lastPlayedAt: input.lastPlayedAt,
          playCount: input.playCount ?? 0,
          updatedAt: input.updatedAt,
        })),
        get: vi.fn(),
        remove: vi.fn(),
        listInProgress: vi.fn(),
        listRecent: vi.fn(),
        count: vi.fn(),
      };

      const mockConfig = {
        tracking: 'auto' as const,
        resume: true,
        resumeMinSeconds: 30,
        completedThreshold: 0.9,
        completedTailSeconds: 30,
      };

      const mockLogger = {
        level: 'debug' as const,
        format: 'text' as const,
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        child: vi.fn(() => mockLogger),
      };

      const trackerInstance = new MpvTracker({
        mediaFileId: 1,
        playbackRepo: mockRepo,
        playbackConfig: mockConfig,
        logger: mockLogger,
        socketPath: testSocketPath,
      });

      await trackerInstance.start();

      // Simular que mpv se conecta al socket del tracker
      const socket = await connectToMpvSocket(testSocketPath);

      // Simular mpv enviando un evento de property-change
      socket.write(
        JSON.stringify({ event: 'property-change', name: 'time-pos', data: 120.5 }) + '\n',
      );

      // Wait for the data to be processed and the save interval to fire (real timer: 5s + buffer)
      await new Promise<void>((resolve) => setTimeout(resolve, 6500));

      // Verificar que se guardó la posición
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaFileId: 1,
          positionSeconds: 120.5,
        }),
      );

      socket.destroy();
      await trackerInstance.stop();
    }, 15_000);
  });
});
