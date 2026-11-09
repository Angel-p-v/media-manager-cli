import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const APP_NAME = 'media-manager-cli';
export const INSTALL_SCRIPT = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'installers',
  'linux',
  'install.sh',
);
export const UNINSTALL_SCRIPT = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'installers',
  'linux',
  'uninstall.sh',
);

export type ArtifactLayout = 'standalone' | 'legacy';

export type ArtifactOptions = {
  root: string;
  version?: string;
  platform?: string;
  bundleName?: string;
  /**
   * `standalone` reproduce el bundle real (`mm`, `node` y
   * `node_modules/media-manager-cli/dist`); `legacy` reproduce los releases
   * antiguos con `dist/` en la raíz.
   */
  layout?: ArtifactLayout;
};

export type Artifact = {
  archive: string;
  checksum: string;
  name: string;
  platform: string;
  version: string;
};

export type RunResult = {
  status: number;
  stderr: string;
  stdout: string;
};

/**
 * Construye un artefacto con la misma estructura que el bundle real, pero con
 * un `mm` simulado que solo imprime su versión.
 */
export function createArtifact(options: ArtifactOptions): Artifact {
  const version = options.version ?? '1.0.0';
  const platform = options.platform ?? `${process.platform}-${process.arch}`;
  const name = options.bundleName ?? `${APP_NAME}-${version}-${platform}`;
  const layout = options.layout ?? 'standalone';
  const bundle = path.join(options.root, name);

  mkdirSync(path.join(bundle, 'config'), { recursive: true });
  // El runtime de Node incluido debe delegar en el node del sistema para que el
  // instalador real (que prefiere el runtime empaquetado cuando exista) funcione
  // también en los tests de integración.
  writeFileSync(path.join(bundle, 'node'), '#!/bin/sh\nexec node "$@"\n');

  if (layout === 'standalone') {
    // Layout real de los releases: lanzador propio y CLI dentro de node_modules.
    mkdirSync(path.join(bundle, 'node_modules', APP_NAME, 'dist'), { recursive: true });
    writeFileSync(path.join(bundle, 'mm'), `#!/bin/sh\nprintf '%s\\n' '${version}'\n`);
    writeFileSync(
      path.join(bundle, 'node_modules', APP_NAME, 'dist', 'cli.js'),
      `#!/usr/bin/env node\nconsole.log('${version}');\n`,
    );
    chmodSync(path.join(bundle, 'mm'), 0o755);
  } else {
    // Layout antiguo: dist/ en la raíz y sin lanzador; lo crea el instalador.
    mkdirSync(path.join(bundle, 'dist'), { recursive: true });
    writeFileSync(
      path.join(bundle, 'dist', 'cli.js'),
      `#!/usr/bin/env node\nconsole.log('${version}');\n`,
    );
  }

  writeFileSync(
    path.join(bundle, 'install.json'),
    `${JSON.stringify({ schemaVersion: 1, name: APP_NAME, version, platform }, null, 2)}\n`,
  );
  chmodSync(path.join(bundle, 'node'), 0o755);

  const archive = path.join(options.root, `${name}.tar.gz`);
  const result = spawnSync('tar', ['-czf', archive, '-C', options.root, name], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`No se pudo crear el artefacto de prueba: ${result.stderr}`);
  }

  const hash = createHash('sha256').update(readFileSync(archive)).digest('hex');
  const checksum = `${archive}.sha256`;
  writeFileSync(checksum, `${hash}  ${name}.tar.gz\n`);

  return { archive, checksum, name, platform, version };
}

export function createArtifactWithTraversal(root: string): Artifact {
  const name = `${APP_NAME}-1.0.0-linux-x64`;
  const source = path.join(root, 'malicious');
  mkdirSync(path.join(source, name), { recursive: true });
  writeFileSync(path.join(source, name, 'install.json'), '{}\n');
  const archive = path.join(root, 'malicious.tar.gz');
  const result = spawnSync(
    'tar',
    ['-czf', archive, '-C', source, '--transform', `s|^${name}|${name}/../..|`, name],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`No se pudo crear el artefacto malicioso: ${result.stderr}`);
  }
  const hash = createHash('sha256').update(readFileSync(archive)).digest('hex');
  const checksum = `${archive}.sha256`;
  writeFileSync(checksum, `${hash}  malicious.tar.gz\n`);
  return { archive, checksum, name, platform: 'linux-x64', version: '1.0.0' };
}

export function baseEnv(home: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    XDG_DATA_HOME: path.join(home, '.local', 'share'),
    XDG_CACHE_HOME: path.join(home, '.cache'),
    XDG_STATE_HOME: path.join(home, '.local', 'state'),
    NO_COLOR: '1',
  };
}

export function runScript(
  script: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd?: string,
): RunResult {
  const result = spawnSync('sh', [script, ...args], {
    encoding: 'utf8',
    env,
    cwd,
    timeout: 15_000,
  });
  return {
    status: result.status ?? -1,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

export function installArgs(artifact: Artifact, prefix: string, extra: string[] = []): string[] {
  return [
    '--file',
    artifact.archive,
    '--sha256',
    artifact.checksum,
    '--prefix',
    prefix,
    '--no-path-check',
    ...extra,
  ];
}

export function writeFakeUname(root: string, system: string): string {
  const binDir = path.join(root, 'fake-bin');
  mkdirSync(binDir, { recursive: true });
  const uname = path.join(binDir, 'uname');
  writeFileSync(uname, `#!/bin/sh\nprintf '%s\\n' '${system}'\n`);
  chmodSync(uname, 0o755);
  return binDir;
}
