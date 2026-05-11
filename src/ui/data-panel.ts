import { BooleanInput, Container, Label } from '@playcanvas/pcui';
import { Mat4 } from 'playcanvas';

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
                    dataListBox.dom.querySelectorAll('.data-list-item').forEach((el) => {
                        el.classList.remove('active');
                    });
                    item.classList.add('active');
                    updateHistogram(); // eslint-disable-line no-use-before-define
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

        let updateToken = 0;
        let lastGpuMode = 0;
        const viewProjection = new Mat4();

        const buildGpuOpts = () => {
            const cam = splat.scene.camera.camera;
            const useOnScreen = onScreenOnlyValue.value;
            const opts: any = {
                entityMatrix: splat.entity.getWorldTransform(),
                viewMatrix: cam.viewMatrix,
                cameraPos: splat.scene.camera.position
            };
            if (useOnScreen) {
                viewProjection.mul2(cam.projectionMatrix, cam.viewMatrix);
                opts.viewProjection = viewProjection;
                opts.onScreenOnly = true;
            }
            return opts;
        };

        const updateHistogram = async () => {
            if (!splat || this.hidden) return;

            const mode = propModeFor(selectedDataProp);
            if (mode === undefined) return;

            const myToken = ++updateToken;
            const opts = buildGpuOpts();
            const result = await splat.scene.dataProcessor.calcHistogram(splat, mode, opts);
            if (myToken !== updateToken) return;

            lastGpuMode = mode;

            histogram.setData({
                selected: result.selected,
                unselected: result.unselected,
                min: result.min,
                max: result.max,
                numValues: result.numValues,
                logScale: logScaleValue.value
            });
        };

        events.on('splat.stateChanged', (splat_: Splat) => {
            splat = splat_;
            updateHistogram();
        });

        // position-dependent props: position itself, distance, camera-depth,
        // and the view-direction-dependent final-color props (red/green/blue/
        // hue/saturation/value), since their value depends on world position.
        const positionProps = new Set([
            'x', 'y', 'z', 'distance', 'camera-depth',
            'red', 'green', 'blue', 'hue', 'saturation', 'value'
        ]);
        events.on('splat.positionsChanged', (splat_: Splat) => {
            if (splat_ === splat && positionProps.has(selectedDataProp)) {
                updateHistogram();
            }
        });

        events.on('splat.moved', (splat_: Splat) => {
            if (splat_ === splat && positionProps.has(selectedDataProp)) {
                updateHistogram();
            }
        });

        // refresh on camera settle when the histogram depends on the camera.
        // - onScreenOnly enables visibility culling against the frustum
        // - camera-depth is camera-relative
        // - red/green/blue/hue/saturation/value sample evaluated SH which
        //   depends on the per-splat view direction
        const cameraDependentProps = new Set([
            'camera-depth',
            'red', 'green', 'blue', 'hue', 'saturation', 'value'
        ]);
        const CAMERA_SETTLE_MS = 150;
        let cameraTimer: number | null = null;
        const lastCameraMatrix = new Mat4();
        events.on('prerender', (cameraMatrix: Mat4) => {
            const dependsOnCamera = onScreenOnlyValue.value || cameraDependentProps.has(selectedDataProp);
            if (!dependsOnCamera) return;
            if (!cameraMatrix.equals(lastCameraMatrix)) {
                lastCameraMatrix.copy(cameraMatrix);
                if (cameraTimer !== null) clearTimeout(cameraTimer);
                cameraTimer = window.setTimeout(() => {
                    cameraTimer = null;
                    updateHistogram();
                }, CAMERA_SETTLE_MS);
            }
        });

        onScreenOnlyValue.on('change', updateHistogram);

        const colorEvents = [
            'splat.tintClr', 'splat.temperature', 'splat.saturation',
            'splat.brightness', 'splat.blackPoint', 'splat.whitePoint',
            'splat.transparency'
        ];
        // ColorGrade-dependent props. f_dc_* (raw DC) is intentionally absent:
        // it inverts the engine's dcDecode and bypasses ColorGrade.
        const colorGradeProps = new Set(['red', 'green', 'blue', 'hue', 'saturation', 'value', 'opacity']);
        colorEvents.forEach((name) => {
            events.on(name, (splat_: Splat) => {
                if (splat_ === splat && colorGradeProps.has(selectedDataProp)) {
                    updateHistogram();
                }
            });
        });

        events.on('selection.changed', (selection: Element) => {
            if (selection instanceof Splat) {
                splat = selection;
                populateDataSelector(splat);
                updateHistogram();
            }
        });

        events.on('statusBar.panelChanged', (panel: string | null) => {
            if (panel === 'splatData') {
                // defer update to next frame so the panel is visible first
                requestAnimationFrame(() => {
                    updateHistogram();

                    // scroll the selected list item into view
                    const activeItem = dataListBox.dom.querySelector('.data-list-item.active');
                    if (activeItem) {
                        activeItem.scrollIntoView({ block: 'nearest' });
                    }
                });
            }
        });

        logScaleValue.on('change', updateHistogram);

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

        histogram.events.on('select', async (op: string, start: number, end: number) => {
            svg.style.display = 'none';
            if (!splat) return;

            // GPU computes the predicate. result is 1 byte per splat: 255 for
            // splats that fall within the bucket range and pass all visibility
            // / state checks, 0 otherwise.
            const data = await splat.scene.dataProcessor.selectByRange(splat, lastGpuMode, {
                ...buildGpuOpts(),
                min: histogram.histogram.minValue,
                max: histogram.histogram.maxValue,
                numBins: histogram.histogram.bins.length,
                rangeStart: start,
                rangeEnd: end
            });

            events.fire('select.pred', op, (i: number) => data[i] === 255);
        });
    }
}

export { DataPanel };
