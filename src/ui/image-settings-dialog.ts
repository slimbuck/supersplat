import { BooleanInput, Button, Container, Label, NumericInput, SelectInput, VectorInput } from '@playcanvas/pcui';

import { Events } from '../events';
import { ImageSettings } from '../render';
import { BaseDialog } from './base-dialog';
import { localize } from './localization';
import { createSvgElement } from './svg';
import sceneExport from './svg/export.svg';

class ImageSettingsDialog extends BaseDialog {
    show: () => Promise<ImageSettings | null>;

    constructor(events: Events, args = {}) {
        super({
            ...args,
            id: 'image-settings-dialog',
            title: localize('popup.render-image.header'),
            okText: localize('panel.render.ok'),
            cancelText: localize('panel.render.cancel')
        });

        // header icon
        this.headerContainer.prepend(createSvgElement(sceneExport, { class: 'ss-dialog-header-icon' }));

        // preset
        const presetLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.render-image.preset') });
        const presetSelect = new SelectInput({
            class: 'ss-dialog-row-control',
            defaultValue: 'viewport',
            options: [
                { v: 'viewport', t: localize('popup.render-image.resolution-current') },
                { v: 'HD', t: 'HD' },
                { v: 'QHD', t: 'QHD' },
                { v: '4K', t: '4K' },
                { v: 'custom', t: localize('popup.render-image.resolution-custom') }
            ]
        });
        const presetRow = new Container({ class: 'ss-dialog-row' });
        presetRow.append(presetLabel);
        presetRow.append(presetSelect);

        // resolution
        const resolutionLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.render-image.resolution') });
        const resolutionValue = new VectorInput({
            class: 'ss-dialog-row-vector',
            dimensions: 2,
            min: 4,
            max: 16000,
            precision: 0,
            value: [1024, 768]
        });
        const resolutionRow = new Container({ class: 'ss-dialog-row', enabled: false });
        resolutionRow.append(resolutionLabel);
        resolutionRow.append(resolutionValue);

        // transparent background
        const transparentBgLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.render-image.transparent-bg') });
        const transparentBgBoolean = new BooleanInput({ class: 'ss-dialog-row-boolean', value: false });
        const transparentBgRow = new Container({ class: 'ss-dialog-row' });
        transparentBgRow.append(transparentBgLabel);
        transparentBgRow.append(transparentBgBoolean);

        // show debug overlays
        const showDebugLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.render-image.show-debug') });
        const showDebugBoolean = new BooleanInput({ class: 'ss-dialog-row-boolean', value: false });
        const showDebugRow = new Container({ class: 'ss-dialog-row' });
        showDebugRow.append(showDebugLabel);
        showDebugRow.append(showDebugBoolean);

        // content
        this.contentContainer.append(presetRow);
        this.contentContainer.append(resolutionRow);
        this.contentContainer.append(transparentBgRow);
        this.contentContainer.append(showDebugRow);

        let targetSize: { width: number, height: number };

        const updateResolution = () => {
            const widths: Record<string, number> = {
                'viewport': targetSize.width,
                'HD': 1920,
                'QHD': 2560,
                '4K': 3840
            };

            const heights: Record<string, number> = {
                'viewport': targetSize.height,
                'HD': 1080,
                'QHD': 1440,
                '4K': 2160
            };

            resolutionValue.value = [
                widths[presetSelect.value] ?? resolutionValue.value[0],
                heights[presetSelect.value] ?? resolutionValue.value[1]
            ];
        };

        presetSelect.on('change', () => {
            resolutionRow.enabled = presetSelect.value === 'custom';

            if (presetSelect.value !== 'custom') {
                updateResolution();
            }
        });

        // reset UI
        const reset = () => {
            updateResolution();
        };

        this.show = () => {
            targetSize = events.invoke('targetSize');
            reset();
            this.showDialog();

            return new Promise<ImageSettings | null>((resolve) => {
                this.onCancel = () => resolve(null);
                this.onOK = () => {
                    const [width, height] = resolutionValue.value;
                    resolve({
                        width,
                        height,
                        transparentBg: transparentBgBoolean.value,
                        showDebug: showDebugBoolean.value
                    });
                };
            }).finally(() => {
                this.hideDialog();
            });
        };
    }
}

export { ImageSettingsDialog };
