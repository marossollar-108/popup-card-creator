/**
 * Export layers as SVG cutting templates.
 */

export class SvgExporter {
    /**
     * Generate SVG string for a single layer.
     * @param {Array<{x:number,y:number}>} contour - simplified contour points
     * @param {number} imgW - image width in px
     * @param {number} imgH - image height in px
     * @param {number} cardWidthMm - physical card width in mm
     * @param {number} cardHeightMm - physical card height in mm
     * @param {number} layerIndex
     * @param {number} totalLayers
     * @returns {string} SVG markup
     */
    generateLayerSvg(contour, imgW, imgH, cardWidthMm, cardHeightMm, layerIndex, totalLayers) {
        const scaleX = cardWidthMm / imgW;
        const scaleY = cardHeightMm / imgH;

        // Convert points to mm
        const pts = contour.map(p => ({
            x: p.x * scaleX,
            y: p.y * scaleY
        }));

        // Build path
        const pathD = this._pointsToPath(pts);

        // Fold tab: a small rectangle at the bottom center for attaching to the card fold
        const bounds = this._getBounds(pts);
        const tabWidth = (bounds.maxX - bounds.minX) * 0.3;
        const tabHeight = 5; // 5mm fold tab
        const tabCenterX = (bounds.minX + bounds.maxX) / 2;
        const tabY = bounds.maxY;

        const tabPath = `M ${(tabCenterX - tabWidth / 2).toFixed(2)} ${tabY.toFixed(2)} ` +
            `L ${(tabCenterX - tabWidth / 2).toFixed(2)} ${(tabY + tabHeight).toFixed(2)} ` +
            `L ${(tabCenterX + tabWidth / 2).toFixed(2)} ${(tabY + tabHeight).toFixed(2)} ` +
            `L ${(tabCenterX + tabWidth / 2).toFixed(2)} ${tabY.toFixed(2)}`;

        // Fold line (dashed) - horizontal line at the base of the tab
        const foldLine = `M ${(tabCenterX - tabWidth / 2).toFixed(2)} ${tabY.toFixed(2)} ` +
            `L ${(tabCenterX + tabWidth / 2).toFixed(2)} ${tabY.toFixed(2)}`;

        // SVG with margins
        const margin = 10;
        const svgW = cardWidthMm + margin * 2;
        const svgH = cardHeightMm + margin * 2 + tabHeight;

        return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${svgW}mm" height="${svgH}mm"
     viewBox="${-margin} ${-margin} ${svgW} ${svgH}">
  <title>Layer ${layerIndex + 1} of ${totalLayers}</title>
  <style>
    .cut { fill: none; stroke: #000; stroke-width: 0.3; }
    .fold { fill: none; stroke: #000; stroke-width: 0.3; stroke-dasharray: 2,1; }
    .label { font-family: sans-serif; font-size: 3px; fill: #666; }
  </style>

  <!-- Layer outline - CUT LINE -->
  <path class="cut" d="${pathD}" />

  <!-- Fold tab - CUT LINE -->
  <path class="cut" d="${tabPath}" />

  <!-- Fold line - FOLD -->
  <path class="fold" d="${foldLine}" />

  <!-- Label -->
  <text class="label" x="0" y="${-margin / 2}">Vrstva ${layerIndex + 1}/${totalLayers} — Čiara rezu (plná), Čiara ohybu (čiarkovaná)</text>
</svg>`;
    }

    /**
     * Generate all layer SVGs and package as ZIP.
     * @param {Array} layers - from LayerGenerator
     * @param {number} imgW
     * @param {number} imgH
     * @param {number} cardWidthMm
     * @param {number} cardHeightMm
     * @returns {Promise<Blob>} ZIP blob
     */
    async exportZip(layers, imgW, imgH, cardWidthMm = 150, cardHeightMm = 200) {
        const zip = new JSZip();

        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            if (!layer.simplified || layer.simplified.length === 0) continue;
            const contour = layer.simplified[0];
            if (!contour || contour.length < 3) continue;

            const svg = this.generateLayerSvg(
                contour, imgW, imgH,
                cardWidthMm, cardHeightMm,
                i, layers.length
            );
            zip.file(`layer-${i + 1}.svg`, svg);
        }

        // Also add combined view
        const combined = this._generateCombinedSvg(layers, imgW, imgH, cardWidthMm, cardHeightMm);
        zip.file('all-layers.svg', combined);

        return zip.generateAsync({ type: 'blob' });
    }

    /**
     * Generate a single SVG with all layers side by side.
     */
    _generateCombinedSvg(layers, imgW, imgH, cardWidthMm, cardHeightMm) {
        const scaleX = cardWidthMm / imgW;
        const scaleY = cardHeightMm / imgH;
        const spacing = 15;
        const totalW = layers.length * (cardWidthMm + spacing) + spacing;
        const totalH = cardHeightMm + 40;

        const layerColors = [
            '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
            '#3498db', '#9b59b6', '#1abc9c', '#e91e63'
        ];

        let layerPaths = '';
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            if (!layer.simplified || layer.simplified.length === 0) continue;
            const contour = layer.simplified[0];
            if (!contour || contour.length < 3) continue;

            const offsetX = i * (cardWidthMm + spacing) + spacing;
            const pts = contour.map(p => ({
                x: p.x * scaleX + offsetX,
                y: p.y * scaleY + 15
            }));
            const pathD = this._pointsToPath(pts);
            const color = layerColors[i % layerColors.length];

            layerPaths += `  <path fill="none" stroke="${color}" stroke-width="0.4" d="${pathD}" />\n`;
            layerPaths += `  <text font-family="sans-serif" font-size="4" fill="${color}" x="${offsetX}" y="10">Vrstva ${i + 1}</text>\n`;
        }

        return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${totalW}mm" height="${totalH}mm"
     viewBox="0 0 ${totalW} ${totalH}">
  <title>Všetky vrstvy</title>
${layerPaths}
</svg>`;
    }

    _pointsToPath(pts) {
        if (pts.length === 0) return '';
        let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
        for (let i = 1; i < pts.length; i++) {
            d += ` L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
        }
        d += ' Z';
        return d;
    }

    _getBounds(pts) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of pts) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        }
        return { minX, minY, maxX, maxY };
    }
}
