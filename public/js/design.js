// A small Tinkercad-style editor: add shapes, move/rotate/stretch them,
// mark some as holes, group them together, then export an STL to print.
// Units are millimeters and Z points up, which is what slicers expect.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { Brush, Evaluator, ADDITION, SUBTRACTION } from 'three-bvh-csg';

const SAVE_KEY = 'design-autosave';
const BED_SIZE = 200; // the workplane is 200mm x 200mm
const MAX_UNDO = 50;

const viewport = document.querySelector('#viewport');
const statusBox = document.querySelector('#design-status');

// ==========================================
// SCENE SETUP
// ==========================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeef1f5);

const camera = new THREE.PerspectiveCamera(45, 1, 1, 5000);
camera.up.set(0, 0, 1);
camera.position.set(120, -180, 150);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
viewport.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 2));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(80, -120, 200);
scene.add(sun);

// The blue workplane with a 10mm grid on it
const bed = new THREE.Mesh(
    new THREE.PlaneGeometry(BED_SIZE, BED_SIZE),
    new THREE.MeshBasicMaterial({ color: 0xdde8f7 })
);
bed.position.z = -0.05;
scene.add(bed);

const grid = new THREE.GridHelper(BED_SIZE, BED_SIZE / 10, 0x7d97c0, 0xb4c6e2);
grid.rotation.x = Math.PI / 2; // GridHelper lies flat on Y-up; turn it for Z-up
scene.add(grid);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;

const transform = new TransformControls(camera, renderer.domElement);
transform.setTranslationSnap(1);
transform.setRotationSnap(THREE.MathUtils.degToRad(15));
transform.setSize(0.75);
scene.add(transform.getHelper());

// Keeps the canvas the same size as its box, including on window resize
new ResizeObserver(() => {
    const { clientWidth, clientHeight } = viewport;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
}).observe(viewport);

renderer.setAnimationLoop(() => {
    orbit.update();
    renderer.render(scene, camera);
});

// ==========================================
// SHAPES
// ==========================================

// Every shape on the workplane, in the order they were added
const shapes = [];
let selected = [];

// Loading the font can fail (e.g. offline); the rest still works without it
let font = null;
try {
    font = await new FontLoader().loadAsync('/fonts/helvetiker_bold.typeface.json');
} catch (err) {
    document.querySelector('[data-add="text"]').disabled = true;
}

// Builds the starting geometry for a shape, about 20mm across and
// centered on its own origin. Cylinders and cones are built along Y,
// so they get turned to stand up along Z.
function makeGeometry(kind, text) {
    let geometry;
    if (kind === 'box') {
        geometry = new THREE.BoxGeometry(20, 20, 20);
    } else if (kind === 'cylinder') {
        geometry = new THREE.CylinderGeometry(10, 10, 20, 48).rotateX(Math.PI / 2);
    } else if (kind === 'sphere') {
        geometry = new THREE.SphereGeometry(10, 48, 24);
    } else if (kind === 'cone') {
        geometry = new THREE.CylinderGeometry(0, 10, 20, 48).rotateX(Math.PI / 2);
    } else if (kind === 'torus') {
        geometry = new THREE.TorusGeometry(10, 3, 24, 64);
    } else if (kind === 'text') {
        geometry = new TextGeometry(text || ' ', {
            font,
            size: 10,
            depth: 4,
            curveSegments: 6
        });
    } else {
        throw new Error('Unknown shape: ' + kind);
    }
    geometry.center();
    geometry.computeBoundingBox();
    return geometry;
}

const holeMaterialSettings = { color: 0x888888, transparent: true, opacity: 0.4, depthWrite: false };

function makeMaterial(color, hole) {
    if (hole) return new THREE.MeshStandardMaterial(holeMaterialSettings);
    return new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
}

// A "record" is a plain description of a shape, used for undo and saving.
// Geometry is never changed after it's made, so records can share it.
function toRecord(mesh) {
    return {
        kind: mesh.userData.kind,
        text: mesh.userData.text,
        geometry: mesh.geometry,
        position: mesh.position.toArray(),
        quaternion: mesh.quaternion.toArray(),
        scale: mesh.scale.toArray(),
        color: mesh.userData.color,
        hole: mesh.userData.hole
    };
}

