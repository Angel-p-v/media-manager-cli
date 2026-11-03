import path from 'node:path';

/** Extensiones de vídeo que el indexador considera parte de la biblioteca. */
export const VIDEO_EXTENSIONS: readonly string[] = [
  'mkv',
  'mp4',
  'm4v',
  'avi',
  'mov',
  'webm',
  'wmv',
  'flv',
  'mpg',
  'mpeg',
  'm2ts',
  'ts',
  'ogv',
];

/** Comprueba si una ruta tiene una extensión de la lista indicada (sin distinguir mayúsculas). */
export function isVideoFile(
  filePath: string,
  extensions: readonly string[] = VIDEO_EXTENSIONS,
): boolean {
  const extension = path.extname(filePath).slice(1).toLowerCase();
  return extensions.includes(extension);
}
