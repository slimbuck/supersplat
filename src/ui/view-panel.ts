import { BooleanInput, ColorPicker, Container, SelectInput, SliderInput } from '@playcanvas/pcui';
import { Color } from 'playcanvas';

import { Events } from '../events';
import { ShortcutManager } from '../shortcut-manager';
import { BasePanel } from './base-panel';
import { localize } from './localization';
import { createRow } from './row';
import { Tooltips } from './tooltips';

class ViewPanel extends BasePanel {
    constructor(events: Events, tooltips: Tooltips, args = {}) {
        super(events, {
            ...args,
            id: 'view-panel',
            hidden: true,
            icon: '\uE403',
            label: localize('panel.view-options'),
            panelName: 'viewPanel',
            excludes: 'colorPanel'
        });

        // colors

        const clrPickers = new Container({
            class: 'view-panel-row-pickers'
        });

        const bgClrPicker = new ColorPicker({
            class: 'view-panel-row-picker',
            channels: 3,
            value: [0, 0, 0]
        });

        const selectedClrPicker = new ColorPicker({
            class: 'view-panel-row-picker',
            channels: 4,
            value: [0, 0, 0, 1]
        });

        const unselectedClrPicker = new ColorPicker({
            class: 'view-panel-row-picker',
            channels: 4,
            value: [0, 0, 0, 1]
        });

        const lockedClrPicker = new ColorPicker({
            class: 'view-panel-row-picker',
            channels: 4,
            value: [0, 0, 0, 1]
        });

        const toArray = (clr: Color) => {
            return [clr.r, clr.g, clr.b, clr.a];
        };

        events.on('bgClr', (clr: Color) => {
            bgClrPicker.value = toArray(clr);
        });

        events.on('selectedClr', (clr: Color) => {
            selectedClrPicker.value = toArray(clr);
        });

        events.on('unselectedClr', (clr: Color) => {
            unselectedClrPicker.value = toArray(clr);
        });

        events.on('lockedClr', (clr: Color) => {
            lockedClrPicker.value = toArray(clr);
        });

        clrPickers.append(bgClrPicker);
        clrPickers.append(selectedClrPicker);
        clrPickers.append(unselectedClrPicker);
        clrPickers.append(lockedClrPicker);

        const clrRow = createRow({
            labelText: localize('panel.view-options.colors'),
            control: clrPickers
        });

        // tonemapping

        const tonemappingSelection = new SelectInput({
            class: 'view-panel-row-select',
            defaultValue: 'linear',
            options: [
                { v: 'linear', t: localize('panel.view-options.tonemapping.linear') },
                { v: 'neutral', t: localize('panel.view-options.tonemapping.neutral') },
                { v: 'aces', t: localize('panel.view-options.tonemapping.aces') },
                { v: 'aces2', t: localize('panel.view-options.tonemapping.aces2') },
                { v: 'filmic', t: localize('panel.view-options.tonemapping.filmic') },
                { v: 'hejl', t: localize('panel.view-options.tonemapping.hejl') }
            ]
        });

        const tonemappingRow = createRow({
            labelText: localize('panel.view-options.tonemapping'),
            control: tonemappingSelection
        });

        // camera fov

        const fovSlider = new SliderInput({
            class: 'ss-panel-row-slider',
            min: 10,
            max: 120,
            precision: 1,
            value: 60
        });

        const fovRow = createRow({
            labelText: localize('panel.view-options.fov'),
            control: fovSlider
        });

        // sh bands

        const shBandsSlider = new SliderInput({
            class: 'ss-panel-row-slider',
            min: 0,
            max: 3,
            precision: 0,
            value: 3
        });

        const shBandsRow = createRow({
            labelText: localize('panel.view-options.sh-bands'),
            control: shBandsSlider
        });

        // camera fly speed

        const cameraFlySpeedSlider = new SliderInput({
            class: 'ss-panel-row-slider',
            min: 0.1,
            max: 30,
            precision: 1,
            value: 1
        });

        const cameraFlySpeedRow = createRow({
            labelText: localize('panel.view-options.fly-speed'),
            control: cameraFlySpeedSlider
        });

        // centers size

        const centersSizeSlider = new SliderInput({
            class: 'ss-panel-row-slider',
            min: 0,
            max: 10,
            precision: 1,
            value: 2
        });

        const centersSizeRow = createRow({
            labelText: localize('panel.view-options.centers-size'),
            control: centersSizeSlider
        });

        // centers gaussian color

        const centersColorToggle = new BooleanInput({
            type: 'toggle',
            class: 'ss-panel-row-toggle',
            value: false
        });

        const centersColorRow = createRow({
            labelText: localize('panel.view-options.centers-gaussian-color'),
            control: centersColorToggle
        });

        // outline selection

        const outlineSelectionToggle = new BooleanInput({
            type: 'toggle',
            class: 'ss-panel-row-toggle',
            value: false
        });

        const outlineSelectionRow = createRow({
            labelText: localize('panel.view-options.outline-selection'),
            control: outlineSelectionToggle
        });

        // show grid

        const showGridToggle = new BooleanInput({
            type: 'toggle',
            class: 'ss-panel-row-toggle',
            value: true
        });

        const showGridRow = createRow({
            labelText: localize('panel.view-options.show-grid'),
            control: showGridToggle
        });

        // show bound

        const showBoundToggle = new BooleanInput({
            type: 'toggle',
            class: 'ss-panel-row-toggle',
            value: true
        });

        const showBoundRow = createRow({
            labelText: localize('panel.view-options.show-bound'),
            control: showBoundToggle
        });

        // show camera poses

        const showCameraPosesToggle = new BooleanInput({
            type: 'toggle',
            class: 'ss-panel-row-toggle',
            value: false
        });

        const showCameraPosesRow = createRow({
            labelText: localize('panel.view-options.show-camera-poses'),
            control: showCameraPosesToggle
        });

        this.append(clrRow);
        this.append(tonemappingRow);
        this.append(fovRow);
        this.append(shBandsRow);
        this.append(cameraFlySpeedRow);
        this.append(centersSizeRow);
        this.append(centersColorRow);
        this.append(outlineSelectionRow);
        this.append(showGridRow);
        this.append(showBoundRow);
        this.append(showCameraPosesRow);

        // sh bands

        events.on('view.bands', (bands: number) => {
            shBandsSlider.value = bands;
        });

        shBandsSlider.on('change', (value: number) => {
            events.fire('view.setBands', value);
        });

        // splat size

        events.on('camera.splatSize', (value: number) => {
            centersSizeSlider.value = value;
        });

        centersSizeSlider.on('change', (value: number) => {
            events.fire('camera.setSplatSize', value);
            events.fire('camera.setOverlay', true);
            events.fire('camera.setMode', 'centers');
        });

        // centers gaussian color
        events.on('view.centersUseGaussianColor', (value: boolean) => {
            centersColorToggle.value = value;
        });

        centersColorToggle.on('change', (value: boolean) => {
            events.fire('view.setCentersUseGaussianColor', value);
        });

        // camera speed

        events.on('camera.flySpeed', (value: number) => {
            cameraFlySpeedSlider.value = value;
        });

        cameraFlySpeedSlider.on('change', (value: number) => {
            events.fire('camera.setFlySpeed', value);
        });

        // outline selection

        events.on('view.outlineSelection', (value: boolean) => {
            outlineSelectionToggle.value = value;
        });

        outlineSelectionToggle.on('change', (value: boolean) => {
            events.fire('view.setOutlineSelection', value);
        });

        // show grid

        events.on('grid.visible', (visible: boolean) => {
            showGridToggle.value = visible;
        });

        showGridToggle.on('change', () => {
            events.fire('grid.setVisible', showGridToggle.value);
        });

        // show bound

        events.on('camera.bound', (visible: boolean) => {
            showBoundToggle.value = visible;
        });

        showBoundToggle.on('change', () => {
            events.fire('camera.setBound', showBoundToggle.value);
        });

        // show camera poses

        events.on('camera.showPoses', (visible: boolean) => {
            showCameraPosesToggle.value = visible;
        });

        showCameraPosesToggle.on('change', () => {
            events.fire('camera.setShowPoses', showCameraPosesToggle.value);
        });

        // background color

        bgClrPicker.on('change', (value: number[]) => {
            events.fire('setBgClr', new Color(value[0], value[1], value[2]));
        });

        selectedClrPicker.on('change', (value: number[]) => {
            events.fire('setSelectedClr', new Color(value[0], value[1], value[2], value[3]));
        });

        unselectedClrPicker.on('change', (value: number[]) => {
            events.fire('setUnselectedClr', new Color(value[0], value[1], value[2], value[3]));
        });

        lockedClrPicker.on('change', (value: number[]) => {
            events.fire('setLockedClr', new Color(value[0], value[1], value[2], value[3]));
        });

        // camera fov

        events.on('camera.fov', (fov: number) => {
            fovSlider.value = fov;
        });

        fovSlider.on('change', (value: number) => {
            events.fire('camera.setFov', value);
        });

        // tonemapping

        events.on('camera.tonemapping', (tonemapping: string) => {
            tonemappingSelection.value = tonemapping;
        });

        tonemappingSelection.on('change', (value: string) => {
            events.fire('camera.setTonemapping', value);
        });

        // tooltips
        const shortcutManager: ShortcutManager = events.invoke('shortcutManager');
        const shortcut = shortcutManager.formatShortcut('grid.toggleVisible');
        tooltips.register(showGridRow, `${localize('panel.view-options.show-grid')} ( ${shortcut} )`, 'left');
        tooltips.register(bgClrPicker, localize('panel.view-options.background-color'), 'left');
        tooltips.register(selectedClrPicker, localize('panel.view-options.selected-color'), 'top');
        tooltips.register(unselectedClrPicker, localize('panel.view-options.unselected-color'), 'top');
        tooltips.register(lockedClrPicker, localize('panel.view-options.locked-color'), 'top');
    }
}

export { ViewPanel };