function fromRecord(record) {
    const geometry = record.geometry || makeGeometry(record.kind, record.text);
    geometry.computeBoundingBox();
    const mesh = new THREE.Mesh(geometry, makeMaterial(record.color, record.hole));
    mesh.position.fromArray(record.position);
    mesh.quaternion.fromArray(record.quaternion);
    mesh.scale.fromArray(record.scale);
    mesh.userData = {
        kind: record.kind,
        text: record.text,
        color: record.color,
        hole: record.hole
    };
    scene.add(mesh);
    shapes.push(mesh);
    return mesh;
}

function removeShape(mesh) {
    scene.remove(mesh);
    mesh.material.dispose();
    shapes.splice(shapes.indexOf(mesh), 1);
}

// Moves a shape straight down (or up) so its lowest point sits on the workplane
function dropToFloor(mesh) {
    mesh.updateMatrixWorld();
    const box = new THREE.Box3().setFromObject(mesh, true);
    mesh.position.z -= box.min.z;
}

// Random-ish bright colors so new shapes are easy to tell apart
const PALETTE = ['#e4572e', '#29a3a3', '#f3a712', '#669bbc', '#a8c256', '#c46bd1'];
let nextColor = 0;

function addShape(kind) {
    saveUndo();
    const text = kind === 'text' ? 'Hi' : undefined;
    const mesh = fromRecord({
        kind,
        text,
        position: [0, 0, 0],
        quaternion: [0, 0, 0, 1],
        scale: [1, 1, 1],
        color: PALETTE[nextColor++ % PALETTE.length],
        hole: false
    });
    dropToFloor(mesh);
    select([mesh]);
    changed();
    if (kind === 'text') document.querySelector('#text-input').select();
}

// ==========================================
// SELECTION
// ==========================================

function select(meshes) {
    for (const mesh of selected) mesh.material.emissive.setHex(0x000000);
    selected = meshes;
    for (const mesh of selected) mesh.material.emissive.setHex(0x333333);

    // The move/rotate/stretch handles only work on one shape at a time
    if (selected.length === 1) {
        transform.attach(selected[0]);
    } else {
        transform.detach();
    }
    showProperties();
}

// Picking: a click that didn't turn into a drag selects what's under it
const pointerStart = new THREE.Vector2();
let pointerOnHandle = false;

renderer.domElement.addEventListener('pointerdown', (event) => {
    pointerStart.set(event.clientX, event.clientY);
    pointerOnHandle = transform.axis !== null;
});

renderer.domElement.addEventListener('pointerup', (event) => {
    const moved = pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY));
    if (moved > 5 || pointerOnHandle) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(shapes, false)[0];

    if (!hit) {
        if (!event.shiftKey) select([]);
    } else if (event.shiftKey) {
        // Shift-click adds the shape, or takes it away if already picked
        const already = selected.includes(hit.object);
        select(already ? selected.filter((m) => m !== hit.object) : [...selected, hit.object]);
    } else {
        select([hit.object]);
    }
});

// While dragging a handle, stop the camera from orbiting too
transform.addEventListener('dragging-changed', (event) => {
    orbit.enabled = !event.value;
    if (event.value) {
        saveUndo();
    } else {
        changed();
    }
});
transform.addEventListener('objectChange', showProperties);

document.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
        transform.setMode(button.dataset.mode);
        document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b === button));
    });
});

// ==========================================
// PROPERTIES PANEL
// ==========================================

const propsForm = document.querySelector('#props-form');
const sizeInputs = ['x', 'y', 'z'].map((axis) => document.querySelector('#size-' + axis));
const textLabel = document.querySelector('#text-label');
const textInput = document.querySelector('#text-input');
const colorInput = document.querySelector('#color-input');
const holeInput = document.querySelector('#hole-input');
const selectionCount = document.querySelector('#selection-count');

function baseSize(mesh) {
    return mesh.geometry.boundingBox.getSize(new THREE.Vector3());
}

function showProperties() {
    const single = selected.length === 1 ? selected[0] : null;
    propsForm.hidden = !single;
    document.querySelector('#no-selection').hidden = selected.length > 0;
    selectionCount.hidden = selected.length < 2;
    selectionCount.textContent = `${selected.length} shapes picked. Press Group to join them.`;
    if (!single) return;

    const size = baseSize(single).multiply(single.scale);
    sizeInputs.forEach((input, i) => {
        // Don't overwrite a box while someone is typing in it
        if (document.activeElement !== input) {
            input.value = Math.round(size.getComponent(i) * 10) / 10;
        }
    });
    textLabel.hidden = single.userData.kind !== 'text';
    textInput.value = single.userData.text || '';
    colorInput.value = single.userData.color;
    colorInput.disabled = single.userData.hole;
    holeInput.checked = single.userData.hole;
}

