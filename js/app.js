/**
 * Main application: wires UI to processing pipeline.
 */

import { ImageProcessor } from './image-processor.js';
import { LayerGenerator } from './layer-generator.js';
import { SvgExporter } from './svg-exporter.js';

// ---- Modules ----
const imageProcessor = new ImageProcessor();
const layerGenerator = new LayerGenerator();
const svgExporter = new SvgExporter();
let viewer = null;
let ThreeViewer = null;

// ---- State ----
let currentLayers = null;
let imageLoaded = false;
let clickPointForBg = null;

// ---- Default layer colors ----
const defaultColors = [
    '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
    '#3498db', '#9b59b6', '#1abc9c', '#e91e63'
];

// ---- DOM Elements ----
const fileInput = document.getElementById('file-input');
const btnUpload = document.getElementById('btn-upload');
const btnExport = document.getElementById('btn-export');
const btnGenerate = document.getElementById('btn-generate');
const btnAnimate = document.getElementById('btn-animate');
const dropZone = document.getElementById('drop-zone');
const dropHint = document.getElementById('drop-hint');
const sourceCanvas = document.getElementById('source-canvas');
const threeCanvas = document.getElementById('three-canvas');
const viewerPlaceholder = document.getElementById('viewer-placeholder');
const layersStrip = document.getElementById('layers-strip');

const bgMethodSelect = document.getElementById('bg-method');
const thresholdSlider = document.getElementById('threshold');
const thresholdVal = document.getElementById('threshold-val');
const layerCountSlider = document.getElementById('layer-count');
const layersVal = document.getElementById('layers-val');
const erosionSlider = document.getElementById('erosion-strength');
const erosionVal = document.getElementById('erosion-val');
const openAngleSlider = document.getElementById('open-angle');
const openAngleVal = document.getElementById('open-angle-val');
const colorPickersDiv = document.getElementById('color-pickers');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

// ---- Initialize color pickers ----
function initColorPickers(count) {
    colorPickersDiv.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = defaultColors[i % defaultColors.length];
        input.title = `Vrstva ${i + 1}`;
        input.dataset.layer = i;
        input.addEventListener('input', onColorChange);
        colorPickersDiv.appendChild(input);
    }
}

function getColors() {
    const inputs = colorPickersDiv.querySelectorAll('input[type="color"]');
    return Array.from(inputs).map(inp => inp.value);
}

// ---- Event Handlers ----

// Upload button
btnUpload.addEventListener('click', () => fileInput.click());

// File input
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        loadFile(e.target.files[0]);
    }
});

// Drag & drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        loadFile(e.dataTransfer.files[0]);
    }
});

// Click on drop zone to upload
dropZone.addEventListener('click', (e) => {
    if (!imageLoaded) {
        fileInput.click();
        return;
    }
    // If click-method is selected, pick background color
    if (bgMethodSelect.value === 'click') {
        const rect = sourceCanvas.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) * (sourceCanvas.width / rect.width));
        const y = Math.round((e.clientY - rect.top) * (sourceCanvas.height / rect.height));
        clickPointForBg = { x: Math.max(0, Math.min(x, sourceCanvas.width - 1)),
                            y: Math.max(0, Math.min(y, sourceCanvas.height - 1)) };
        generateMask();
    }
});

// Sliders
thresholdSlider.addEventListener('input', () => {
    thresholdVal.textContent = thresholdSlider.value;
    if (imageLoaded) generateMask();
});

layerCountSlider.addEventListener('input', () => {
    layersVal.textContent = layerCountSlider.value;
    initColorPickers(parseInt(layerCountSlider.value));
});

erosionSlider.addEventListener('input', () => {
    erosionVal.textContent = erosionSlider.value;
});

openAngleSlider.addEventListener('input', () => {
    const deg = parseInt(openAngleSlider.value);
    openAngleVal.textContent = deg + '°';
    if (viewer) {
        viewer.setOpenAngle(deg * Math.PI / 180);
    }
});

// Background method change
bgMethodSelect.addEventListener('change', () => {
    if (imageLoaded && bgMethodSelect.value !== 'click') {
        clickPointForBg = null;
        generateMask();
    }
});

// Generate button
btnGenerate.addEventListener('click', generateLayers);

// Animate button
btnAnimate.addEventListener('click', () => {
    if (!viewer) return;
    const isAnimating = viewer.toggleAnimation();
    btnAnimate.innerHTML = isAnimating ? '&#9724; Stop' : '&#9654; Animácia';
});

// Color change
function onColorChange() {
    if (viewer && currentLayers) {
        viewer.updateColors(getColors());
    }
    updateLayerPreviews();
}

