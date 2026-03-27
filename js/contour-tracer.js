/**
 * Marching squares contour tracing + simplification.
 */

export class ContourTracer {
    /**
     * Trace contours from a binary mask using marching squares.
     * @param {Uint8Array} mask - binary mask (1=foreground)
     * @param {number} w - width
     * @param {number} h - height
     * @returns {Array<Array<{x:number,y:number}>>} array of contour polygons
     */
    trace(mask, w, h) {
        // Pad mask by 1 pixel on each side to ensure closed contours
        const pw = w + 2;
        const ph = h + 2;
        const padded = new Uint8Array(pw * ph);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                padded[(y + 1) * pw + (x + 1)] = mask[y * w + x];
            }
        }

        const visited = new Uint8Array((pw - 1) * (ph - 1));
        const contours = [];

        for (let y = 0; y < ph - 1; y++) {
            for (let x = 0; x < pw - 1; x++) {
                const cellIdx = y * (pw - 1) + x;
                if (visited[cellIdx]) continue;

                const cell = this._cellValue(padded, pw, x, y);
                if (cell === 0 || cell === 15) continue;

                const contour = this._traceContour(padded, pw, ph, x, y, visited);
                if (contour && contour.length > 4) {
                    // Offset back from padding
                    const adjusted = contour.map(p => ({ x: p.x - 1, y: p.y - 1 }));
                    contours.push(adjusted);
                }
            }
        }

        // Return the longest contour (main silhouette) and any significant inner ones
        contours.sort((a, b) => b.length - a.length);
        return contours.filter(c => c.length > 10);
    }

    _cellValue(grid, w, x, y) {
        const tl = grid[y * w + x] ? 8 : 0;
        const tr = grid[y * w + x + 1] ? 4 : 0;
        const br = grid[(y + 1) * w + x + 1] ? 2 : 0;
        const bl = grid[(y + 1) * w + x] ? 1 : 0;
        return tl | tr | br | bl;
    }

    _traceContour(grid, w, h, startX, startY, visited) {
        const points = [];
        let x = startX, y = startY;
        let dir = 0; // 0=right,1=down,2=left,3=up
        const maxSteps = w * h * 2;

        for (let step = 0; step < maxSteps; step++) {
            const cellIdx = y * (w - 1) + x;
            const cell = this._cellValue(grid, w, x, y);

            if (cell === 0 || cell === 15) break;
            visited[cellIdx] = 1;

            // Interpolation point for this cell
            const px = x, py = y;
            let point = null;

            switch (cell) {
                case 1:  point = { x: px, y: py + 0.5 }; dir = 2; break;
                case 2:  point = { x: px + 0.5, y: py + 1 }; dir = 0; break;
                case 3:  point = { x: px, y: py + 0.5 }; dir = 2; break; // corrected: go left... actually:
                case 4:  point = { x: px + 1, y: py + 0.5 }; dir = 0; break;
                case 5:  // Saddle
                    point = { x: px + 0.5, y: py }; dir = (dir === 2) ? 3 : 1; break;
                case 6:  point = { x: px + 0.5, y: py + 1 }; dir = 1; break;
                case 7:  point = { x: px, y: py + 0.5 }; dir = 2; break;
                case 8:  point = { x: px + 0.5, y: py }; dir = 3; break;
                case 9:  point = { x: px + 0.5, y: py }; dir = 3; break;
                case 10: // Saddle
                    point = { x: px + 1, y: py + 0.5 }; dir = (dir === 3) ? 0 : 2; break;
                case 11: point = { x: px + 0.5, y: py }; dir = 3; break;
                case 12: point = { x: px + 1, y: py + 0.5 }; dir = 0; break;
                case 13: point = { x: px + 1, y: py + 0.5 }; dir = 0; break;
                case 14: point = { x: px + 0.5, y: py + 1 }; dir = 1; break;
                default: break;
            }

            if (point) points.push(point);

            // Move in direction
            switch (dir) {
                case 0: x++; break;
                case 1: y++; break;
                case 2: x--; break;
                case 3: y--; break;
            }

            // Bounds check
            if (x < 0 || x >= w - 1 || y < 0 || y >= h - 1) break;

            // Back to start?
            if (x === startX && y === startY && step > 2) break;
        }

        return points;
    }

    /**
     * Simplify a contour using Douglas-Peucker algorithm.
     * @param {Array<{x:number,y:number}>} points
     * @param {number} epsilon tolerance
     * @returns {Array<{x:number,y:number}>}
     */
    simplify(points, epsilon = 1.5) {
        if (points.length < 3) return points;

        let maxDist = 0;
        let maxIdx = 0;
        const first = points[0];
        const last = points[points.length - 1];

        for (let i = 1; i < points.length - 1; i++) {
            const d = this._pointLineDistance(points[i], first, last);
            if (d > maxDist) {
                maxDist = d;
                maxIdx = i;
            }
        }

        if (maxDist > epsilon) {
            const left = this.simplify(points.slice(0, maxIdx + 1), epsilon);
            const right = this.simplify(points.slice(maxIdx), epsilon);
            return left.slice(0, -1).concat(right);
        }

        return [first, last];
    }

    _pointLineDistance(p, a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
        const projX = a.x + t * dx;
        const projY = a.y + t * dy;
        return Math.hypot(p.x - projX, p.y - projY);
    }

    /**
     * Smooth contour with Chaikin's corner cutting (2 iterations).
     * @param {Array<{x:number,y:number}>} points
     * @param {number} iterations
     * @returns {Array<{x:number,y:number}>}
     */
    smooth(points, iterations = 2) {
        let pts = points;
        for (let iter = 0; iter < iterations; iter++) {
            const newPts = [];
            for (let i = 0; i < pts.length; i++) {
                const j = (i + 1) % pts.length;
                const p0 = pts[i];
                const p1 = pts[j];
                newPts.push({
                    x: 0.75 * p0.x + 0.25 * p1.x,
                    y: 0.75 * p0.y + 0.25 * p1.y
                });
                newPts.push({
                    x: 0.25 * p0.x + 0.75 * p1.x,
                    y: 0.25 * p0.y + 0.75 * p1.y
                });
            }
            pts = newPts;
        }
        return pts;
    }
}