sizeInputs.forEach((input, i) => {
    input.addEventListener('change', () => {
        const mesh = selected[0];
        const value = parseFloat(input.value);
        if (!mesh || !(value > 0)) return showProperties();
        saveUndo();
        mesh.scale.setComponent(i, value / baseSize(mesh).getComponent(i));
        changed();
    });
});

textInput.addEventListener('change', () => {
    const mesh = selected[0];
    if (!mesh || !textInput.value.trim()) return showProperties();
    saveUndo();
    mesh.userData.text = textInput.value;
    mesh.geometry = makeGeometry('text', textInput.value);
    changed();
});

// The picker fires 'input' many times while dragging, so only the first
// one saves an undo step; 'change' fires once when the picker closes
let colorUndoSaved = false;
colorInput.addEventListener('input', () => {
    const mesh = selected[0];
    if (!mesh) return;
    if (!colorUndoSaved) {
        saveUndo();
        colorUndoSaved = true;
    }
    mesh.userData.color = colorInput.value;
    mesh.material.color.set(colorInput.value);
});
colorInput.addEventListener('change', () => {
    colorUndoSaved = false;
    changed();
});

holeInput.addEventListener('change', () => {
    const mesh = selected[0];
    if (!mesh) return;
    saveUndo();
    mesh.userData.hole = holeInput.checked;
    mesh.material.dispose();
    mesh.material = makeMaterial(mesh.userData.color, mesh.userData.hole);
    select([mesh]); // reapplies the selected glow to the new material
    changed();
});

// ==========================================
// TOOLS
// ==========================================

function setStatus(message) {
    statusBox.textContent = message;
}

function deleteSelected() {
    if (selected.length === 0) return;
    saveUndo();
    for (const mesh of selected) removeShape(mesh);
    select([]);
    changed();
}

function duplicateSelected() {
    if (selected.length === 0) return;
    saveUndo();
    const copies = selected.map((mesh) => {
        const copy = fromRecord(toRecord(mesh));
        copy.position.x += 10;
        copy.position.y += 10;
        return copy;
    });
    select(copies);
    changed();
}

// Turns a shape into a CSG "brush" with its move/rotate/stretch baked in,
// so every brush shares the same frame and the result lands in place
function toBrush(mesh) {
    mesh.updateMatrixWorld();
    let geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    geometry.clearGroups();
    geometry.deleteAttribute('uv');
    const brush = new Brush(geometry);
    brush.updateMatrixWorld();
    return brush;
}

// Joins the picked shapes into one: solids are merged together,
// then holes are cut out of them. If every shape is a hole, the
// result is one bigger hole.
function groupSelected() {
    if (selected.length < 2) {
        return setStatus('Shift-click to pick at least two shapes, then press Group.');
    }
    const solids = selected.filter((m) => !m.userData.hole);
    const holes = selected.filter((m) => m.userData.hole);
    const allHoles = solids.length === 0;
    const adders = allHoles ? holes : solids;
    const cutters = allHoles ? [] : holes;

    setStatus('Grouping...');
    let result;
    try {
        const evaluator = new Evaluator();
        evaluator.attributes = ['position', 'normal'];
        evaluator.useGroups = false;

        result = toBrush(adders[0]);
        for (const mesh of adders.slice(1)) {
            result = evaluator.evaluate(result, toBrush(mesh), ADDITION);
        }
        for (const mesh of cutters) {
            result = evaluator.evaluate(result, toBrush(mesh), SUBTRACTION);
        }
    } catch (err) {
        console.error(err);
        return setStatus('Those shapes could not be grouped. Try moving them a little.');
    }

    // Move the geometry's center to its own origin, so the handles sit in the middle
    const geometry = result.geometry;
    geometry.computeBoundingBox();
    const center = geometry.boundingBox.getCenter(new THREE.Vector3());
    geometry.translate(-center.x, -center.y, -center.z);

    saveUndo();
    for (const mesh of selected) removeShape(mesh);
    const grouped = fromRecord({
        kind: 'group',
        geometry,
        position: center.toArray(),
        quaternion: [0, 0, 0, 1],
        scale: [1, 1, 1],
        color: adders[0].userData.color,
        hole: allHoles
    });
    select([grouped]);
    changed();
    setStatus('Grouped!');
}

