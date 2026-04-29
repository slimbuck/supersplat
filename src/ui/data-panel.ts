import { BooleanInput, Container, Label } from '@playcanvas/pcui';
import { Mat4 } from 'playcanvas';

import { ColorGrade, dcDecode } from '../color-grade';
import { Events } from '../events';
import { Splat } from '../splat';
import { rgb2hsv } from './color';
import { Histogram } from './histogram';
import { State } from '../splat-state';
import { localize } from './localization';

const scaleFunc = (v: number) => Math.exp(v);

const dataFuncs = {
    scale_0: scaleFunc,
    scale_1: scaleFunc,
    scale_2: scaleFunc
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
            // default prop localizations - order defines display order
            const localizations: any = {
                x: `${localize('panel.splat-data.position')} X`,
                y: `${localize('panel.splat-data.position')} Y`,
                z: `${localize('panel.splat-data.position')} Z`,
                opacity: localize('panel.splat-data.opacity'),
                f_dc_0: localize('panel.splat-data.red'),
                f_dc_1: localize('panel.splat-data.green'),
                f_dc_2: localize('panel.splat-data.blue'),
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

            // extra prop localizations - shown when "Show All" is enabled
            const extras: any = {
                nx: `${localize('panel.splat-data.normal')} X`,
                ny: `${localize('panel.splat-data.normal')} Y`,
                nz: `${localize('panel.splat-data.normal')} Z`
            };

            for (let i = 0; i < 45; i++) {
                extras[`f_rest_${i}`] = `${localize('panel.splat-data.sh')} ${i}`;
            }

            const dataProps = splat.splatData.getElement('vertex').properties.map(p => p.name);
            const derivedProps = ['distance', 'camera-depth', 'volume', 'surface-area', 'hue', 'saturation', 'value'];
            const availableProps = new Set(dataProps.concat(derivedProps));

            // build ordered default props from localizations keys, filtered to available
            const defaultProps = Object.keys(localizations).filter(p => availableProps.has(p));

            // build ordered extra props from extras keys, filtered to available
            const extraProps = showAllValue.value ?
                Object.keys(extras).filter(p => availableProps.has(p)) :
                [];

            // collect any remaining un-localized props (except state/transform and already listed ones)
            const listedProps = new Set([...defaultProps, ...extraProps, 'state', 'transform']);
            const remainingProps = showAllValue.value ?
                dataProps.filter(p => !listedProps.has(p)) :
                [];

            const allProps = [...defaultProps, ...extraProps, ...remainingProps];

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

        // returns a function which will interpret the splat data for purposes of
        // viewing it in the histogram.
        // the returned values will depend on the currently selected data type:
        //   * some value functions return the raw splat data, like 'x'.
        //   * other value functions must transform the data for histogram visualization
        //     (for example 'scale_0', which must be exponentiated).
        //   * still other values are calculated/derived from multiple values of splat
        //     data like 'volume' and 'surface area'.
        const getValueFunc = () => {
            // @ts-ignore
            const dataFunc = dataFuncs[selectedDataProp];
            const data = splat.splatData.getProp(selectedDataProp);
            const grade = new ColorGrade(splat);
            const c = { r: 0, g: 0, b: 0 };

            const r = splat.splatData.getProp('f_dc_0') as Float32Array;
            const g = splat.splatData.getProp('f_dc_1') as Float32Array;
            const b = splat.splatData.getProp('f_dc_2') as Float32Array;

            let func: (i: number) => number;
            switch (selectedDataProp) {
                case 'f_dc_0':
                    func = (i) => {
                        c.r = dcDecode(r[i]); c.g = dcDecode(g[i]); c.b = dcDecode(b[i]);
                        grade.applyDC(c);
                        return c.r;
                    };
                    break;
                case 'f_dc_1':
                    func = (i) => {
                        c.r = dcDecode(r[i]); c.g = dcDecode(g[i]); c.b = dcDecode(b[i]);
                        grade.applyDC(c);
                        return c.g;
                    };
                    break;
                case 'f_dc_2':
                    func = (i) => {
                        c.r = dcDecode(r[i]); c.g = dcDecode(g[i]); c.b = dcDecode(b[i]);
                        grade.applyDC(c);
                        return c.b;
                    };
                    break;
                case 'hue':
                    func = (i) => {
                        c.r = dcDecode(r[i]); c.g = dcDecode(g[i]); c.b = dcDecode(b[i]);
                        grade.applyDC(c);
                        return rgb2hsv(c).h * 360;
                    };
                    break;
                case 'saturation':
                    func = (i) => {
                        c.r = dcDecode(r[i]); c.g = dcDecode(g[i]); c.b = dcDecode(b[i]);
                        grade.applyDC(c);
                        return rgb2hsv(c).s;
                    };
                    break;
                case 'value':
                    func = (i) => {
                        c.r = dcDecode(r[i]); c.g = dcDecode(g[i]); c.b = dcDecode(b[i]);
                        grade.applyDC(c);
                        return rgb2hsv(c).v;
                    };
                    break;
                case 'opacity': {
                    const o = splat.splatData.getProp('opacity') as Float32Array;
                    func = i => grade.applyAlpha(o[i]);
                    break;
                }
                case 'volume': {
                    const sx = splat.splatData.getProp('scale_0');
                    const sy = splat.splatData.getProp('scale_1');
                    const sz = splat.splatData.getProp('scale_2');
                    func = i => scaleFunc(sx[i]) * scaleFunc(sy[i]) * scaleFunc(sz[i]);
                    break;
                }
                case 'distance': {
                    const x = splat.splatData.getProp('x');
                    const y = splat.splatData.getProp('y');
                    const z = splat.splatData.getProp('z');
                    func = i => Math.sqrt(x[i] ** 2 + y[i] ** 2 + z[i] ** 2);
                    break;
                }
                case 'surface-area': {
                    const sx = splat.splatData.getProp('scale_0');
                    const sy = splat.splatData.getProp('scale_1');
                    const sz = splat.splatData.getProp('scale_2');
                    func = i => scaleFunc(sx[i]) ** 2 + scaleFunc(sy[i]) ** 2 + scaleFunc(sz[i]) ** 2;
                    break;
                }
                default:
                    func = dataFunc && data ? i => dataFunc(data[i]) : i => data[i];
                    break;
            }

            return func;
        };

        const gpuPropMode: { [key: string]: number } = { x: 0, y: 1, z: 2, distance: 3, 'camera-depth': 4 };
        let updateToken = 0;
        let lastValueFunc: (i: number) => number = null;
        let lastGpuMode: number | null = null;
        let lastGpuOnScreen = false;
        const viewProjection = new Mat4();

        const buildGpuOpts = () => {
            const cam = splat.scene.camera.camera;
            const useOnScreen = onScreenOnlyValue.value;
            const needsViewMatrix = selectedDataProp === 'camera-depth';
            const opts: any = { entityMatrix: splat.entity.getWorldTransform() };
            if (useOnScreen) {
                viewProjection.mul2(cam.projectionMatrix, cam.viewMatrix);
                opts.viewProjection = viewProjection;
                opts.onScreenOnly = true;
            }
            if (needsViewMatrix) {
                opts.viewMatrix = cam.viewMatrix;
            }
            return opts;
        };

        const updateHistogram = async () => {
            if (!splat || this.hidden) return;

            const state = splat.splatData.getProp('state') as Uint8Array;
            if (!state) return;

            const myToken = ++updateToken;
            const mode = gpuPropMode[selectedDataProp];

            if (mode !== undefined) {
                const opts = buildGpuOpts();
                const result = await splat.scene.dataProcessor.calcHistogram(splat, mode, opts);
                if (myToken !== updateToken) return;

                lastValueFunc = null;
                lastGpuMode = mode;
                lastGpuOnScreen = !!opts.onScreenOnly;

                histogram.setData({
                    selected: result.selected,
                    unselected: result.unselected,
                    min: result.min,
                    max: result.max,
                    numValues: result.numValues,
                    logScale: logScaleValue.value
                });
            } else {
                const func = getValueFunc();
                lastValueFunc = func;
                lastGpuMode = null;

                histogram.update({
                    count: state.length,
                    valueFunc: i => ((state[i] === 0 || state[i] === State.selected) ? func(i) : undefined),
                    selectedFunc: i => state[i] === State.selected,
                    logScale: logScaleValue.value
                });
            }
        };

        events.on('splat.stateChanged', (splat_: Splat) => {
            splat = splat_;
            updateHistogram();
        });

        const positionProps = new Set(['x', 'y', 'z', 'distance', 'camera-depth']);
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

        // refresh on camera settle when current prop depends on the camera
        const CAMERA_SETTLE_MS = 150;
        let cameraTimer: number | null = null;
        const lastCameraMatrix = new Mat4();
        events.on('prerender', (cameraMatrix: Mat4) => {
            const dependsOnCamera =
                (onScreenOnlyValue.value && positionProps.has(selectedDataProp)) ||
                selectedDataProp === 'camera-depth';
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
        const colorProps = new Set(['f_dc_0', 'f_dc_1', 'f_dc_2', 'hue', 'saturation', 'value', 'opacity']);
        colorEvents.forEach((name) => {
            events.on(name, (splat_: Splat) => {
                if (splat_ === splat && colorProps.has(selectedDataProp)) {
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

            const state = splat.splatData.getProp('state') as Uint8Array;
            let func: (i: number) => number;
            let visible: (i: number) => boolean | null = null;

            if (lastGpuMode !== null) {
                // GPU path needs a one-shot per-splat readback to build the predicate
                const opts = buildGpuOpts();
                const data = await splat.scene.dataProcessor.calcProperty(splat, lastGpuMode, opts);
                func = i => data[i * 4];
                if (lastGpuOnScreen) {
                    visible = i => data[i * 4 + 1] !== 0;
                }
            } else {
                if (!lastValueFunc) return;
                func = lastValueFunc;
            }

            events.fire('select.pred', op, (i: number) => {
                if (state[i] !== 0 && state[i] !== State.selected) {
                    return false;
                }
                if (visible && !visible(i)) {
                    return false;
                }
                const value = func(i);
                const bucket = histogram.histogram.valueToBucket(value);
                return bucket >= start && bucket <= end;
            });
        });
    }
}

export { DataPanel };
