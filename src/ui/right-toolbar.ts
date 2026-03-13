import { Button, Container } from '@playcanvas/pcui';

import { Events } from '../events';
import { parseSvg } from './svg';
import cameraFrameSelectionSvg from './svg/camera-frame-selection.svg';
import cameraResetSvg from './svg/camera-reset.svg';
import centersSvg from './svg/centers.svg';
import colorPanelSvg from './svg/color-panel.svg';
import flyCameraSvg from './svg/fly-camera.svg';
import orbitCameraSvg from './svg/orbit-camera.svg';
import ringsSvg from './svg/rings.svg';
import showHideSplatsSvg from './svg/show-hide-splats.svg';
import { buildTooltipText, createToolbarButton, createToolbarSeparator, stopToolbarPointerEvents } from './toolbar-utils';
import { Tooltips } from './tooltips';

class RightToolbar extends Container {
    constructor(events: Events, tooltips: Tooltips, args = {}) {
        super({
            ...args,
            id: 'right-toolbar'
        });

        stopToolbarPointerEvents(this.dom);

        const ringsModeToggle = new Button({
            id: 'right-toolbar-mode-toggle',
            class: 'right-toolbar-toggle'
        });

        const showHideSplats = createToolbarButton(showHideSplatsSvg, ['right-toolbar-toggle', 'active'], 'right-toolbar-show-hide');
        const orbitMode = createToolbarButton(orbitCameraSvg, ['right-toolbar-toggle', 'active'], 'right-toolbar-orbit-mode');
        const flyMode = createToolbarButton(flyCameraSvg, 'right-toolbar-toggle', 'right-toolbar-fly-mode');
        const cameraFrameSelection = createToolbarButton(cameraFrameSelectionSvg, 'right-toolbar-button', 'right-toolbar-frame-selection');
        const cameraReset = createToolbarButton(cameraResetSvg, 'right-toolbar-button', 'right-toolbar-camera-origin');
        const colorPanel = createToolbarButton(colorPanelSvg, 'right-toolbar-toggle', 'right-toolbar-color-panel');

        const options = new Button({
            id: 'right-toolbar-options',
            class: 'right-toolbar-toggle',
            icon: 'E283'
        });

        const centersDom = parseSvg(centersSvg);
        const ringsDom = parseSvg(ringsSvg);
        ringsDom.style.display = 'none';

        ringsModeToggle.dom.appendChild(centersDom);
        ringsModeToggle.dom.appendChild(ringsDom);

        const sep = () => createToolbarSeparator('right-toolbar-separator');

        this.append(ringsModeToggle);
        this.append(showHideSplats);
        this.append(sep());
        this.append(orbitMode);
        this.append(flyMode);
        this.append(sep());
        this.append(cameraFrameSelection);
        this.append(cameraReset);
        this.append(sep());
        this.append(colorPanel);
        this.append(options);

        const tip = (key: string, shortcut?: string) => buildTooltipText(events, key, shortcut);

        tooltips.register(ringsModeToggle, tip('tooltip.right-toolbar.splat-mode', 'camera.toggleMode'), 'left');
        tooltips.register(showHideSplats, tip('tooltip.right-toolbar.show-hide', 'camera.toggleOverlay'), 'left');
        tooltips.register(orbitMode, tip('tooltip.right-toolbar.orbit-camera', 'camera.toggleControlMode'), 'left');
        tooltips.register(flyMode, tip('tooltip.right-toolbar.fly-camera', 'camera.toggleControlMode'), 'left');
        tooltips.register(cameraFrameSelection, tip('tooltip.right-toolbar.frame-selection', 'camera.focus'), 'left');
        tooltips.register(cameraReset, tip('tooltip.right-toolbar.reset-camera', 'camera.reset'), 'left');
        tooltips.register(colorPanel, tip('tooltip.right-toolbar.colors'), 'left');
        tooltips.register(options, tip('tooltip.right-toolbar.view-options'), 'left');

        ringsModeToggle.on('click', () => {
            events.fire('camera.toggleMode');
            events.fire('camera.setOverlay', true);
        });
        showHideSplats.on('click', () => events.fire('camera.toggleOverlay'));
        orbitMode.on('click', () => events.fire('camera.setControlMode', 'orbit'));
        flyMode.on('click', () => events.fire('camera.setControlMode', 'fly'));
        cameraFrameSelection.on('click', () => events.fire('camera.focus'));
        cameraReset.on('click', () => events.fire('camera.reset'));
        colorPanel.on('click', () => events.fire('colorPanel.toggleVisible'));
        options.on('click', () => events.fire('viewPanel.toggleVisible'));

        events.on('camera.mode', (mode: string) => {
            ringsModeToggle.class[mode === 'rings' ? 'add' : 'remove']('active');
            centersDom.style.display = mode === 'rings' ? 'none' : 'block';
            ringsDom.style.display = mode === 'rings' ? 'block' : 'none';
        });

        events.on('camera.overlay', (value: boolean) => {
            showHideSplats.class[value ? 'add' : 'remove']('active');
        });

        events.on('camera.controlMode', (mode: 'orbit' | 'fly') => {
            orbitMode.class[mode === 'orbit' ? 'add' : 'remove']('active');
            flyMode.class[mode === 'fly' ? 'add' : 'remove']('active');
        });

        events.on('colorPanel.visible', (visible: boolean) => {
            colorPanel.class[visible ? 'add' : 'remove']('active');
        });

        events.on('viewPanel.visible', (visible: boolean) => {
            options.class[visible ? 'add' : 'remove']('active');
        });
    }
}

export { RightToolbar };
