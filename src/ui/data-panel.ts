import { BooleanInput, Container, Label } from '@playcanvas/pcui';
import { Mat4 } from 'playcanvas';

import { Element } from '../element';
import { Events } from '../events';
import { Splat } from '../splat';
import { Histogram } from './histogram';
import { localize } from './localization';

// gpu propMode constants. these must match the propMode dispatch in
// src/shaders/splat-value-shader.ts.
//
// modes 5..7 and 18..20 read the final on-screen color (DC + evaluated SH for
// the current view direction), so they are camera-dependent.
// modes 66..68 read the raw f_dc_N coefficients reconstructed from the
// already-decoded splatColor texture.
const PROP_MODE: { [key: string]: number } = {
    x: 0,
    y: 1,
    z: 2,
    distance: 3,
    'camera-depth': 4,
    red: 5,
    green: 6,
    blue: 7,
    opacity: 8,
    scale_0: 9,
    scale_1: 10,
    scale_2: 11,
    volume: 12,
    'surface-area': 13,
    rot_0: 14,
    rot_1: 15,
    rot_2: 16,
    rot_3: 17,
    hue: 18,
    saturation: 19,
    value: 20,
    f_dc_0: 66,
    f_dc_1: 67,
    f_dc_2: 68
};

// f_rest_N maps to mode (21 + N). max 45 SH coefficients (shBands 3).
const F_REST_BASE_MODE = 21;

const SH_NUM_COEFFS: { [k: number]: number } = { 0: 0, 1: 3, 2: 8, 3: 15 };

const propModeFor = (prop: string): number | undefined => {
    if (prop in PROP_MODE) return PROP_MODE[prop];
    const m = /^f_rest_(\d+)$/.exec(prop);
    if (m) return F_REST_BASE_MODE + parseInt(m[1], 10);
    return undefined;
};

// final-color (DC + evaluated SH for current view direction) — depends on
// world-space splat position, camera position and ColorGrade.
const isFinalColorMode = (mode: number) => {
    return (mode >= 5 && mode <= 7) || (mode >= 18 && mode <= 20);
};

// what kinds of state changes affect a given prop's histogram. mirrors the
// previous per-event filtering, but consulted only inside hash().
const isCameraDependentMode = (mode: number) => mode === 4 /* camera-depth */ || isFinalColorMode(mode);
const isPositionDependentMode = (mode: number) => {
    return mode === 0 || mode === 1 || mode === 2 || // x / y / z
        mode === 3 || mode === 4 ||                  // distance / camera-depth
        isFinalColorMode(mode);
};
// ColorGrade-dependent. f_dc_* (raw DC, modes 66..68) bypasses ColorGrade.
const isColorGradeDependentMode = (mode: number) => mode === 8 /* opacity */ || isFinalColorMode(mode);

// every input that can require a histogram refresh. subscribers update one
// field and call tick(); the hash collapses no-op changes into a fast path
// and lets the existing per-prop filtering live in pure hash().
type HistogramInputs = {
    splatId: number;
    mode: number;
    onScreenOnly: boolean;
    logScale: boolean;
    cameraVersion: number;
    stateVersion: number;
    colorGradeVersion: number;
    positionsVersion: number;
};

const hashInputs = (i: HistogramInputs): string => {
    const m = i.mode;
    const camMatters = i.onScreenOnly || isCameraDependentMode(m);
    const posMatters = isPositionDependentMode(m);
    const cgMatters = isColorGradeDependentMode(m);
    return `${i.splatId}|${m}|${i.onScreenOnly ? 1 : 0}|${i.logScale ? 1 : 0}|` +
        `${camMatters ? i.cameraVersion : 0}|${i.stateVersion}|` +
        `${cgMatters ? i.colorGradeVersion : 0}|${posMatters ? i.positionsVersion : 0}`;
};

