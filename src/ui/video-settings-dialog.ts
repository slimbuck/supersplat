import { BooleanInput, Button, Container, Label, SelectInput, VectorInput } from '@playcanvas/pcui';

import { Events } from '../events';
import { VideoSettings } from '../render';
import { BaseDialog } from './base-dialog';
import { localize } from './localization';
import { createSvgElement } from './svg';
import sceneExport from './svg/export.svg';

class VideoSettingsDialog extends BaseDialog {
    show: () => Promise<VideoSettings | null>;

    constructor(events: Events, args = {}) {
        super({
            ...args,
            id: 'video-settings-dialog',
            title: localize('popup.render-video.header'),
            okText: localize('panel.render.ok'),
            cancelText: localize('panel.render.cancel')
        });

        // header icon
        this.headerContainer.prepend(createSvgElement(sceneExport, { class: 'ss-dialog-header-icon' }));

        // resolution
        const resolutionLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.render-video.resolution') });
        const resolutionSelect = new SelectInput({
            class: 'ss-dialog-row-control',
            defaultValue: '1080',
            options: [
                { v: '540', t: '960x540' },
                { v: '720', t: '1280x720' },
                { v: '1080', t: '1920x1080' },
                { v: '1440', t: '2560x1440' },
                { v: '4k', t: '3840x2160' }
            ]
        });
        const resolutionRow = new Container({ class: 'ss-dialog-row' });
        resolutionRow.append(resolutionLabel);
        resolutionRow.append(resolutionSelect);

        // format
        const formatLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.render-video.format') });
        const formatSelect = new SelectInput({
            class: 'ss-dialog-row-control',
            defaultValue: 'mp4',
            options: [
                { v: 'mp4', t: 'MP4' },
                { v: 'webm', t: 'WebM' },
                { v: 'mov', t: 'MOV' },
                { v: 'mkv', t: 'MKV' }
            ]
        });
        const formatRow = new Container({ class: 'ss-dialog-row' });
        formatRow.append(formatLabel);
        formatRow.append(formatSelect);

        // codec
        const codecLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.render-video.codec') });
        const codecSelect = new SelectInput({
            class: 'ss-dialog-row-control',
            defaultValue: 'h264',
            options: [
                { v: 'h264', t: 'H.264' },
                { v: 'h265', t: 'H.265/HEVC' }
            ]
        });
        const codecRow = new Container({ class: 'ss-dialog-row' });
        codecRow.append(codecLabel);
        codecRow.append(codecSelect);

        const codecOptions: Record<string, Array<{ v: string, t: string }>> = {
            'mp4': [
                { v: 'h264', t: 'H.264' },
                { v: 'h265', t: 'H.265/HEVC' }
            ],
            'webm': [
                { v: 'vp9', t: 'VP9' },
                { v: 'av1', t: 'AV1' }
            ],
            'mov': [
                { v: 'h264', t: 'H.264' },
                { v: 'h265', t: 'H.265/HEVC' }
            ],
            'mkv': [
                { v: 'h264', t: 'H.264' },
                { v: 'h265', t: 'H.265/HEVC' },
                { v: 'vp9', t: 'VP9' },
                { v: 'av1', t: 'AV1' }
            ]
        };

        formatSelect.on('change', () => {
            const format = formatSelect.value;
            const options = codecOptions[format] || codecOptions.mp4;
            codecSelect.options = options;
            codecSelect.value = format === 'webm' ? 'vp9' : 'h264';
        });

        // framerate
        const frameRateLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.render-video.frame-rate') });
        const frameRateSelect = new SelectInput({
            class: 'ss-dialog-row-control',
            defaultValue: '30',
            options: [
                { v: '12', t: '12 fps' },
                { v: '15', t: '15 fps' },
                { v: '24', t: '24 fps' },
                { v: '25', t: '25 fps' },
                { v: '30', t: '30 fps' },
                { v: '48', t: '48 fps' },
                { v: '60', t: '60 fps' },
                { v: '120', t: '120 fps' }
            ]
        });
        const frameRateRow = new Container({ class: 'ss-dialog-row' });
        frameRateRow.append(frameRateLabel);
        frameRateRow.append(frameRateSelect);

        // bitrate
        const bitrateLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.render-video.bitrate') });
        const bitrateSelect = new SelectInput({
            class: 'ss-dialog-row-control',
            defaultValue: 'high',
            options: [
                { v: 'low', t: 'Low' },
                { v: 'medium', t: 'Medium' },
                { v: 'high', t: 'High' },
                { v: 'ultra', t: 'Ultra' }
            ]
        });
        const bitrateRow = new Container({ class: 'ss-dialog-row' });
        bitrateRow.append(bitrateLabel);
        bitrateRow.append(bitrateSelect);

        // frame range
        const totalFrames = events.invoke('timeline.frames');
        const frameRangeLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.render-video.frame-range') });
        const frameRangeInput = new VectorInput({
            class: 'ss-dialog-row-vector',
            dimensions: 2,
            min: 0,
            max: totalFrames - 1,
            placeholder: [localize('popup.render-video.frame-range-first'), localize('popup.render-video.frame-range-last')],
            precision: 0,
            value: [0, totalFrames - 1]
        });
        const frameRangeRow = new Container({ class: 'ss-dialog-row' });
        frameRangeRow.append(frameRangeLabel);
        frameRangeRow.append(frameRangeInput);

        frameRangeInput.on('change', (value: number[]) => {
            if (value[0] > value[1]) {
                frameRangeInput.value = [value[1], value[0]];
            }
        });

        // portrait mode
        const portraitLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.render-video.portrait') });
        const portraitBoolean = new BooleanInput({ class: 'ss-dialog-row-boolean', value: false });
        const portraitRow = new Container({ class: 'ss-dialog-row' });
        portraitRow.append(portraitLabel);
        portraitRow.append(portraitBoolean);

        // transparent background
        const transparentBgLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.render-video.transparent-bg') });
        const transparentBgBoolean = new BooleanInput({ class: 'ss-dialog-row-boolean', value: false });
        const transparentBgRow = new Container({ class: 'ss-dialog-row' });
        transparentBgRow.append(transparentBgLabel);
        transparentBgRow.append(transparentBgBoolean);
        transparentBgRow.hidden = true;

        // show debug overlays
        const showDebugLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.render-video.show-debug') });
        const showDebugBoolean = new BooleanInput({ class: 'ss-dialog-row-boolean', value: false });
        const showDebugRow = new Container({ class: 'ss-dialog-row' });
        showDebugRow.append(showDebugLabel);
        showDebugRow.append(showDebugBoolean);

        // content
        this.contentContainer.append(resolutionRow);
        this.contentContainer.append(formatRow);
        this.contentContainer.append(codecRow);
        this.contentContainer.append(frameRateRow);
        this.contentContainer.append(bitrateRow);
        this.contentContainer.append(frameRangeRow);
        this.contentContainer.append(portraitRow);
        this.contentContainer.append(transparentBgRow);
        this.contentContainer.append(showDebugRow);

        const reset = () => {
            const totalFrames = events.invoke('timeline.frames');
            frameRangeInput.max = totalFrames - 1;
            frameRangeInput.value = [0, totalFrames - 1];
        };

        this.show = () => {
            reset();
            this.showDialog();

            return new Promise<VideoSettings | null>((resolve) => {
                this.onCancel = () => resolve(null);
                this.onOK = () => {
                    const widths: Record<string, number> = {
                        '540': 960,
                        '720': 1280,
                        '1080': 1920,
                        '1440': 2560,
                        '4k': 3840
                    };
                    const heights: Record<string, number> = {
                        '540': 540,
                        '720': 720,
                        '1080': 1080,
                        '1440': 1440,
                        '4k': 2160
                    };
                    const frameRates: Record<string, number> = {
                        '12': 12,
                        '15': 15,
                        '24': 24,
                        '25': 25,
                        '30': 30,
                        '48': 48,
                        '60': 60,
                        '120': 120
                    };
                    const bppfs: Record<string, number> = {
                        'low': 0.001,
                        'medium': 0.01,
                        'high': 0.1,
                        'ultra': 1
                    };
                    const bbpfFactors: Record<string, number> = {
                        '540': 1,
                        '720': 1 / 2,
                        '1080': 1 / 3,
                        '1440': 1 / 4,
                        '4k': 1 / 5
                    };

                    const portrait = portraitBoolean.value;
                    const width = (portrait ? heights : widths)[resolutionSelect.value];
                    const height = (portrait ? widths : heights)[resolutionSelect.value];
                    const frameRate = frameRates[frameRateSelect.value];
                    const bppf = bppfs[bitrateSelect.value] * bbpfFactors[resolutionSelect.value];
                    const bitrate = Math.floor(10 * width * height * frameRate * bppf);
                    const frameRange = frameRangeInput.value as number[];

                    resolve({
                        startFrame: frameRange[0],
                        endFrame: frameRange[1],
                        frameRate,
                        width,
                        height,
                        bitrate,
                        transparentBg: transparentBgBoolean.value,
                        showDebug: showDebugBoolean.value,
                        format: formatSelect.value as 'mp4' | 'webm' | 'mov' | 'mkv',
                        codec: codecSelect.value as 'h264' | 'h265' | 'vp9' | 'av1'
                    });
                };
            }).finally(() => {
                this.hideDialog();
            });
        };
    }
}

export { VideoSettingsDialog };
