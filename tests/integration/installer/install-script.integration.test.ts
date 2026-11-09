import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { INSTALL_SCRIPT, baseEnv, createArtifact, runScript } from './helpers.js';

const describeLinux = process.platform === 'linux' ? describe : describe.skip;

describeLinux('install.sh (integración)', () => {
  let workDir: string;
  let home: string;
  let prefix: string;
  let artifactArchive: string;

  beforeEach(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), 'mm-installer-'));
    home = path.join(workDir, 'home');
    prefix = path.join(workDir, 'prefix');
    mkdirSync(home, { recursive: true });

    // Crear un artefacto local para simular un release de GitHub
    const artifact = createArtifact({ root: workDir, version: '1.0.0' });
    artifactArchive = artifact.archive;
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('descarga el artefacto, crea el wrapper y la configuración', () => {
    const result = runScript(INSTALL_SCRIPT, ['--prefix', prefix, '--no-path-check'], {
      ...baseEnv(home),
      MM_ASSET_URL: artifactArchive,
    });

    expect(result.status).toBe(0);

    const wrapper = path.join(prefix, 'bin', 'mm');
    expect(existsSync(wrapper)).toBe(true);

    const version = spawnSync(wrapper, ['--version'], { encoding: 'utf8' });
    expect(version.stdout.trim()).toBe('1.0.0');

    // El archivo de configuración debe existir
    const configFile = path.join(home, '.config', 'media-manager', 'config.yaml');
    expect(existsSync(configFile)).toBe(true);

    const configContent = readFileSync(configFile, 'utf8');
    expect(configContent).toContain('version: 1');
    expect(configContent).toContain('library:');
    expect(configContent).toContain(
      path.join(home, '.local', 'share', 'media-manager', 'library.db'),
    );

    // El layout standalone debe copiarse completo (mm, node y node_modules).
    const appDir = path.join(prefix, 'share', 'media-manager-cli');
    expect(existsSync(path.join(appDir, 'mm'))).toBe(true);
    expect(existsSync(path.join(appDir, 'node'))).toBe(true);
    expect(
      existsSync(path.join(appDir, 'node_modules', 'media-manager-cli', 'dist', 'cli.js')),
    ).toBe(true);
  });

  it('acepta el layout antiguo con dist/ en la raíz', () => {
    const legacy = createArtifact({ root: workDir, version: '2.0.0', layout: 'legacy' });
    const result = runScript(INSTALL_SCRIPT, ['--prefix', prefix, '--no-path-check'], {
      ...baseEnv(home),
      MM_ASSET_URL: legacy.archive,
    });

    expect(result.status).toBe(0);
    const wrapper = path.join(prefix, 'bin', 'mm');
    const version = spawnSync(wrapper, ['--version'], { encoding: 'utf8' });
    expect(version.stdout.trim()).toBe('2.0.0');
  });

  it('falla con un mensaje claro si el repositorio clonado no está compilado', () => {
    const repo = path.join(workDir, 'repo-sin-dist');
    mkdirSync(repo, { recursive: true });
    writeFileSync(
      path.join(repo, 'package.json'),
      `${JSON.stringify({ name: 'media-manager-cli', version: '1.0.0' }, null, 2)}\n`,
    );

    const result = runScript(
      INSTALL_SCRIPT,
      ['--prefix', prefix, '--no-path-check'],
      baseEnv(home),
      repo,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('npm run build');
  });

  it('se niega a reinstalar sin --force', () => {
    const env = { ...baseEnv(home), MM_ASSET_URL: artifactArchive };
    const first = runScript(INSTALL_SCRIPT, ['--prefix', prefix, '--no-path-check'], env);
    expect(first.status).toBe(0);

    const repeated = runScript(INSTALL_SCRIPT, ['--prefix', prefix, '--no-path-check'], env);
    expect(repeated.status).toBe(4);
    expect(repeated.stderr).toContain('--force');
  });

  it('acepta --force para reinstalar', () => {
    const env = { ...baseEnv(home), MM_ASSET_URL: artifactArchive };
    runScript(INSTALL_SCRIPT, ['--prefix', prefix, '--no-path-check'], env);

    const forced = runScript(
      INSTALL_SCRIPT,
      ['--prefix', prefix, '--force', '--no-path-check'],
      env,
    );
    expect(forced.status).toBe(0);
  });

  it('limpia un APP_DIR vacío de una instalación fallida anterior', () => {
    const appDir = path.join(prefix, 'share', 'media-manager-cli');
    mkdirSync(appDir, { recursive: true });

    const result = runScript(INSTALL_SCRIPT, ['--prefix', prefix, '--no-path-check'], {
      ...baseEnv(home),
      MM_ASSET_URL: artifactArchive,
    });

    expect(result.status).toBe(0);
    expect(existsSync(path.join(appDir, 'install.json'))).toBe(true);
  });

  it('--dry-run no modifica el sistema de archivos', () => {
    const result = runScript(INSTALL_SCRIPT, ['--prefix', prefix, '--dry-run', '--no-path-check'], {
      ...baseEnv(home),
      MM_ASSET_URL: artifactArchive,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Simulación');
    expect(existsSync(prefix)).toBe(false);
  });

  it('respeta --bindir personalizado', () => {
    const bindir = path.join(workDir, 'bin-custom');
    const result = runScript(
      INSTALL_SCRIPT,
      ['--prefix', prefix, '--bindir', bindir, '--no-path-check'],
      { ...baseEnv(home), MM_ASSET_URL: artifactArchive },
    );
    expect(result.status).toBe(0);
    expect(existsSync(path.join(bindir, 'mm'))).toBe(true);
  });

  it('no corrompe al usar --prefix /', () => {
    const result = runScript(INSTALL_SCRIPT, ['--prefix', '/'], baseEnv(home));
    expect(result.status).toBe(2);
  });
});
