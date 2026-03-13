import { ColorPicker, Container, Label, SliderInput } from '@playcanvas/pcui';
import { Color } from 'playcanvas';

import { SetSplatColorAdjustmentOp } from '../edit-ops';
import { Events } from '../events';
import { Splat } from '../splat';
import { BasePanel } from './base-panel';
import { localize } from './localization';
import { createRow } from './row';
import { Tooltips } from './tooltips';

class MyFancySliderInput extends SliderInput {
    _onSlideStart(pageX: number) {
        super._onSlideStart(pageX);
        this.emit('slide:start');
    }

    _onSlideEnd(pageX: number) {
        super._onSlideEnd(pageX);
        this.emit('slide:end');
    }
}

class ColorPanel extends BasePanel {
    constructor(events: Events, tooltips: Tooltips, args = {}) {
        super(events, {
            ...args,
            id: 'color-panel',
            hidden: true,
            icon: '\uE146',
            label: localize('panel.colors'),
            panelName: 'colorPanel',
            excludes: 'viewPanel'
        });

        // tint

        const tintPicker = new ColorPicker({
            class: 'color-panel-row-picker',
            value: [1, 1, 1]
        });

        const tintRow = createRow({
            labelText: localize('panel.colors.tint'),
            control: tintPicker
        });

        // temperature

        const temperatureSlider = new MyFancySliderInput({
            class: 'ss-panel-row-slider',
            min: -0.5,
            max: 0.5,
            step: 0.005,
            value: 0
        });

        const temperatureRow = createRow({
            labelText: localize('panel.colors.temperature'),
            control: temperatureSlider
        });

        // saturation

        const saturationSlider = new MyFancySliderInput({
            class: 'ss-panel-row-slider',
            min: 0,
            max: 2,
            step: 0.1,
            value: 1
        });

        const saturationRow = createRow({
            labelText: localize('panel.colors.saturation'),
            control: saturationSlider
        });

        // brightness

        const brightnessSlider = new MyFancySliderInput({
            class: 'ss-panel-row-slider',
            min: -1,
            max: 1,
            step: 0.1,
            value: 1
        });

        const brightnessRow = createRow({
            labelText: localize('panel.colors.brightness'),
            control: brightnessSlider
        });

        // black point

        const blackPointSlider = new MyFancySliderInput({
            class: 'ss-panel-row-slider',
            min: 0,
            max: 1,
            step: 0.01,
            value: 0
        });

        const blackPointRow = createRow({
            labelText: localize('panel.colors.black-point'),
            control: blackPointSlider
        });

        // white point

        const whitePointSlider = new MyFancySliderInput({
            class: 'ss-panel-row-slider',
            min: 0,
            max: 1,
            step: 0.01,
            value: 1
        });

        const whitePointRow = createRow({
            labelText: localize('panel.colors.white-point'),
            control: whitePointSlider
        });

        // transparency

        const transparencySlider = new MyFancySliderInput({
            class: 'ss-panel-row-slider',
            min: -6,
            max: 6,
            step: 0.01,
            value: 1
        });

        const transparencyRow = createRow({
            labelText: localize('panel.colors.transparency'),
            control: transparencySlider
        });

        // control row

        const controlRow = new Container({
            class: 'color-panel-control-row'
        });

        const reset = new Label({
            class: 'ss-panel-header-button',
            text: '\uE304'
        });

        controlRow.append(new Label({ class: 'ss-panel-header-spacer' }));
        controlRow.append(reset);
        controlRow.append(new Label({ class: 'ss-panel-header-spacer' }));

        this.append(tintRow);
        this.append(temperatureRow);
        this.append(saturationRow);
        this.append(brightnessRow);
        this.append(blackPointRow);
        this.append(whitePointRow);
        this.append(transparencyRow);
        this.append(new Label({ class: 'ss-panel-header-spacer' }));
        this.append(controlRow);

        // handle ui updates

        let suppress = false;
        let selected: Splat = null;
        let op: SetSplatColorAdjustmentOp = null;

        const updateUIFromState = (splat: Splat) => {
            if (suppress) return;
            suppress = true;
            tintPicker.value = splat ? [splat.tintClr.r, splat.tintClr.g, splat.tintClr.b] : [1, 1, 1];
            temperatureSlider.value = splat ? splat.temperature : 0;
            saturationSlider.value = splat ? splat.saturation : 0;
            brightnessSlider.value = splat ? splat.brightness : 0;
            blackPointSlider.value = splat ? splat.blackPoint : 0;
            whitePointSlider.value = splat ? splat.whitePoint : 1;
            transparencySlider.value = splat ? Math.log(splat.transparency) : 0;
            suppress = false;
        };

        const start = () => {
            if (selected) {
                op = new SetSplatColorAdjustmentOp({
                    splat: selected,
                    newState: {
                        tintClr: selected.tintClr.clone(),
                        temperature: selected.temperature,
                        saturation: selected.saturation,
                        brightness: selected.brightness,
                        blackPoint: selected.blackPoint,
                        whitePoint: selected.whitePoint,
                        transparency: selected.transparency
                    },
                    oldState: {
                        tintClr: selected.tintClr.clone(),
                        temperature: selected.temperature,
                        saturation: selected.saturation,
                        brightness: selected.brightness,
                        blackPoint: selected.blackPoint,
                        whitePoint: selected.whitePoint,
                        transparency: selected.transparency
                    }
                });
            }
        };

        const end = () => {
            if (op) {
                const { newState } = op;
                newState.tintClr.set(tintPicker.value[0], tintPicker.value[1], tintPicker.value[2]);
                newState.temperature = temperatureSlider.value;
                newState.saturation = saturationSlider.value;
                newState.brightness = brightnessSlider.value;
                newState.blackPoint = blackPointSlider.value;
                newState.whitePoint = whitePointSlider.value;
                newState.transparency = Math.exp(transparencySlider.value);
                events.fire('edit.add', op);
                op = null;
            }
        };

        const updateOp = (setFunc: (op: SetSplatColorAdjustmentOp) => void) => {
            if (!suppress) {
                suppress = true;
                if (op) {
                    setFunc(op);
                    op.do();
                } else if (selected) {
                    start();
                    setFunc(op);
                    op.do();
                    end();
                }
                suppress = false;
            }
        };

        [temperatureSlider, saturationSlider, brightnessSlider, blackPointSlider, whitePointSlider, transparencySlider].forEach((slider) => {
            slider.on('slide:start', start);
            slider.on('slide:end', end);
        });
        tintPicker.on('picker:color:start', start);
        tintPicker.on('picker:color:end', end);

        tintPicker.on('change', (value: number[]) => {
            updateOp((op) => {
                op.newState.tintClr.set(value[0], value[1], value[2]);
            });
        });

        temperatureSlider.on('change', (value: number) => {
            updateOp((op) => {
                op.newState.temperature = value;
            });
        });

        saturationSlider.on('change', (value: number) => {
            updateOp((op) => {
                op.newState.saturation = value;
            });
        });

        brightnessSlider.on('change', (value: number) => {
            updateOp((op) => {
                op.newState.brightness = value;
            });
        });

        blackPointSlider.on('change', (value: number) => {
            updateOp((op) => {
                op.newState.blackPoint = value;
            });

            if (value > whitePointSlider.value) {
                whitePointSlider.value = value;
            }
        });

        whitePointSlider.on('change', (value: number) => {
            updateOp((op) => {
                op.newState.whitePoint = value;
            });

            if (value < blackPointSlider.value) {
                blackPointSlider.value = value;
            }
        });

        transparencySlider.on('change', (value: number) => {
            updateOp((op) => {
                op.newState.transparency = Math.exp(value);
            });
        });

        reset.on('click', () => {
            if (selected) {
                const op = new SetSplatColorAdjustmentOp({
                    splat: selected,
                    newState: {
                        tintClr: new Color(1, 1, 1),
                        temperature: 0,
                        saturation: 1,
                        brightness: 0,
                        blackPoint: 0,
                        whitePoint: 1,
                        transparency: 1
                    },
                    oldState: {
                        tintClr: selected.tintClr.clone(),
                        temperature: selected.temperature,
                        saturation: selected.saturation,
                        brightness: selected.brightness,
                        blackPoint: selected.blackPoint,
                        whitePoint: selected.whitePoint,
                        transparency: selected.transparency
                    }
                });

                events.fire('edit.add', op);
            }
        });

        events.on('selection.changed', (splat) => {
            selected = splat;
            updateUIFromState(splat);
        });

        events.on('splat.tintClr', updateUIFromState);
        events.on('splat.temperature', updateUIFromState);
        events.on('splat.saturation', updateUIFromState);
        events.on('splat.brightness', updateUIFromState);
        events.on('splat.blackPoint', updateUIFromState);
        events.on('splat.whitePoint', updateUIFromState);
        events.on('splat.transparency', updateUIFromState);

        tooltips.register(reset, localize('panel.colors.reset'), 'bottom');
    }
}

export { ColorPanel };