document.querySelectorAll('[data-add]').forEach((button) => {
    button.addEventListener('click', () => addShape(button.dataset.add));
});
document.querySelector('#delete-button').addEventListener('click', deleteSelected);
document.querySelector('#duplicate-button').addEventListener('click', duplicateSelected);
document.querySelector('#group-button').addEventListener('click', groupSelected);
document.querySelector('#undo-button').addEventListener('click', undo);
document.querySelector('#drop-button').addEventListener('click', () => {
    if (selected.length === 0) return;
    saveUndo();
    selected.forEach(dropToFloor);
    changed();
});
document.querySelector('#clear-button').addEventListener('click', () => {
    if (shapes.length === 0 || !confirm('Remove every shape and start over?')) return;
    saveUndo();
    for (const mesh of [...shapes]) removeShape(mesh);
    select([]);
    changed();
});

window.addEventListener('keydown', (event) => {
    // Leave keys alone while someone types in a box
    if (event.target.closest('input, textarea')) return;

    if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelected();
    } else if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        event.preventDefault();
        undo();
    } else if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
        event.preventDefault();
        duplicateSelected();
    }
});

// ==========================================
// UNDO AND AUTOSAVE
// ==========================================

const undoStack = [];

function saveUndo() {
    undoStack.push(shapes.map(toRecord));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
}

function restore(records) {
    select([]);
    for (const mesh of [...shapes]) removeShape(mesh);
    records.forEach(fromRecord);
}

function undo() {
    if (undoStack.length === 0) return setStatus('Nothing to undo.');
    restore(undoStack.pop());
    autosave();
}

// Runs after every edit
function changed() {
    showProperties();
    autosave();
}

// Keeps the design in this browser, so a refresh doesn't lose it.
// Plain shapes are saved as their kind; grouped ones need their geometry.
function autosave() {
    const records = shapes.map((mesh) => {
        const record = toRecord(mesh);
        record.geometry = record.kind === 'group' ? record.geometry.toJSON() : undefined;
        return record;
    });
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(records));
    } catch (err) {
        setStatus('Design is too big to autosave. Download it to keep a copy.');
    }
}

function loadAutosave() {
    try {
        const records = JSON.parse(localStorage.getItem(SAVE_KEY) || '[]');
        const loader = new THREE.BufferGeometryLoader();
        for (const record of records) {
            if (record.kind === 'text' && !font) continue;
            if (record.geometry) record.geometry = loader.parse(record.geometry);
            fromRecord(record);
        }
    } catch (err) {
        console.error('Could not load the saved design:', err);
    }
}

// ==========================================
// EXPORTING AND SENDING
// ==========================================

// Makes a binary STL of every solid shape. Holes that were never
// grouped don't cut anything, so they are left out (like Tinkercad).
function exportSTL() {
    const solids = shapes.filter((m) => !m.userData.hole);
    if (solids.length === 0) return null;

    const group = new THREE.Group();
    for (const mesh of solids) group.add(mesh.clone());
    group.updateMatrixWorld(true);
    return new STLExporter().parse(group, { binary: true });
}

document.querySelector('#download-button').addEventListener('click', () => {
    const stl = exportSTL();
    if (!stl) return setStatus('Add a solid shape first.');

    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([stl], { type: 'model/stl' }));
    link.download = 'my-design.stl';
    link.click();
    URL.revokeObjectURL(link.href);
});

const submitDialog = document.querySelector('#submit-dialog');
const submitForm = document.querySelector('#submit-form');
const submitMessage = document.querySelector('#submit-message');

document.querySelector('#submit-open-button').addEventListener('click', () => {
    if (!shapes.some((m) => !m.userData.hole)) return setStatus('Add a solid shape first.');
    submitMessage.textContent = '';
    submitDialog.showModal();
});
document.querySelector('#submit-cancel').addEventListener('click', () => submitDialog.close());

submitForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const stl = exportSTL();
    if (!stl) return;

    // The model goes in the body; the details ride along in the address
    const params = new URLSearchParams({
        name: document.querySelector('#submit-name').value,
        contact: document.querySelector('#submit-contact').value,
        note: document.querySelector('#submit-note').value
    });

    submitMessage.textContent = 'Sending...';
    try {
        const response = await fetch('/api/designs?' + params, {
            method: 'POST',
            headers: { 'Content-Type': 'model/stl' },
            body: stl
        });
        const data = await response.json();
        if (!response.ok) {
            submitMessage.textContent = data.error || 'Could not send your design.';
            return;
        }
        submitDialog.close();
        setStatus('Sent! Thanks, your design is on its way to the printer.');
    } catch (err) {
        submitMessage.textContent = 'Could not reach the server. Try again.';
    }
});

loadAutosave();
showProperties();
