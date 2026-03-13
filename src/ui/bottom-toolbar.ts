import { Button, Container } from '@playcanvas/pcui';

import { Events } from '../events';
import { localize } from './localization';
import redoSvg from './svg/redo.svg';
import brushSvg from './svg/select-brush.svg';
import eyedropperSvg from './svg/select-eyedropper.svg';
import floodSvg from './svg/select-flood.svg';
import lassoSvg from './svg/select-lasso.svg';
import pickerSvg from './svg/select-picker.svg';
import polygonSvg from './svg/select-poly.svg';
import sphereSvg from './svg/select-sphere.svg';
import boxSvg from './svg/show-hide-splats.svg';
import undoSvg from './svg/undo.svg';
import { buildTooltipText, createToolbarButton, createToolbarSeparator, stopToolbarPointerEvents } from './toolbar-utils';
import { Tooltips } from './tooltips';

class BottomToolbar extends Container {
    constructor(events: Events, tooltips: Tooltips, args = {}) {
        super({
            ...args,
            id: 'bottom-toolbar'
        });

        stopToolbarPointerEvents(this.dom);

        const undo = createToolbarButton(undoSvg, 'bottom-toolbar-button', 'bottom-toolbar-undo');
        undo.enabled = false;

        const redo = createToolbarButton(redoSvg, 'bottom-toolbar-button', 'bottom-toolbar-redo');
        redo.enabled = false;

        const picker = createToolbarButton(pickerSvg, 'bottom-toolbar-tool', 'bottom-toolbar-picker');
        const polygon = createToolbarButton(polygonSvg, 'bottom-toolbar-tool', 'bottom-toolbar-polygon');
        const brush = createToolbarButton(brushSvg, 'bottom-toolbar-tool', 'bottom-toolbar-brush');
        const flood = createToolbarButton(floodSvg, 'bottom-toolbar-tool', 'bottom-toolbar-flood');
        const lasso = createToolbarButton(lassoSvg, 'bottom-toolbar-tool', 'bottom-toolbar-lasso');
        const sphere = createToolbarButton(sphereSvg, 'bottom-toolbar-tool', 'bottom-toolbar-sphere');
        const box = createToolbarButton(boxSvg, 'bottom-toolbar-tool', 'bottom-toolbar-box');
        const eyedropper = createToolbarButton(eyedropperSvg, 'bottom-toolbar-tool', 'bottom-toolbar-eyedropper');

        const translate = new Button({
            id: 'bottom-toolbar-translate',
            class: 'bottom-toolbar-tool',
            icon: 'E111'
        });

        const rotate = new Button({
            id: 'bottom-toolbar-rotate',
            class: 'bottom-toolbar-tool',
            icon: 'E113'
        });

        const scale = new Button({
            id: 'bottom-toolbar-scale',
            class: 'bottom-toolbar-tool',
            icon: 'E112'
        });

        const measure = new Button({
            id: 'bottom-toolbar-measure',
            class: 'bottom-toolbar-tool',
            icon: 'E358'
        });

        const coordSpace = new Button({
            id: 'bottom-toolbar-coord-space',
            class: 'bottom-toolbar-toggle',
            icon: 'E118'
        });

        const origin = new Button({
            id: 'bottom-toolbar-origin',
            class: ['bottom-toolbar-toggle'],
            icon: 'E189'
        });

        const sep = () => createToolbarSeparator('bottom-toolbar-separator');

        this.append(undo);
        this.append(redo);
        this.append(sep());
        this.append(picker);
        this.append(lasso);
        this.append(polygon);
        this.append(brush);
        this.append(flood);
        this.append(eyedropper);
        this.append(sep());
        this.append(sphere);
        this.append(box);
        this.append(sep());
        this.append(translate);
        this.append(rotate);
        this.append(scale);
        this.append(sep());
        this.append(measure);
        this.append(coordSpace);
        this.append(origin);

        undo.dom.addEventListener('click', () => events.fire('edit.undo'));
        redo.dom.addEventListener('click', () => events.fire('edit.redo'));
        polygon.dom.addEventListener('click', () => events.fire('tool.polygonSelection'));
        lasso.dom.addEventListener('click', () => events.fire('tool.lassoSelection'));
        brush.dom.addEventListener('click', () => events.fire('tool.brushSelection'));
        flood.dom.addEventListener('click', () => events.fire('tool.floodSelection'));
        picker.dom.addEventListener('click', () => events.fire('tool.rectSelection'));
        eyedropper.dom.addEventListener('click', () => events.fire('tool.eyedropperSelection'));
        sphere.dom.addEventListener('click', () => events.fire('tool.sphereSelection'));
        box.dom.addEventListener('click', () => events.fire('tool.boxSelection'));
        translate.dom.addEventListener('click', () => events.fire('tool.move'));
        rotate.dom.addEventListener('click', () => events.fire('tool.rotate'));
        scale.dom.addEventListener('click', () => events.fire('tool.scale'));
        measure.dom.addEventListener('click', () => events.fire('tool.measure'));
        coordSpace.dom.addEventListener('click', () => events.fire('tool.toggleCoordSpace'));
        origin.dom.addEventListener('click', () => events.fire('pivot.toggleOrigin'));

        events.on('edit.canUndo', (value: boolean) => {
            undo.enabled = value;
        });
        events.on('edit.canRedo', (value: boolean) => {
            redo.enabled = value;
        });

        events.on('tool.activated', (toolName: string) => {
            picker.class[toolName === 'rectSelection' ? 'add' : 'remove']('active');
            brush.class[toolName === 'brushSelection' ? 'add' : 'remove']('active');
            flood.class[toolName === 'floodSelection' ? 'add' : 'remove']('active');
            polygon.class[toolName === 'polygonSelection' ? 'add' : 'remove']('active');
            lasso.class[toolName === 'lassoSelection' ? 'add' : 'remove']('active');
            sphere.class[toolName === 'sphereSelection' ? 'add' : 'remove']('active');
            box.class[toolName === 'boxSelection' ? 'add' : 'remove']('active');
            translate.class[toolName === 'move' ? 'add' : 'remove']('active');
            rotate.class[toolName === 'rotate' ? 'add' : 'remove']('active');
            scale.class[toolName === 'scale' ? 'add' : 'remove']('active');
            measure.class[toolName === 'measure' ? 'add' : 'remove']('active');
            eyedropper.class[toolName === 'eyedropperSelection' ? 'add' : 'remove']('active');
        });

        events.on('tool.coordSpace', (space: 'local' | 'world') => {
            coordSpace.dom.classList[space === 'local' ? 'add' : 'remove']('active');
        });

        events.on('pivot.origin', (o: 'center' | 'boundCenter') => {
            origin.dom.classList[o === 'boundCenter' ? 'add' : 'remove']('active');
        });

        const tip = (key: string, shortcut?: string) => buildTooltipText(events, key, shortcut);

        tooltips.register(undo, tip('tooltip.bottom-toolbar.undo', 'edit.undo'));
        tooltips.register(redo, tip('tooltip.bottom-toolbar.redo', 'edit.redo'));
        tooltips.register(picker, tip('tooltip.bottom-toolbar.rect', 'tool.rectSelection'));
        tooltips.register(lasso, tip('tooltip.bottom-toolbar.lasso', 'tool.lassoSelection'));
        tooltips.register(polygon, tip('tooltip.bottom-toolbar.polygon', 'tool.polygonSelection'));
        tooltips.register(brush, tip('tooltip.bottom-toolbar.brush', 'tool.brushSelection'));
        tooltips.register(flood, tip('tooltip.bottom-toolbar.flood', 'tool.floodSelection'));
        tooltips.register(sphere, tip('tooltip.bottom-toolbar.sphere'));
        tooltips.register(box, tip('tooltip.bottom-toolbar.box'));
        tooltips.register(translate, tip('tooltip.bottom-toolbar.translate', 'tool.move'));
        tooltips.register(rotate, tip('tooltip.bottom-toolbar.rotate', 'tool.rotate'));
        tooltips.register(scale, tip('tooltip.bottom-toolbar.scale', 'tool.scale'));
        tooltips.register(measure, tip('tooltip.bottom-toolbar.measure'));
        tooltips.register(coordSpace, tip('tooltip.bottom-toolbar.local-space', 'tool.toggleCoordSpace'));
        tooltips.register(origin, tip('tooltip.bottom-toolbar.bound-center'));
        tooltips.register(eyedropper, tip('tooltip.bottom-toolbar.eyedropper', 'tool.eyedropperSelection'));
    }
}

export { BottomToolbar };
