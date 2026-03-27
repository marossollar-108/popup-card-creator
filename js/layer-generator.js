/**
 * Morphological erosion to generate layers from a binary mask.
 */

import { ContourTracer } from './contour-tracer.js';

export class LayerGenerator {
    constructor() {
        this.tracer = new ContourTracer();
    }

    /**
     * Generate layers by progressive erosion of the binary mask.
     * @param {Uint8Array} mask - binary mask
     * @param {number} w - width
     * @param {number} h - height
     * @param {number} layerCount - number of layers (3-8)
     * @param {number} erosionStrength - pixels of erosion per layer step
     * @returns {Array<{mask: Uint8Array, contours: Array, simplified: Array}>}
     */
    generate(mask, w, h, layerCount, erosionStrength, onProgress) {
        const layers = [];

        // Layer 0 = full silhouette (no erosion)
        if (onProgress) onProgress(0, layerCount);
        let currentMask = new Uint8Array(mask);
        const contours0 = this.tracer.trace(currentMask, w, h);
        const simplified0 = contours0.map(c => {
            const s = this.tracer.simplify(c, 1.5);
            return this.tracer.smooth(s, 2);
        });

        layers.push({
            mask: new Uint8Array(currentMask),
            contours: contours0,
            simplified: simplified0
        });

        // Subsequent layers with increasing erosion
        for (let i = 1; i < layerCount; i++) {
            if (onProgress) onProgress(i, layerCount);
            const radius = erosionStrength * i;
            const eroded = this._erode(mask, w, h, radius);

            // Check if erosion left anything
            let hasPixels = false;
            for (let j = 0; j < eroded.length; j++) {
                if (eroded[j]) { hasPixels = true; break; }
            }
            if (!hasPixels) break;

            const contours = this.tracer.trace(eroded, w, h);
            const simplified = contours.map(c => {
                const s = this.tracer.simplify(c, 1.5);
                return this.tracer.smooth(s, 2);
            });

            layers.push({
                mask: eroded,
                contours,
                simplified
            });
        }

        return layers;
    }

    /**
     * Erode a binary mask by the given radius using a box approximation.
     * Uses separable horizontal + vertical passes for efficiency.
     * @param {Uint8Array} mask
     * @param {number} w
     * @param {number} h
     * @param {number} radius
     * @returns {Uint8Array}
     */
    _erode(mask, w, h, radius) {
        if (radius <= 0) return new Uint8Array(mask);

        // Use summed area approach for fast box erosion
        // A pixel survives if all pixels in its radius neighborhood are foreground
        // Equivalent: min filter

        // Horizontal pass
        let current = new Uint8Array(mask);
        let temp = new Uint8Array(w * h);

        // Horizontal min
        for (let y = 0; y < h; y++) {
            const row = y * w;
            // Build prefix count of consecutive foreground from left
            for (let x = 0; x < w; x++) {
                let allFg = true;
                for (let dx = -radius; dx <= radius; dx++) {
                    const nx = x + dx;
                    if (nx < 0 || nx >= w || !current[row + nx]) {
                        allFg = false;
                        break;
                    }
                }
                temp[row + x] = allFg ? 1 : 0;
            }
        }

        // Vertical min
        const result = new Uint8Array(w * h);
        for (let x = 0; x < w; x++) {
            for (let y = 0; y < h; y++) {
                let allFg = true;
                for (let dy = -radius; dy <= radius; dy++) {
                    const ny = y + dy;
                    if (ny < 0 || ny >= h || !temp[ny * w + x]) {
                        allFg = false;
                        break;
                    }
                }
                result[y * w + x] = allFg ? 1 : 0;
            }
        }

        return result;
    }

    /**
     * Render a single layer's mask to a canvas for preview.
     * @param {{mask: Uint8Array}} layer
     * @param {number} w
     * @param {number} h
     * @param {HTMLCanvasElement} canvas
     * @param {string} color - CSS color
     */
    renderLayerPreview(layer, w, h, canvas, color = '#ffffff') {
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // Parse color
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);

        const img = ctx.createImageData(w, h);
        // Parse hex color
        const r = parseInt(color.slice(1, 3), 16) || 255;
        const g = parseInt(color.slice(3, 5), 16) || 255;
        const b = parseInt(color.slice(5, 7), 16) || 255;

        for (let i = 0; i < layer.mask.length; i++) {
            if (layer.mask[i]) {
                img.data[i * 4] = r;
                img.data[i * 4 + 1] = g;
                img.data[i * 4 + 2] = b;
                img.data[i * 4 + 3] = 255;
            } else {
                img.data[i * 4 + 3] = 255; // black background
            }
        }
        ctx.putImageData(img, 0, 0);
    }
}
