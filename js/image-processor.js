/**
 * Image loading, background removal, binary mask generation.
 */

export class ImageProcessor {
    constructor() {
        this.sourceCanvas = null;
        this.sourceCtx = null;
        this.width = 0;
        this.height = 0;
        this.imageData = null;
        /** @type {Uint8Array|null} binary mask: 1=foreground, 0=background */
        this.mask = null;
    }

    /**
     * Load an image from a File object into the source canvas.
     * @param {File} file
     * @param {HTMLCanvasElement} canvas
     * @returns {Promise<void>}
     */
    loadImage(file, canvas) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                // Scale to fit reasonable processing size (max 800px)
                const maxDim = 800;
                let w = img.width;
                let h = img.height;
                if (w > maxDim || h > maxDim) {
                    const scale = maxDim / Math.max(w, h);
                    w = Math.round(w * scale);
                    h = Math.round(h * scale);
                }
                canvas.width = w;
                canvas.height = h;
                this.sourceCanvas = canvas;
                this.sourceCtx = canvas.getContext('2d', { willReadFrequently: true });
                this.sourceCtx.drawImage(img, 0, 0, w, h);
                this.width = w;
                this.height = h;
                this.imageData = this.sourceCtx.getImageData(0, 0, w, h);
                URL.revokeObjectURL(img.src);
                resolve();
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * Generate binary mask using selected method.
     * @param {'auto'|'alpha'|'click'} method
     * @param {number} tolerance 0-100
     * @param {{x:number,y:number}|null} clickPoint for 'click' method
     * @returns {Uint8Array} mask
     */
    generateMask(method, tolerance, clickPoint = null) {
        const { width: w, height: h, imageData } = this;
        const data = imageData.data;
        this.mask = new Uint8Array(w * h);

        if (method === 'alpha') {
            this._maskFromAlpha(data, tolerance);
        } else if (method === 'click' && clickPoint) {
            this._maskFromFloodFill(data, [clickPoint], tolerance);
        } else {
            // auto: flood fill from corners
            const corners = [
                { x: 0, y: 0 },
                { x: w - 1, y: 0 },
                { x: 0, y: h - 1 },
                { x: w - 1, y: h - 1 }
            ];
            this._maskFromFloodFill(data, corners, tolerance);
        }

        // Clean up mask with simple morphological close (dilate then erode)
        this._morphClose(this.mask, w, h, 2);

        return this.mask;
    }

    _maskFromAlpha(data, tolerance) {
        const threshold = Math.round((tolerance / 100) * 255);
        for (let i = 0; i < this.mask.length; i++) {
            this.mask[i] = data[i * 4 + 3] > threshold ? 1 : 0;
        }
    }

    _maskFromFloodFill(data, seeds, tolerance) {
        const w = this.width;
        const h = this.height;
        const tol = tolerance * 2.55; // scale 0-100 to 0-255
        const visited = new Uint8Array(w * h);

        // Mark everything as foreground first
        this.mask.fill(1);

        for (const seed of seeds) {
            const si = (seed.y * w + seed.x) * 4;
            const sr = data[si], sg = data[si + 1], sb = data[si + 2];

            const stack = [seed.x + seed.y * w];
            while (stack.length > 0) {
                const idx = stack.pop();
                if (visited[idx]) continue;
                visited[idx] = 1;

                const pi = idx * 4;
                const dr = Math.abs(data[pi] - sr);
                const dg = Math.abs(data[pi + 1] - sg);
                const db = Math.abs(data[pi + 2] - sb);

                if (dr <= tol && dg <= tol && db <= tol) {
                    this.mask[idx] = 0; // background
                    const x = idx % w;
                    const y = (idx - x) / w;
                    if (x > 0 && !visited[idx - 1]) stack.push(idx - 1);
                    if (x < w - 1 && !visited[idx + 1]) stack.push(idx + 1);
                    if (y > 0 && !visited[idx - w]) stack.push(idx - w);
                    if (y < h - 1 && !visited[idx + w]) stack.push(idx + w);
                }
            }
        }
    }

    /**
     * Morphological close to clean up noise.
     */
    _morphClose(mask, w, h, radius) {
        // Dilate
        const dilated = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let val = 0;
                for (let dy = -radius; dy <= radius && !val; dy++) {
                    for (let dx = -radius; dx <= radius && !val; dx++) {
                        const nx = x + dx, ny = y + dy;
                        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                            if (mask[ny * w + nx]) val = 1;
                        }
                    }
                }
                dilated[y * w + x] = val;
            }
        }
        // Erode the dilated result
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let val = 1;
                for (let dy = -radius; dy <= radius && val; dy++) {
                    for (let dx = -radius; dx <= radius && val; dx++) {
                        const nx = x + dx, ny = y + dy;
                        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                            if (!dilated[ny * w + nx]) val = 0;
                        } else {
                            val = 0;
                        }
                    }
                }
                mask[y * w + x] = val;
            }
        }
    }

    /**
     * Render mask as black & white onto a canvas for preview.
     * @param {Uint8Array} mask
     * @param {HTMLCanvasElement} canvas
     */
    renderMask(mask, canvas) {
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d');
        const img = ctx.createImageData(this.width, this.height);
        for (let i = 0; i < mask.length; i++) {
            const v = mask[i] ? 255 : 0;
            img.data[i * 4] = v;
            img.data[i * 4 + 1] = v;
            img.data[i * 4 + 2] = v;
            img.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
    }
}
