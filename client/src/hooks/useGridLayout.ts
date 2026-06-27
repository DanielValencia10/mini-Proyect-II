import { useMemo } from "react";

interface GridLayoutOptions {
  gap?: number;
  aspectRatio?: number;
  maxColumns?: number;
}

interface GridLayout {
  columns: number;
  tileWidth: number;
  tileHeight: number;
}

/**
 * Calcula el número de columnas y tamaño de tile que maximiza el área
 * aprovechada dentro del contenedor, respetando la relación de aspecto.
 *
 * Algoritmo:
 *  Para cada C = 1..min(N, maxColumns):
 *    R = ceil(N / C)
 *    tileHeight = (containerH - (R-1)*gap) / R
 *    tileWidth  = tileHeight * aspectRatio
 *    Si el ancho total supera containerW → ajustar por ancho
 *    Elegir el C que produce el mayor área de tile
 */
export function useGridLayout(
  containerWidth: number,
  containerHeight: number,
  tileCount: number,
  { gap = 8, aspectRatio = 16 / 9, maxColumns }: GridLayoutOptions = {},
): GridLayout {
  return useMemo(() => {
    if (tileCount === 0 || containerWidth === 0 || containerHeight === 0) {
      return { columns: 1, tileWidth: 0, tileHeight: 0 };
    }

    // Límite de columnas por breakpoint si no se pasa explícitamente
    const colLimit =
      maxColumns ??
      (containerWidth < 400 ? 1 : containerWidth < 768 ? 2 : tileCount);

    const clampedMax = Math.min(colLimit, tileCount);

    let bestColumns = 1;
    let bestArea = 0;
    let bestTileWidth = 0;
    let bestTileHeight = 0;

    for (let c = 1; c <= clampedMax; c++) {
      const rows = Math.ceil(tileCount / c);

      // Tamaño máximo de tile limitado por altura
      const tileHeightByH = (containerHeight - (rows - 1) * gap) / rows;
      let tileWidth = tileHeightByH * aspectRatio;
      let tileHeight = tileHeightByH;

      // Si no caben C columnas en el ancho, ajustar por ancho
      const totalW = c * tileWidth + (c - 1) * gap;
      if (totalW > containerWidth) {
        tileWidth = (containerWidth - (c - 1) * gap) / c;
        tileHeight = tileWidth / aspectRatio;
      }

      if (tileWidth <= 0 || tileHeight <= 0) continue;

      const area = tileWidth * tileHeight;
      if (area > bestArea) {
        bestArea = area;
        bestColumns = c;
        bestTileWidth = tileWidth;
        bestTileHeight = tileHeight;
      }
    }

    return {
      columns: bestColumns,
      tileWidth: Math.floor(bestTileWidth),
      tileHeight: Math.floor(bestTileHeight),
    };
  }, [containerWidth, containerHeight, tileCount, gap, aspectRatio, maxColumns]);
}
