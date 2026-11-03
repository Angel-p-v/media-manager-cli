import { cleanup, render } from 'ink-testing-library';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { MediaList, calculateWindowSize } from '../../../src/ui/components/MediaList.js';

import type { MediaRow } from '../../../src/core/db/types.js';

function mediaRow(id: number, title: string): MediaRow {
  return {
    id,
    type: 'series',
    title,
    sortTitle: title.toLowerCase(),
    year: 2020,
    folderPath: `/media/${title}`,
    createdAt: '2026-01-01 00:00:00',
    updatedAt: '2026-01-01 00:00:00',
  };
}

const items: MediaRow[] = Array.from({ length: 30 }, (_, i) =>
  mediaRow(i + 1, `Título ${String(i + 1).padStart(2, '0')}`),
);

describe('calculateWindowSize', () => {
  it('devuelve el alto de la pantalla menos el overhead de la interfaz', () => {
    expect(calculateWindowSize({ rows: 24, compact: false })).toBe(20);
    expect(calculateWindowSize({ rows: 100, compact: false })).toBe(96);
  });

  it('respeta un mínimo aunque la terminal sea muy pequeña', () => {
    expect(calculateWindowSize({ rows: 10, compact: false })).toBe(8);
    expect(calculateWindowSize({ rows: 5, compact: false })).toBe(8);
    expect(calculateWindowSize({ rows: 1, compact: false })).toBe(8);
  });

  it('muestra más filas en modo compacto', () => {
    expect(calculateWindowSize({ rows: 24, compact: true })).toBe(28);
  });

  it('reduce a la mitad cuando hay panel de detalles', () => {
    expect(calculateWindowSize({ rows: 24, compact: false, showDetails: true })).toBe(10);
    expect(calculateWindowSize({ rows: 24, compact: true, showDetails: true })).toBe(14);
  });
});

describe('MediaList render', () => {
  afterEach(() => {
    cleanup();
  });

  it('muestra exactamente los medios que caben en la ventana desde el primero', () => {
    const { lastFrame } = render(
      <MediaList
        items={items}
        selected={0}
        emptyMessage="Vacía"
        compact={false}
        selectedIds={undefined}
        _onToggleSelection={undefined}
        windowSize={10}
      />,
    );
    const frame = lastFrame() ?? '';

    for (let i = 0; i < 10; i++) {
      expect(frame).toContain(`Título ${String(i + 1).padStart(2, '0')}`);
    }
    // El undécimo no debe caber en la ventana de 10.
    expect(frame).not.toContain('Título 11');
  });

  it('muestra todos los títulos cuando la ventana es más grande que la lista', () => {
    const { lastFrame } = render(
      <MediaList
        items={items.slice(0, 5)}
        selected={0}
        emptyMessage="Vacía"
        compact={false}
        selectedIds={undefined}
        _onToggleSelection={undefined}
        windowSize={100}
      />,
    );
    const frame = lastFrame() ?? '';

    for (let i = 0; i < 5; i++) {
      expect(frame).toContain(`Título ${String(i + 1).padStart(2, '0')}`);
    }
  });

  it('centra la ventana alrededor de la selección', () => {
    const { lastFrame } = render(
      <MediaList
        items={items}
        selected={15}
        emptyMessage="Vacía"
        compact={false}
        selectedIds={undefined}
        _onToggleSelection={undefined}
        windowSize={10}
      />,
    );
    const frame = lastFrame() ?? '';

    expect(frame).toContain('Título 16');
    // Con windowSize 10 y selección 15 (índice base 0), la ventana cubre
    // índices 11..20 (Títulos 12..21). Título 11 (índice 10) no debe verse.
    expect(frame).not.toContain('Título 11');
    expect(frame).not.toContain('Título 22');
  });
});
