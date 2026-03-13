import { BooleanInput, Button, ColorPicker, Container, Label, SelectInput, SliderInput, TextInput } from '@playcanvas/pcui';

import { Pose } from '../camera-poses';
import { BaseDialog } from './base-dialog';
import { localize } from './localization';
import { Events } from '../events';
import { ExportType, SceneExportOptions } from '../file-handler';
import { AnimTrack, ExperienceSettings, defaultPostEffectSettings } from '../splat-serialize';
import { createSvgElement } from './svg';
import sceneExport from './svg/export.svg';

const removeKnownExtension = (filename: string) => {
    const knownExtensions = [
        '.compressed.ply',
        '.ksplat',
        '.splat',
        '.html',
        '.ply',
        '.sog',
        '.spz',
        '.lcc',
        '.zip'
    ];

    for (let i = 0; i < knownExtensions.length; ++i) {
        const ext = knownExtensions[i];
        if (filename.endsWith(ext)) {
            return filename.slice(0, -ext.length);
        }
    }

    return filename;
};

class ExportPopup extends BaseDialog {
    show: (exportType: ExportType, splatNames: string[], showFilenameEdit: boolean) => Promise<null | SceneExportOptions>;

    constructor(events: Events, args = {}) {
        super({
            ...args,
            id: 'export-popup',
            title: localize('popup.export.header'),
            okText: localize('popup.export'),
            cancelText: localize('popup.cancel')
        });

        // header icon
        this.headerContainer.prepend(createSvgElement(sceneExport, { class: 'ss-dialog-header-icon' }));

        // type
        const viewerTypeLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.export.type') });
        const viewerTypeSelect = new SelectInput({
            class: 'ss-dialog-row-control',
            defaultValue: 'html',
            options: [
                { v: 'html', t: localize('popup.export.html') },
                { v: 'zip', t: localize('popup.export.package') }
            ]
        });
        const viewerTypeRow = new Container({ class: 'ss-dialog-row' });
        viewerTypeRow.append(viewerTypeLabel);
        viewerTypeRow.append(viewerTypeSelect);

        // animation
        const animationLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.export.animation') });
        const animationToggle = new BooleanInput({ class: 'ss-dialog-row-boolean', type: 'toggle', value: false });
        const animationRow = new Container({ class: 'ss-dialog-row' });
        animationRow.append(animationLabel);
        animationRow.append(animationToggle);

        // loop mode
        const loopLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.export.loop-mode') });
        const loopSelect = new SelectInput({
            class: 'ss-dialog-row-control',
            defaultValue: 'repeat',
            options: [
                { v: 'none', t: localize('popup.export.loop-mode.none') },
                { v: 'repeat', t: localize('popup.export.loop-mode.repeat') },
                { v: 'pingpong', t: localize('popup.export.loop-mode.pingpong') }
            ]
        });
        const loopRow = new Container({ class: 'ss-dialog-row' });
        loopRow.append(loopLabel);
        loopRow.append(loopSelect);

        // clear color
        const colorLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.export.background-color') });
        const colorPicker = new ColorPicker({ class: 'ss-dialog-row-control', value: [1, 1, 1, 1] });
        const colorRow = new Container({ class: 'ss-dialog-row' });
        colorRow.append(colorLabel);
        colorRow.append(colorPicker);

        // fov
        const fovLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.export.fov') });
        const fovSlider = new SliderInput({
            class: 'ss-dialog-row-control',
            min: 10,
            max: 120,
            precision: 0,
            value: 60
        });
        const fovRow = new Container({ class: 'ss-dialog-row' });
        fovRow.append(fovLabel);
        fovRow.append(fovSlider);

        // compress
        const compressLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.export.compress-ply') });
        const compressBoolean = new BooleanInput({ class: 'ss-dialog-row-boolean', type: 'toggle' });
        const compressRow = new Container({ class: 'ss-dialog-row' });
        compressRow.append(compressLabel);
        compressRow.append(compressBoolean);

        // spherical harmonic bands
        const bandsLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.export.sh-bands') });
        const bandsSlider = new SliderInput({
            class: 'ss-dialog-row-control',
            min: 0,
            max: 3,
            precision: 0,
            value: 3
        });
        const bandsRow = new Container({ class: 'ss-dialog-row' });
        bandsRow.append(bandsLabel);
        bandsRow.append(bandsSlider);

        // sog iterations
        const iterationsLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.export.iterations') });
        const iterationsSlider = new SliderInput({
            class: 'ss-dialog-row-control',
            min: 1,
            max: 20,
            precision: 0,
            value: 10
        });
        const iterationsRow = new Container({ class: 'ss-dialog-row' });
        iterationsRow.append(iterationsLabel);
        iterationsRow.append(iterationsSlider);

        // filename
        const filenameLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.export.filename') });
        const filenameEntry = new TextInput({ class: 'ss-dialog-row-control' });
        const filenameRow = new Container({ class: 'ss-dialog-row' });
        filenameRow.append(filenameLabel);
        filenameRow.append(filenameEntry);

        // content
        this.contentContainer.append(viewerTypeRow);
        this.contentContainer.append(animationRow);
        this.contentContainer.append(loopRow);
        this.contentContainer.append(colorRow);
        this.contentContainer.append(fovRow);
        this.contentContainer.append(compressRow);
        this.contentContainer.append(bandsRow);
        this.contentContainer.append(iterationsRow);
        this.contentContainer.append(filenameRow);

        const updateExtension = (ext: string) => {
            filenameEntry.value = removeKnownExtension(filenameEntry.value) + ext;
        };

        compressBoolean.on('change', () => {
            updateExtension(compressBoolean.value ? '.compressed.ply' : '.ply');
        });

        viewerTypeSelect.on('change', () => {
            updateExtension(viewerTypeSelect.value === 'html' ? '.html' : '.zip');
        });

        animationToggle.on('change', (value: boolean) => {
            loopSelect.enabled = value;
        });

        const reset = (exportType: ExportType, splatNames: string[], hasPoses: boolean) => {
            const allRows = [
                viewerTypeRow, animationRow, loopRow, colorRow, fovRow, compressRow, bandsRow, iterationsRow, filenameRow
            ];

            const activeRows = {
                ply: [compressRow, bandsRow, filenameRow],
                splat: [filenameRow],
                sog: [bandsRow, iterationsRow, filenameRow],
                viewer: [viewerTypeRow, animationRow, loopRow, colorRow, fovRow, bandsRow, filenameRow]
            }[exportType];

            allRows.forEach((r) => {
                r.hidden = activeRows.indexOf(r) === -1;
            });

            bandsSlider.value = events.invoke('view.bands');
            compressBoolean.value = false;
            iterationsSlider.value = 10;

            filenameEntry.value = splatNames[0];
            switch (exportType) {
                case 'ply':
                    updateExtension('.ply');
                    break;
                case 'splat':
                    updateExtension('.splat');
                    break;
                case 'sog':
                    updateExtension('.sog');
                    break;
                case 'viewer':
                    updateExtension(viewerTypeSelect.value === 'html' ? '.html' : '.zip');
                    break;
            }

            const bgClr = events.invoke('bgClr');
            animationToggle.value = hasPoses;
            animationToggle.enabled = hasPoses;
            loopSelect.value = 'repeat';
            loopSelect.enabled = hasPoses;
            colorPicker.value = [bgClr.r, bgClr.g, bgClr.b];
            fovSlider.value = events.invoke('camera.fov');
        };

        this.show = (exportType: ExportType, splatNames: string[], showFilenameEdit: boolean) => {
            const frames = events.invoke('timeline.frames');
            const frameRate = events.invoke('timeline.frameRate');
            const smoothness = events.invoke('timeline.smoothness');
            const orderedPoses = (events.invoke('camera.poses') as Pose[])
            .slice()
            .filter(p => p.frame >= 0 && p.frame < frames)
            .sort((a, b) => a.frame - b.frame);

            reset(exportType, splatNames, orderedPoses.length > 0);
            filenameRow.hidden = !showFilenameEdit;

            this.showDialog();

            const assemblePlyOptions = () : SceneExportOptions => {
                return {
                    filename: filenameEntry.value,
                    splatIdx: 'all',
                    serializeSettings: { maxSHBands: bandsSlider.value },
                    compressedPly: compressBoolean.value
                };
            };

            const assembleSplatOptions = () : SceneExportOptions => {
                return {
                    filename: filenameEntry.value,
                    splatIdx: 'all',
                    serializeSettings: { }
                };
            };

            const assembleSogOptions = () : SceneExportOptions => {
                return {
                    filename: filenameEntry.value,
                    splatIdx: 'all',
                    serializeSettings: { maxSHBands: bandsSlider.value },
                    sogIterations: iterationsSlider.value
                };
            };

            const assembleViewerOptions = () : SceneExportOptions => {
                const fov = fovSlider.value;
                const pose = events.invoke('camera.getPose');
                const p = pose?.position;
                const t = pose?.target;
                const cameras = (p && t) ? [{
                    initial: {
                        position: [p.x, p.y, p.z] as [number, number, number],
                        target: [t.x, t.y, t.z] as [number, number, number],
                        fov
                    }
                }] : [];

                const includeAnimation = animationToggle.value;
                const animTracks: AnimTrack[] = [];

                if (includeAnimation && orderedPoses.length > 0) {
                    const times: number[] = [];
                    const position: number[] = [];
                    const target: number[] = [];
                    const fovKeys: number[] = [];
                    for (let i = 0; i < orderedPoses.length; ++i) {
                        const op = orderedPoses[i];
                        times.push(op.frame);
                        position.push(op.position.x, op.position.y, op.position.z);
                        target.push(op.target.x, op.target.y, op.target.z);
                        fovKeys.push(op.fov ?? fov);
                    }

                    animTracks.push({
                        name: 'cameraAnim',
                        duration: frames / frameRate,
                        frameRate,
                        loopMode: loopSelect.value as 'none' | 'repeat' | 'pingpong',
                        interpolation: 'spline',
                        smoothness,
                        keyframes: {
                            times,
                            values: { position, target, fov: fovKeys }
                        }
                    });
                }

                const bgColor = colorPicker.value.slice(0, 3) as [number, number, number];

                const experienceSettings: ExperienceSettings = {
                    version: 2,
                    tonemapping: 'none',
                    highPrecisionRendering: false,
                    background: { color: bgColor },
                    postEffectSettings: defaultPostEffectSettings,
                    animTracks,
                    cameras,
                    annotations: [],
                    startMode: includeAnimation ? 'animTrack' : 'default'
                };

                return {
                    filename: filenameEntry.value,
                    splatIdx: 'all',
                    serializeSettings: { maxSHBands: bandsSlider.value },
                    viewerExportSettings: {
                        type: viewerTypeSelect.value,
                        experienceSettings
                    }
                };
            };

            return new Promise<null | SceneExportOptions>((resolve) => {
                this.onCancel = () => resolve(null);
                this.onOK = () => {
                    switch (exportType) {
                        case 'ply': resolve(assemblePlyOptions()); break;
                        case 'splat': resolve(assembleSplatOptions()); break;
                        case 'sog': resolve(assembleSogOptions()); break;
                        case 'viewer': resolve(assembleViewerOptions()); break;
                    }
                };
            }).finally(() => {
                this.hideDialog();
            });
        };
    }
}

export { ExportPopup };
