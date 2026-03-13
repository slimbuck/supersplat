import { BooleanInput, Button, ColorPicker, Container, Label, SelectInput, SliderInput, TextAreaInput, TextInput } from '@playcanvas/pcui';

import { Pose } from '../camera-poses';
import { Events } from '../events';
import { BaseDialog } from './base-dialog';
import { localize } from './localization';
import { PublishSettings, UserStatus } from '../publish';
import { AnimTrack, ExperienceSettings, defaultPostEffectSettings } from '../splat-serialize';
import { createSvgElement } from './svg';
import sceneExport from './svg/export.svg';

class PublishSettingsDialog extends BaseDialog {
    show: (userStatus: UserStatus) => Promise<PublishSettings | null>;

    constructor(events: Events, args = {}) {
        super({
            ...args,
            id: 'publish-settings-dialog',
            title: localize('popup.publish.header'),
            okText: localize('popup.publish.ok'),
            cancelText: localize('popup.publish.cancel')
        });

        // header icon
        this.headerContainer.prepend(createSvgElement(sceneExport, { class: 'ss-dialog-header-icon' }));

        // overwrite
        const overwriteLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.publish.to') });
        const overwriteSelect = new SelectInput({ class: 'ss-dialog-row-control' });
        const overwriteRow = new Container({ class: 'ss-dialog-row' });
        overwriteRow.append(overwriteLabel);
        overwriteRow.append(overwriteSelect);

        // title
        const titleLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.publish.title') });
        const titleInput = new TextInput({ class: 'ss-dialog-row-control' });
        const titleRow = new Container({ class: 'ss-dialog-row' });
        titleRow.append(titleLabel);
        titleRow.append(titleInput);

        // description
        const descLabel = new Label({ class: 'ss-dialog-row-label', text: localize('popup.publish.description') });
        const descInput = new TextAreaInput({ class: 'ss-dialog-row-control' });
        const descRow = new Container({ class: 'ss-dialog-row' });
        descRow.append(descLabel);
        descRow.append(descInput);

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

        // background color
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

        // bands
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

        // content
        this.contentContainer.append(overwriteRow);
        this.contentContainer.append(titleRow);
        this.contentContainer.append(descRow);
        this.contentContainer.append(animationRow);
        this.contentContainer.append(loopRow);
        this.contentContainer.append(colorRow);
        this.contentContainer.append(fovRow);
        this.contentContainer.append(bandsRow);

        overwriteSelect.on('change', () => {
            const isNew = overwriteSelect.value === '0';
            titleInput.disabled = !isNew;
            descInput.disabled = !isNew;
        });

        animationToggle.on('change', (value: boolean) => {
            loopSelect.enabled = value;
        });

        const reset = (hasPoses: boolean, overwriteList: string[]) => {
            const splats = events.invoke('scene.splats');
            const filename = splats[0].filename;
            const dot = splats[0].filename.lastIndexOf('.');
            const bgClr = events.invoke('bgClr');

            overwriteSelect.options = [{
                v: '0', t: localize('popup.publish.new-scene')
            }].concat(overwriteList.map((s, i) => ({ v: (i + 1).toString(), t: s })));

            overwriteSelect.value = '0';
            titleInput.value = filename.slice(0, dot > 0 ? dot : undefined);
            descInput.value = '';
            animationToggle.value = hasPoses;
            animationToggle.enabled = hasPoses;
            loopSelect.value = 'repeat';
            loopSelect.enabled = hasPoses;
            colorPicker.value = [bgClr.r, bgClr.g, bgClr.b];
            fovSlider.value = events.invoke('camera.fov');
            bandsSlider.value = events.invoke('view.bands');
        };

        this.show = (userStatus: UserStatus) => {
            const frames = events.invoke('timeline.frames');
            const frameRate = events.invoke('timeline.frameRate');
            const smoothness = events.invoke('timeline.smoothness');

            const orderedPoses = (events.invoke('camera.poses') as Pose[])
            .slice()
            .filter(p => p.frame >= 0 && p.frame < frames)
            .sort((a, b) => a.frame - b.frame);

            const overwriteList = userStatus.scenes.map((s) => {
                return `${s.hash} - ${s.title}`;
            });

            reset(orderedPoses.length > 0, overwriteList);
            this.showDialog();

            return new Promise<PublishSettings>((resolve) => {
                this.onCancel = () => resolve(null);
                this.onOK = () => {
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
                            fovKeys.push(op.fov);
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

                    const serializeSettings = {
                        maxSHBands: bandsSlider.value,
                        minOpacity: 1 / 255,
                        removeInvalid: true
                    };

                    resolve({
                        user: userStatus.user,
                        title: titleInput.value,
                        description: descInput.value,
                        listed: false,
                        serializeSettings,
                        experienceSettings,
                        overwriteId: overwriteSelect.value !== '0' ? userStatus.scenes[parseInt(overwriteSelect.value, 10) - 1].id : undefined
                    });
                };
            }).finally(() => {
                this.hideDialog();
            });
        };
    }
}

export { PublishSettingsDialog };