class DataPanel extends Container {
    constructor(events: Events, args = { }) {
        args = {
            ...args,
            id: 'data-panel',
            hidden: true,
            flex: true,
            flexDirection: 'row'
        };

        super(args);

        // resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.id = 'data-panel-resize-handle';
        this.dom.appendChild(resizeHandle);

        let resizing = false;
        let startY = 0;
        let startHeight = 0;

        resizeHandle.addEventListener('pointerdown', (event: PointerEvent) => {
            if (event.isPrimary) {
                resizing = true;
                startY = event.clientY;
                startHeight = this.dom.offsetHeight;
                resizeHandle.setPointerCapture(event.pointerId);
                event.preventDefault();
            }
        });

        resizeHandle.addEventListener('pointermove', (event: PointerEvent) => {
            if (resizing) {
                const delta = startY - event.clientY;
                const newHeight = Math.max(120, Math.min(1000, startHeight + delta));
                this.dom.style.height = `${newHeight}px`;
            }
        });

        resizeHandle.addEventListener('pointerup', (event: PointerEvent) => {
            if (resizing && event.isPrimary) {
                resizeHandle.releasePointerCapture(event.pointerId);
            }
        });

        resizeHandle.addEventListener('lostpointercapture', () => {
            resizing = false;
        });

        // build the data controls
        const controlsContainer = new Container({
            id: 'data-controls-container'
        });

        const controls = new Container({
            id: 'data-controls'
        });

        // track the selected data property
        let selectedDataProp = 'x';

        // data list box
        const dataListBox = new Container({
            id: 'data-list-box'
        });

        const logScale = new Container({
            class: 'data-panel-toggle-row',
            flex: true,
            flexDirection: 'row'
        });

        const logScaleLabel = new Label({
            class: 'data-panel-toggle-label',
            text: localize('panel.splat-data.log-scale')
        });

        const logScaleValue = new BooleanInput({
            type: 'toggle',
            class: 'data-panel-toggle',
            value: false
        });

        logScale.append(logScaleLabel);
        logScale.append(logScaleValue);

        const showAll = new Container({
            class: 'data-panel-toggle-row',
            flex: true,
            flexDirection: 'row'
        });

        const showAllLabel = new Label({
            class: 'data-panel-toggle-label',
            text: localize('panel.splat-data.show-all')
        });

        const showAllValue = new BooleanInput({
            type: 'toggle',
            class: 'data-panel-toggle',
            value: false
        });

        showAll.append(showAllLabel);
        showAll.append(showAllValue);

        const onScreenOnly = new Container({
            class: 'data-panel-toggle-row',
            flex: true,
            flexDirection: 'row'
        });

        const onScreenOnlyLabel = new Label({
            class: 'data-panel-toggle-label',
            text: localize('panel.splat-data.on-screen-only')
        });

        const onScreenOnlyValue = new BooleanInput({
            type: 'toggle',
            class: 'data-panel-toggle',
            value: false
        });

        onScreenOnly.append(onScreenOnlyLabel);
        onScreenOnly.append(onScreenOnlyValue);

        const populateDataSelector = (splat: Splat) => {
            // default prop localizations - order defines display order. "red",
            // "green", "blue" and HSV here are the final on-screen color (DC
            // + evaluated SH for the current view direction).
            const localizations: any = {
                x: `${localize('panel.splat-data.position')} X`,
                y: `${localize('panel.splat-data.position')} Y`,
                z: `${localize('panel.splat-data.position')} Z`,
                opacity: localize('panel.splat-data.opacity'),
                red: localize('panel.splat-data.red'),
                green: localize('panel.splat-data.green'),
                blue: localize('panel.splat-data.blue'),
                scale_0: localize('panel.splat-data.scale-x'),
                scale_1: localize('panel.splat-data.scale-y'),
                scale_2: localize('panel.splat-data.scale-z'),
                rot_0: `${localize('panel.splat-data.quat')} W`,
                rot_1: `${localize('panel.splat-data.quat')} X`,
                rot_2: `${localize('panel.splat-data.quat')} Y`,
                rot_3: `${localize('panel.splat-data.quat')} Z`,
                distance: localize('panel.splat-data.distance'),
                'camera-depth': localize('panel.splat-data.camera-depth'),
                volume: localize('panel.splat-data.volume'),
                'surface-area': localize('panel.splat-data.surface-area'),
                hue: localize('panel.splat-data.hue'),
                saturation: localize('panel.splat-data.saturation'),
                value: localize('panel.splat-data.value')
            };

            // "Show All" extras: raw DC coefficients first, then spherical
            // harmonics coefficients labelled with their channel (R/G/B) and
            // within-channel index. all filtered by the splat's actual SH band
            // count so we never offer a mode the GPU shader can't decode.
            const extras: any = {
                f_dc_0: localize('panel.splat-data.dc-red'),
                f_dc_1: localize('panel.splat-data.dc-green'),
                f_dc_2: localize('panel.splat-data.dc-blue')
            };
            const shBands = (splat.entity.gsplat.instance.resource as any).shBands ?? 0;
            const numCoeffs = SH_NUM_COEFFS[shBands] ?? 0;
            const channels = ['R', 'G', 'B'];
            const maxFRest = numCoeffs * 3;
            for (let i = 0; i < maxFRest; i++) {
                const channel = channels[Math.floor(i / numCoeffs)];
                const idx = i % numCoeffs;
                extras[`f_rest_${i}`] = `${channel} ${localize('panel.splat-data.sh')} ${idx}`;
            }

            const dataProps = splat.splatData.getElement('vertex').properties.map(p => p.name);
            const derivedProps = ['distance', 'camera-depth', 'volume', 'surface-area', 'red', 'green', 'blue', 'hue', 'saturation', 'value'];
            const availableProps = new Set(dataProps.concat(derivedProps));

            // build ordered default props from localizations keys, filtered to available
            const defaultProps = Object.keys(localizations).filter(p => availableProps.has(p));

            // build ordered extra props from extras keys, filtered to available
            const extraProps = showAllValue.value ?
                Object.keys(extras).filter(p => availableProps.has(p)) :
                [];

            const allProps = [...defaultProps, ...extraProps];

            // clear existing items
            dataListBox.dom.innerHTML = '';

            allProps.forEach((prop) => {
                const item = document.createElement('div');
                item.classList.add('data-list-item');
                if (prop === selectedDataProp) {
                    item.classList.add('active');
                }
                item.textContent = localizations[prop] ?? extras[prop] ?? prop;

                item.addEventListener('click', () => {
                    selectedDataProp = prop;
                    // eslint-disable-next-line no-use-before-define
                    inputs.mode = propModeFor(prop) ?? 0;
                    dataListBox.dom.querySelectorAll('.data-list-item').forEach((el) => {
                        el.classList.remove('active');
                    });
                    item.classList.add('active');
                    tick(); // eslint-disable-line no-use-before-define
                });

                dataListBox.dom.appendChild(item);
            });
        };

        controls.append(logScale);
        controls.append(showAll);
        controls.append(onScreenOnly);
        controls.append(dataListBox);

        controlsContainer.append(controls);

        // build histogram
        const histogram = new Histogram(256, 128);

        const histogramContainer = new Container({
            id: 'histogram-container'
        });

        histogramContainer.dom.appendChild(histogram.canvas);

        this.append(controlsContainer);
        this.append(histogramContainer);

        // current splat
        let splat: Splat;

        let pendingToken = 0;
        let lastGpuMode = 0;
        let lastHash = '';
        const viewProjection = new Mat4();

        // single source of truth for everything that could trigger a refresh.
        // subscribers update one field and call tick(); tick hashes the inputs
        // (with per-mode dependency filtering) and only schedules a GPU pass
        // when the hash actually changed.
        const inputs: HistogramInputs = {
            splatId: -1,
            mode: 0,
            onScreenOnly: false,
            logScale: false,
            cameraVersion: 0,
            stateVersion: 0,
            colorGradeVersion: 0,
            positionsVersion: 0
        };

        const buildGpuOpts = () => {
            const cam = splat.scene.camera.camera;
            const opts: any = {
                entityMatrix: splat.entity.getWorldTransform(),
                viewMatrix: cam.viewMatrix,
                cameraPos: splat.scene.camera.position
            };
            if (inputs.onScreenOnly) {
                viewProjection.mul2(cam.projectionMatrix, cam.viewMatrix);
                opts.viewProjection = viewProjection;
                opts.onScreenOnly = true;
            }
            return opts;
        };

        const scheduleUpdate = () => {
            if (!splat || this.hidden) return;
            const mode = inputs.mode;
            const opts = buildGpuOpts();
            // pendingToken collapses bursts of triggers within a single queue
            // tick (e.g. rapid camera-settle + color-grade) so only the latest
            // intent issues a GPU pass. ordering vs select / history mutations
            // is provided by the shared command queue.
            const myToken = ++pendingToken;
            splat.scene.commandQueue.enqueue(async () => {
                if (myToken !== pendingToken) return;
                const result = await splat.scene.dataProcessor.calcHistogram(splat, mode, opts);
                if (myToken !== pendingToken) return;

                lastGpuMode = mode;

                histogram.setData({
                    selected: result.selected,
                    unselected: result.unselected,
                    min: result.min,
                    max: result.max,
                    numValues: result.numValues,
                    logScale: inputs.logScale
                });
            });
        };

        const tick = () => {
            if (!splat || this.hidden) return;
            const h = hashInputs(inputs);
            if (h === lastHash) return;
            lastHash = h;
            scheduleUpdate();
        };

        events.on('splat.stateChanged', (splat_: Splat) => {
            // only react when the change is for the splat we're currently
            // displaying. another splat's stateChanged is irrelevant to this
            // histogram.
            if (splat_ === splat) {
                inputs.stateVersion++;
                tick();
            }
        });

        events.on('splat.positionsChanged', (splat_: Splat) => {
            if (splat_ === splat) {
                inputs.positionsVersion++;
                tick();
            }
        });

        events.on('splat.moved', (splat_: Splat) => {
            if (splat_ === splat) {
                inputs.positionsVersion++;
                tick();
            }
        });

        // bump cameraVersion only after the camera has stopped moving for
        // CAMERA_SETTLE_MS, so a single drag doesn't spam GPU passes. whether
        // the bump triggers a refresh is decided per-prop inside hashInputs.
        const CAMERA_SETTLE_MS = 150;
        let cameraTimer: number | null = null;
        const lastCameraMatrix = new Mat4();
        events.on('prerender', (cameraMatrix: Mat4) => {
            if (!cameraMatrix.equals(lastCameraMatrix)) {
                lastCameraMatrix.copy(cameraMatrix);
                if (cameraTimer !== null) clearTimeout(cameraTimer);
                cameraTimer = window.setTimeout(() => {
                    cameraTimer = null;
                    inputs.cameraVersion++;
                    tick();
                }, CAMERA_SETTLE_MS);
            }
        });

        onScreenOnlyValue.on('change', () => {
            inputs.onScreenOnly = onScreenOnlyValue.value;
            tick();
        });

        const colorEvents = [
            'splat.tintClr', 'splat.temperature', 'splat.saturation',
            'splat.brightness', 'splat.blackPoint', 'splat.whitePoint',
            'splat.transparency'
        ];
        colorEvents.forEach((name) => {
            events.on(name, (splat_: Splat) => {
                if (splat_ === splat) {
                    inputs.colorGradeVersion++;
                    tick();
                }
            });
        });

        events.on('selection.changed', (selection: Element) => {
            if (selection instanceof Splat) {
                splat = selection;
                inputs.splatId = splat.uid;
                inputs.mode = propModeFor(selectedDataProp) ?? 0;
                populateDataSelector(splat);
                tick();
            }
        });

        events.on('statusBar.panelChanged', (panel: string | null) => {
            if (panel === 'splatData') {
                // defer until panel is visible (this.hidden flips)
                requestAnimationFrame(() => {
                    // panel just became visible; clear the dedupe hash so the
                    // next tick definitely fires.
                    lastHash = '';
                    tick();

                    // scroll the selected list item into view
                    const activeItem = dataListBox.dom.querySelector('.data-list-item.active');
                    if (activeItem) {
                        activeItem.scrollIntoView({ block: 'nearest' });
                    }
                });
            }
        });

        logScaleValue.on('change', () => {
            inputs.logScale = logScaleValue.value;
            tick();
        });

        showAllValue.on('change', () => {
            if (splat) {
                populateDataSelector(splat);
            }
        });

        const popupContainer = new Container({
            id: 'data-panel-popup-container',
            hidden: true
        });

        const popupLabel = new Label({
            id: 'data-panel-popup-label',
            text: '',
            unsafe: true
        });

        popupContainer.append(popupLabel);
        this.append(popupContainer);

        histogram.events.on('showOverlay', () => {
            popupContainer.hidden = false;
        });

        histogram.events.on('hideOverlay', () => {
            popupContainer.hidden = true;
        });

        histogram.events.on('updateOverlay', (info: any) => {
            popupContainer.style.left = `${info.x + 14}px`;
            popupContainer.style.top = `${info.y}px`;

            const binValue = info.value.toFixed(2);
            const count = info.selected + info.unselected;
            const percentage = (info.total ? count / info.total * 100 : 0).toFixed(2);

            popupLabel.text = `value: ${binValue} cnt: ${count} (${percentage}%) sel: ${info.selected}`;
        });

        // highlight
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('id', 'histogram-svg');

        // create rect element
        const rect = document.createElementNS(svg.namespaceURI, 'rect') as SVGRectElement;
        rect.setAttribute('id', 'highlight-rect');
        rect.setAttribute('fill', 'rgba(255, 102, 0, 0.2)');
        rect.setAttribute('stroke', '#f60');
        rect.setAttribute('stroke-width', '1');
        rect.setAttribute('stroke-dasharray', '5, 5');

        svg.appendChild(rect);
        histogramContainer.dom.appendChild(svg);

        histogram.events.on('highlight', (info: any) => {
            rect.setAttribute('x', info.x.toString());
            rect.setAttribute('y', info.y.toString());
            rect.setAttribute('width', info.width.toString());
            rect.setAttribute('height', info.height.toString());

            svg.style.display = 'inline';
        });

        histogram.events.on('select', (op: string, start: number, end: number) => {
            svg.style.display = 'none';
            if (!splat) return;

            // capture state synchronously at drag-end and enqueue the whole
            // gpu pass + select fire on the shared command queue. queue ordering
            // guarantees this select runs after any in-flight histogram update
            // and that any subsequent operation runs after this select's
            // edit.add lands in history. no defensive token / target-splat
            // checks are needed.
            const targetSplat = splat;
            const mode = lastGpuMode;
            const minValue = histogram.histogram.minValue;
            const maxValue = histogram.histogram.maxValue;
            const numBins = histogram.histogram.bins.length;
            const opts = buildGpuOpts();

            targetSplat.scene.commandQueue.enqueue(async () => {
                const data = await targetSplat.scene.dataProcessor.selectByRange(targetSplat, mode, {
                    ...opts,
                    min: minValue,
                    max: maxValue,
                    numBins,
                    rangeStart: start,
                    rangeEnd: end
                });
                // SelectOp (via 'select.mask') consumes the bytes synchronously
                // in its constructor, so the buffer is safe to release once
                // events.fire returns.
                events.fire('select.mask', op, data);
                targetSplat.scene.dataProcessor.releaseMask(data);
            });
        });
    }
}

export { DataPanel };