// Export
btnExport.addEventListener('click', async () => {
    if (!currentLayers) return;
    btnExport.textContent = 'Exportujem...';
    btnExport.disabled = true;
    try {
        const blob = await svgExporter.exportZip(
            currentLayers,
            imageProcessor.width,
            imageProcessor.height
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'popup-card-layers.zip';
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Export failed:', err);
        alert('Export zlyhal: ' + err.message);
    }
    btnExport.textContent = 'Exportovať SVG';
    btnExport.disabled = false;
});

// Listen for angle change from animation
threeCanvas.addEventListener('anglechange', (e) => {
    const deg = Math.round(e.detail * 180 / Math.PI);
    openAngleSlider.value = deg;
    openAngleVal.textContent = deg + '°';
});

// ---- Core Functions ----

async function loadFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('Prosím nahrajte obrázok (PNG, JPG, atď.)');
        return;
    }

    try {
        await imageProcessor.loadImage(file, sourceCanvas);
        imageLoaded = true;
        dropZone.classList.add('has-image');
        btnGenerate.disabled = false;
        clickPointForBg = null;
        generateMask();
    } catch (err) {
        console.error('Image load failed:', err);
        alert('Nepodarilo sa načítať obrázok.');
    }
}

function generateMask() {
    if (!imageLoaded) return;

    const method = bgMethodSelect.value;
    const tolerance = parseInt(thresholdSlider.value);

    imageProcessor.generateMask(method, tolerance, clickPointForBg);

    // Show mask on source canvas
    imageProcessor.renderMask(imageProcessor.mask, sourceCanvas);
}

/** Yield to the browser so it can repaint. */
function yieldToUI() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

function showProgress(percent, text) {
    progressBar.hidden = false;
    if (percent < 0) {
        // Indeterminate
        progressFill.style.width = '';
        progressFill.classList.add('indeterminate');
    } else {
        progressFill.classList.remove('indeterminate');
        progressFill.style.width = percent + '%';
    }
    progressText.textContent = text;
}

function hideProgress() {
    progressBar.hidden = true;
    progressFill.classList.remove('indeterminate');
    progressFill.style.width = '0%';
}

async function generateLayers() {
    if (!imageLoaded || !imageProcessor.mask) {
        generateMask();
    }

    const layerCount = parseInt(layerCountSlider.value);
    const erosionStrength = parseInt(erosionSlider.value);

    // Disable button during generation
    btnGenerate.disabled = true;
    btnGenerate.textContent = 'Generujem...';

    showProgress(5, 'Pripravujem masku...');
    await yieldToUI();

    showProgress(15, 'Erózia vrstiev...');
    await yieldToUI();

    currentLayers = layerGenerator.generate(
        imageProcessor.mask,
        imageProcessor.width,
        imageProcessor.height,
        layerCount,
        erosionStrength,
        // Progress callback
        (layerIdx, total) => {
            const pct = 15 + Math.round((layerIdx / total) * 50);
            showProgress(pct, `Erózia vrstva ${layerIdx + 1} / ${total}...`);
        }
    );

    await yieldToUI();

    if (currentLayers.length === 0) {
        hideProgress();
        btnGenerate.disabled = false;
        btnGenerate.textContent = 'Generovať vrstvy';
        alert('Nepodarilo sa vygenerovať vrstvy. Skúste upraviť toleranciu alebo silu erózie.');
        return;
    }

    showProgress(70, 'Generujem náhľady vrstiev...');
    await yieldToUI();

    // Ensure color picker count matches actual layer count
    initColorPickers(currentLayers.length);

    // Update layer previews
    updateLayerPreviews();

    showProgress(85, 'Staviam 3D model...');
    await yieldToUI();

    // Build 3D view (lazy-load Three.js only when needed)
    if (!viewer) {
        if (!ThreeViewer) {
            const module = await import('./three-viewer.js');
            ThreeViewer = module.ThreeViewer;
        }
        viewer = new ThreeViewer(threeCanvas);
    }
    viewerPlaceholder.style.display = 'none';

    viewer.buildCard(
        currentLayers,
        imageProcessor.width,
        imageProcessor.height,
        getColors()
    );

    // Set initial angle
    const deg = parseInt(openAngleSlider.value);
    viewer.setOpenAngle(deg * Math.PI / 180);

    showProgress(100, 'Hotovo!');
    await yieldToUI();

    // Hide progress after a short delay
    setTimeout(() => hideProgress(), 800);

    btnExport.disabled = false;
    btnGenerate.disabled = false;
    btnGenerate.textContent = 'Generovať vrstvy';
}

function updateLayerPreviews() {
    if (!currentLayers) return;
    const colors = getColors();

    layersStrip.innerHTML = '';

    for (let i = 0; i < currentLayers.length; i++) {
        const div = document.createElement('div');
        div.className = 'layer-thumb';

        const canvas = document.createElement('canvas');
        layerGenerator.renderLayerPreview(
            currentLayers[i],
            imageProcessor.width,
            imageProcessor.height,
            canvas,
            colors[i] || '#ffffff'
        );

        const label = document.createElement('span');
        label.textContent = `Vrstva ${i + 1}`;

        div.appendChild(canvas);
        div.appendChild(label);
        layersStrip.appendChild(div);
    }
}

// ---- Init ----
initColorPickers(parseInt(layerCountSlider.value));
