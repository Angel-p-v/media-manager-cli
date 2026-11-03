import { stat } from 'node:fs/promises';
import path from 'node:path';

import { glob } from 'tinyglobby';

import { isVideoFile, VIDEO_EXTENSIONS } from './video.js';
import { IndexError, formatError } from '../../shared/errors.js';

/** Fichero de vídeo encontrado en disco. */
export type ScannedFile = {
  filePath: string;
  sizeBytes: number;
  mtimeMs: number;
};

export type ScanLibraryOptions = {
  maxDepth: number;
  followSymlinks: boolean;
  minSizeBytes: number;
  exclude: readonly string[];
  /** Extensiones de archivo que se indexan. Por defecto solo las de vídeo. */
  videoExtensions?: readonly string[];
  /** Subcarpeta relativa dentro de rootPath para limitar el escaneo. */
  subfolder?: string;
};

/**
 * Recorre una raíz de la biblioteca (o una subcarpeta de ella) y devuelve sus
 * ficheros de vídeo con tamaño y fecha de modificación. Las rutas son absolutas
 * y el resultado está ordenado, de modo que dos ejecuciones producen siempre el
 * mismo índice.
 *
 * Cuando `subfolder` está definido, solo se escanea esa subcarpeta en lugar de
 * toda la raíz, lo que evita recorrer directorios innecesarios.
 *
 * Las exclusiones se expresan con los patrones glob de `library.exclude`. Un fichero
 * que desaparece entre el listado y el `stat` (carrera con el usuario) se omite
 * en lugar de abortar la indexación.
 */
export async function scanLibrary(
  rootPath: string,
  options: ScanLibraryOptions,
): Promise<ScannedFile[]> {
  const scanRoot =
    options.subfolder !== undefined ? path.join(rootPath, options.subfolder) : rootPath;
  await assertDirectory(scanRoot);

  const extensions = options.videoExtensions ?? VIDEO_EXTENSIONS;
  const videoGlob = `**/*.{${extensions.join(',')}}`;

  let matches: string[];
  try {
    matches = await glob(videoGlob, {
      cwd: scanRoot,
      absolute: true,
      ignore: [...options.exclude],
      deep: options.maxDepth,
      followSymbolicLinks: options.followSymlinks,
      onlyFiles: true,
      caseSensitiveMatch: false,
    });
  } catch (error) {
    throw new IndexError(`No se pudo recorrer ${scanRoot}: ${formatError(error)}`, {
      cause: error,
    });
  }

  const files = await Promise.all(
    matches.map(async (filePath): Promise<ScannedFile | null> => {
      try {
        const stats = await stat(filePath);
        // Doble garantía: el glob ya filtra por extensión, pero se vuelve a
        // comprobar por si la lista de extensiones cambia o el glob deja pasar
        // algún archivo que no es realmente de vídeo.
        if (
          !stats.isFile() ||
          stats.size < options.minSizeBytes ||
          !isVideoFile(filePath, extensions)
        ) {
          return null;
        }
        return { filePath, sizeBytes: stats.size, mtimeMs: stats.mtimeMs };
      } catch {
        return null;
      }
    }),
  );

  return files
    .filter((file): file is ScannedFile => file !== null)
    .sort((a, b) => comparePaths(a.filePath, b.filePath));
}

async function assertDirectory(rootPath: string): Promise<void> {
  try {
    const stats = await stat(rootPath);
    if (!stats.isDirectory()) {
      throw new IndexError(`La raíz ${rootPath} no es un directorio`);
    }
  } catch (error) {
    if (error instanceof IndexError) throw error;
    throw new IndexError(`No se pudo leer la raíz ${rootPath}: ${formatError(error)}`, {
      cause: error,
    });
  }
}

function comparePaths(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}
