import { Box, Text } from 'ink';
import React from 'react';

import { theme } from '../theme.js';

import type { MediaRow } from '../../core/db/types.js';

export type MediaListProps = {
  items: readonly MediaRow[];
  selected: number;
  emptyMessage: string;
  title?: string;
  /** Modo compacto: más filas por pantalla, menos detalle. */
  compact: boolean | undefined;
  /** IDs de los títulos seleccionados (selección múltiple). */
  selectedIds: ReadonlySet<number> | undefined;
  /** Callback al alternar la selección de un título. */
  _onToggleSelection: ((mediaId: number) => void) | undefined;
  /** Número máximo de filas visibles. Si se omite, se calcula desde el alto de la terminal. */
  windowSize?: number;
};

/** Número mínimo de filas que siempre se intenta mostrar, incluso en terminales pequeñas. */
const MIN_WINDOW_SIZE = 8;
/** Filas extra que se muestran en modo compacto (más títulos por pantalla). */
const COMPACT_BONUS_ROWS = 8;
/**
 * Filas fijas de la interfaz que restan al alto total de la pantalla:
 * cabecera, título de la lista, barra de estado y un margen de seguridad.
 */
const UI_OVERHEAD_ROWS = 4;

/**
 * Calcula cuántas filas de la lista caben en la pantalla actual.
 *
 * El objetivo es llenar la pantalla de seguido sin forzar a scroolear hasta que
 * realmente haya más títulos de los que caben en una pantalla.
 */
export function calculateWindowSize({
  rows,
  compact,
  showDetails = false,
}: {
  rows: number;
  compact: boolean;
  showDetails?: boolean;
}): number {
  const available = Math.max(MIN_WINDOW_SIZE, rows - UI_OVERHEAD_ROWS);
  let windowSize = available;
  if (compact) windowSize += COMPACT_BONUS_ROWS;
  if (showDetails) {
    // Cuando hay panel de detalles, la lista comparte la pantalla con él.
    windowSize = Math.max(MIN_WINDOW_SIZE, Math.floor(windowSize / 2));
  }
  return windowSize;
}

/** Lista de títulos con una ventana alrededor de la selección. */
export function MediaList({
  items,
  selected,
  emptyMessage,
  title = 'Títulos',
  compact = false,
  selectedIds,
  _onToggleSelection,
  windowSize,
}: MediaListProps): React.JSX.Element {
  const isCompact = compact ?? false;
  const rows = process.stdout.rows ?? 24;
  const size: number = windowSize ?? calculateWindowSize({ rows, compact: isCompact });
  const start = Math.max(
    0,
    Math.min(selected - Math.floor(size / 2), Math.max(0, items.length - size)),
  );
  const visible = items.slice(start, start + size);

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Text>
        {theme.label(title)} {theme.muted(`(${items.length})`)}
      </Text>
      {items.length === 0 ? (
        <Text>{theme.muted(emptyMessage)}</Text>
      ) : (
        visible.map((media, index) => {
          const position = start + index;
          const active = position === selected;
          const isSelected = selectedIds?.has(media.id) ?? false;
          const year = media.year === null ? '' : ` (${media.year})`;
          const marker = isSelected ? '✓' : active ? '▸' : ' ';
          return (
            <Text
              key={media.id}
              {...(active ? { color: 'cyan' as const } : {})}
              bold={active || isSelected}
            >
              {`${marker} `}
              {media.title}
              {year} {theme.muted(`[${media.type}]`)}
            </Text>
          );
        })
      )}
    </Box>
  );
}
