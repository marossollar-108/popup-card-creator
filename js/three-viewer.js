/**
 * Three.js 3D pop-up card viewer with open/close animation.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class ThreeViewer {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.cardGroup = null;
        this.layerMeshes = [];
        this.leftHalf = null;
        this.rightHalf = null;
        this.openAngle = Math.PI / 2; // 90 degrees default
        this.animating = false;
        this.animDir = 1;
        this.layers = [];
        this.colors = [];
        this.imageWidth = 0;
        this.imageHeight = 0;

        this._init();
        this._animate();
    }

    _init() {
        const container = this.canvas.parentElement;
        const w = container.clientWidth;
        const h = container.clientHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);

        this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
        this.camera.position.set(0, 8, 12);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Lighting
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(5, 10, 7);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.set(1024, 1024);
        dirLight.shadow.camera.near = 0.1;
        dirLight.shadow.camera.far = 50;
        dirLight.shadow.camera.left = -10;
        dirLight.shadow.camera.right = 10;
        dirLight.shadow.camera.top = 10;
        dirLight.shadow.camera.bottom = -10;
        this.scene.add(dirLight);

        // Ground plane (subtle)
        const groundGeo = new THREE.PlaneGeometry(30, 30);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x111122,
            roughness: 0.9
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.05;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Controls
        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.minDistance = 3;
        this.controls.maxDistance = 30;
        this.controls.target.set(0, 2, 0);

        // Handle resize
        this._resizeObserver = new ResizeObserver(() => this._onResize());
        this._resizeObserver.observe(container);
    }

    _onResize() {
        const container = this.canvas.parentElement;
        const w = container.clientWidth;
        const h = container.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    _animate() {
        requestAnimationFrame(() => this._animate());

        if (this.animating) {
            this.openAngle += this.animDir * 0.015;
            if (this.openAngle >= Math.PI) {
                this.openAngle = Math.PI;
                this.animDir = -1;
            } else if (this.openAngle <= 0) {
                this.openAngle = 0;
                this.animDir = 1;
            }
            this._updateCardAngle();
            // Dispatch event so UI slider updates
            this.canvas.dispatchEvent(new CustomEvent('anglechange', { detail: this.openAngle }));
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Build the 3D pop-up card from layer contours.
     * @param {Array} layers - from LayerGenerator
     * @param {number} w - image width
     * @param {number} h - image height
     * @param {string[]} colors - hex colors for each layer
     */
    buildCard(layers, w, h, colors) {
        this.layers = layers;
        this.colors = colors;
        this.imageWidth = w;
        this.imageHeight = h;

        // Remove old card
        if (this.cardGroup) {
            this.scene.remove(this.cardGroup);
            this.cardGroup.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }

        this.cardGroup = new THREE.Group();
        this.layerMeshes = [];

        // Scale factor: normalize to about 8 units wide
        const scale = 8 / Math.max(w, h);
        const cardW = w * scale;
        const cardH = h * scale;

        // Card base - two halves that open like a book
        const halfW = cardW / 2;
        const cardMat = new THREE.MeshStandardMaterial({
            color: 0xf5f0e8,
            roughness: 0.8,
            metalness: 0.0,
            side: THREE.DoubleSide
        });

        // Left half: pivots around the center fold (z-axis)
        const leftGeo = new THREE.PlaneGeometry(halfW, cardH);
        leftGeo.translate(-halfW / 2, 0, 0); // pivot at right edge
        this.leftHalf = new THREE.Mesh(leftGeo, cardMat.clone());
        this.leftHalf.castShadow = true;
        this.leftHalf.receiveShadow = true;

        // Right half
        const rightGeo = new THREE.PlaneGeometry(halfW, cardH);
        rightGeo.translate(halfW / 2, 0, 0); // pivot at left edge
        this.rightHalf = new THREE.Mesh(rightGeo, cardMat.clone());
        this.rightHalf.castShadow = true;
        this.rightHalf.receiveShadow = true;

        this.cardGroup.add(this.leftHalf);
        this.cardGroup.add(this.rightHalf);

        // Build layers from contours
        const layerSpacing = 0.6; // spacing between layers in Y
        const paperThickness = 0.05;

        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            if (!layer.simplified || layer.simplified.length === 0) continue;

            // Use the largest contour
            const contour = layer.simplified[0];
            if (!contour || contour.length < 3) continue;

            const color = colors[i] || '#ffffff';
            const layerY = (i + 1) * layerSpacing;

            const shape = new THREE.Shape();
            // Convert pixel coords to world coords, centered
            const pts = contour.map(p => ({
                x: (p.x - w / 2) * scale,
                y: -(p.y - h / 2) * scale  // flip Y
            }));

            shape.moveTo(pts[0].x, pts[0].y);
            for (let j = 1; j < pts.length; j++) {
                shape.lineTo(pts[j].x, pts[j].y);
            }
            shape.closePath();

            const extrudeSettings = {
                depth: paperThickness,
                bevelEnabled: false
            };

            const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            const mat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(color),
                roughness: 0.7,
                metalness: 0.0,
                side: THREE.DoubleSide
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.castShadow = true;

            // Store layer info for animation
            mesh.userData = {
                layerIndex: i,
                layerY: layerY,
                totalLayers: layers.length
            };

            this.layerMeshes.push(mesh);
            this.cardGroup.add(mesh);
        }

        this.scene.add(this.cardGroup);
        this._updateCardAngle();
    }

    /**
     * Update the card opening angle and position all elements.
     */
    _updateCardAngle() {
        if (!this.leftHalf) return;

        const halfAngle = this.openAngle / 2;

        // Left half rotates around center fold
        this.leftHalf.rotation.set(0, 0, 0);
        this.leftHalf.rotation.x = -(Math.PI / 2 - halfAngle);
        this.leftHalf.position.set(0, 0, 0);

        // Right half mirrors
        this.rightHalf.rotation.set(0, 0, 0);
        this.rightHalf.rotation.x = (Math.PI / 2 - halfAngle);
        this.rightHalf.position.set(0, 0, 0);

        // Layers rise up perpendicular to the card halves
        // When fully open (180°), layers lie flat on back half
        // When at 90°, layers stand straight up
        // When closed (0°), layers fold flat inside

        for (const mesh of this.layerMeshes) {
            const { layerY, layerIndex, totalLayers } = mesh.userData;
            // Layers stand up from the fold, leaning with the opening
            const layerAngle = Math.PI / 2; // layers are perpendicular to fold

            mesh.rotation.set(0, 0, 0);
            mesh.position.set(0, 0, 0);

            // Position: layers rise up from the fold line
            // Y = how high the layer goes (based on angle)
            const riseHeight = layerY * Math.sin(halfAngle);
            const foldDepth = layerY * Math.cos(halfAngle) * 0.1;

            mesh.position.y = riseHeight;
            mesh.position.z = foldDepth;

            // Slight spread in Z for depth perception
            mesh.position.z += (layerIndex / totalLayers) * 0.15 * Math.sin(this.openAngle);
        }
    }

    /**
     * Set the opening angle in radians.
     * @param {number} angle
     */
    setOpenAngle(angle) {
        this.openAngle = angle;
        this._updateCardAngle();
    }

    /**
     * Toggle animation.
     * @returns {boolean} new animating state
     */
    toggleAnimation() {
        this.animating = !this.animating;
        return this.animating;
    }

    /**
     * Update layer colors.
     * @param {string[]} colors
     */
    updateColors(colors) {
        this.colors = colors;
        for (let i = 0; i < this.layerMeshes.length; i++) {
            if (colors[i]) {
                this.layerMeshes[i].material.color.set(colors[i]);
            }
        }
    }

    /**
     * Dispose and clean up.
     */
    dispose() {
        this._resizeObserver.disconnect();
        this.renderer.dispose();
    }
}
