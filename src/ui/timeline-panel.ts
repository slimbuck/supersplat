import { Button, Container, NumericInput, SelectInput } from '@playcanvas/pcui';

import { Events } from '../events';
import { ShortcutManager } from '../shortcut-manager';
import { localize } from './localization';
import { Tooltips } from './tooltips';

class Ticks extends Container {
    constructor(events: Events, tooltips: Tooltips, args = {}) {
        args = {
            ...args,
            id: 'ticks'
        };

        super(args);

        const workArea = new Container({
            id: 'ticks-area'
        });

        this.append(workArea);

        let frameFromOffset: (offset: number) => number;
        let moveCursor: (frame: number) => void;
        let keyElements: HTMLElement[] = [];

        // rebuild the timeline
        const rebuild = () => {
            // clear existing labels
            workArea.dom.innerHTML = '';
            keyElements = [];

            const numFrames = events.invoke('timeline.frames');
            const currentFrame = events.invoke('timeline.frame');

            const padding = 20;
            const width = this.dom.getBoundingClientRect().width - padding * 2;
            const labelStep = Math.max(1, Math.floor(numFrames / Math.max(1, Math.floor(width / 50))));
            const numLabels = Math.max(1, Math.ceil(numFrames / labelStep));

            const offsetFromFrame = (frame: number) => {
                return padding + Math.floor(frame / (numFrames - 1) * width);
            };

            frameFromOffset = (offset: number) => {
                return Math.max(0, Math.min(numFrames - 1, Math.floor((offset - padding) / width * (numFrames - 1))));
            };

            // timeline labels

            for (let i = 0; i < numLabels; i++) {
                const thisFrame = Math.floor(i * labelStep);
                const label = document.createElement('div');
                label.classList.add('time-label');
                label.style.left = `${offsetFromFrame(thisFrame)}px`;
                label.textContent = thisFrame.toString();
                workArea.dom.appendChild(label);
            }

            // keys - get from active track
            const keys = events.invoke('track.keys') as number[] ?? [];

            const createKey = (keyFrame: number) => {
                const label = document.createElement('div');
                label.classList.add('time-label', 'key');
                label.style.left = `${offsetFromFrame(keyFrame)}px`;
                let dragging = false;
                let toFrame = -1;
                const fromFrame = keyFrame;

                label.addEventListener('pointerdown', (event) => {
                    if (!dragging && event.isPrimary) {
                        dragging = true;
                        label.classList.add('dragging');
                        label.setPointerCapture(event.pointerId);
                        event.stopPropagation();
                    }
                });

                label.addEventListener('pointermove', (event: PointerEvent) => {
                    if (dragging) {
                        toFrame = frameFromOffset(parseInt(label.style.left, 10) + event.offsetX);
                        label.style.left = `${offsetFromFrame(toFrame)}px`;
                    }
                });

                label.addEventListener('pointerup', (event: PointerEvent) => {
                    if (dragging && event.isPrimary) {
                        if (fromFrame !== toFrame && toFrame >= 0) {
                            events.fire('track.moveKey', fromFrame, toFrame);
                        }

                        label.releasePointerCapture(event.pointerId);
                        label.classList.remove('dragging');
                        dragging = false;
                    }
                });

                workArea.dom.appendChild(label);
                keyElements.push(label);
            };

            keys.forEach(createKey);

            // cursor

            const cursor = document.createElement('div');
            cursor.classList.add('time-label', 'cursor');
            cursor.style.left = `${offsetFromFrame(currentFrame)}px`;
            cursor.textContent = currentFrame.toString();
            workArea.dom.appendChild(cursor);

            moveCursor = (frame: number) => {
                cursor.style.left = `${offsetFromFrame(frame)}px`;
                cursor.textContent = frame.toString();
            };
        };

        // handle scrubbing

        let scrubbing = false;

        workArea.dom.addEventListener('pointerdown', (event: PointerEvent) => {
            if (!scrubbing && event.isPrimary) {
                scrubbing = true;
                workArea.dom.setPointerCapture(event.pointerId);
                events.fire('timeline.setFrame', frameFromOffset(event.offsetX));
            }
        });

        workArea.dom.addEventListener('pointermove', (event: PointerEvent) => {
            if (scrubbing) {
                events.fire('timeline.setFrame', frameFromOffset(event.offsetX));
            }
        });

        workArea.dom.addEventListener('pointerup', (event: PointerEvent) => {
            if (scrubbing && event.isPrimary) {
                workArea.dom.releasePointerCapture(event.pointerId);
                scrubbing = false;
            }
        });

        // rebuild the timeline on dom resize
        new ResizeObserver(() => rebuild()).observe(workArea.dom);

        // rebuild when timeline frames change
        events.on('timeline.frames', () => {
            rebuild();
        });

        events.on('timeline.frame', (frame: number) => {
            moveCursor?.(frame);
        });

        // Rebuild when selection changes (to show different track's keys)
        events.on('selection.changed', () => {
            rebuild();
        });

        // Rebuild when track keys change
        events.on('track.keyAdded', () => {
            rebuild();
        });

        events.on('track.keyRemoved', () => {
            rebuild();
        });

        events.on('track.keyMoved', () => {
            rebuild();
        });

        events.on('track.keysLoaded', () => {
            rebuild();
        });

        events.on('track.keysChanged', () => {
            rebuild();
        });

        events.on('track.keysCleared', () => {
            rebuild();
        });
    }
}

class TimelinePanel extends Container {
    constructor(events: Events, tooltips: Tooltips, args = {}) {
        args = {
            ...args,
            id: 'timeline-panel'
        };

        super(args);

        // play controls

        const prev = new Button({
            class: 'button',
            text: '\uE162'
        });

        const play = new Button({
            class: 'button',
            text: '\uE131'
        });

        const next = new Button({
            class: 'button',
            text: '\uE164'
        });

        // key controls

        const addKey = new Button({
            class: 'button',
            text: '\uE120'
        });

        const removeKey = new Button({
            class: 'button',
            text: '\uE121',
            enabled: false
        });

        const buttonControls = new Container({
            id: 'button-controls'
        });
        buttonControls.append(prev);
        buttonControls.append(play);
        buttonControls.append(next);
        buttonControls.append(addKey);
        buttonControls.append(removeKey);

        // settings

        const speed = new SelectInput({
            id: 'speed',
            defaultValue: 30,
            options: [
                { v: 1, t: '1 fps' },
                { v: 6, t: '6 fps' },
                { v: 12, t: '12 fps' },
                { v: 24, t: '24 fps' },
                { v: 30, t: '30 fps' },
                { v: 60, t: '60 fps' }
            ]
        });

        speed.on('change', (value: string) => {
            events.fire('timeline.setFrameRate', parseInt(value, 10));
        });

        events.on('timeline.frameRate', (frameRate: number) => {
            speed.value = frameRate.toString();
        });

        const frames = new NumericInput({
            id: 'totalFrames',
            value: 180,
            min: 1,
            max: 10000,
            precision: 0
        });

        frames.on('change', (value: number) => {
            events.fire('timeline.setFrames', value);
        });

        events.on('timeline.frames', (framesIn: number) => {
            frames.value = framesIn;
        });

        // smoothness

        const smoothness = new NumericInput({
            id: 'smoothness',
            min: 0,
            max: 1,
            step: 0.05,
            value: 1
        });

        smoothness.on('change', (value: number) => {
            events.fire('timeline.setSmoothness', value);
        });

        events.on('timeline.smoothness', (smoothnessIn: number) => {
            smoothness.value = smoothnessIn;
        });

        const settingsControls = new Container({
            id: 'settings-controls'
        });
        settingsControls.append(speed);
        settingsControls.append(frames);
        settingsControls.append(smoothness);

        // append control groups

        const controlsWrap = new Container({
            id: 'controls-wrap'
        });

        const spacerL = new Container({
            class: 'spacer'
        });

        const spacerR = new Container({
            class: 'spacer'
        });
        spacerR.append(settingsControls);

        controlsWrap.append(spacerL);
        controlsWrap.append(buttonControls);
        controlsWrap.append(spacerR);

        const ticks = new Ticks(events, tooltips);

        this.append(controlsWrap);
        this.append(ticks);

        // Helper to check if an animatable target is selected
        const hasAnimatableSelection = () => {
            // Camera is always animatable
            if (events.invoke('selection.isCamera')) {
                return true;
            }
            // Check if selected splat has an animation track
            const selection = events.invoke('selection');
            if (selection && 'animTrack' in selection && selection.animTrack) {
                return true;
            }
            return false;
        };

        // Helper to check if current frame has a key
        const canDeleteKey = () => {
            const keys = events.invoke('track.keys') as number[] ?? [];
            const frame = events.invoke('timeline.frame');
            return keys.includes(frame);
        };

        // Update key button states based on selection
        const updateKeyButtonStates = () => {
            const hasAnimatable = hasAnimatableSelection();
            addKey.enabled = hasAnimatable;
            removeKey.enabled = hasAnimatable && canDeleteKey();
        };

        // ui handlers

        prev.on('click', () => {
            events.fire('timeline.prevKey');
        });

        next.on('click', () => {
            events.fire('timeline.nextKey');
        });

        play.on('click', () => {
            if (events.invoke('timeline.playing')) {
                events.fire('timeline.setPlaying', false);
            } else {
                events.fire('timeline.setPlaying', true);
            }
        });

        // Sync play button icon when playing state changes (e.g. via keyboard shortcut)
        events.on('timeline.playing', (isPlaying: boolean) => {
            play.text = isPlaying ? '\uE135' : '\uE131';
        });

        addKey.on('click', () => {
            events.fire('track.addKey');
        });

        removeKey.on('click', () => {
            const frame = events.invoke('timeline.frame');
            events.fire('track.removeKey', frame);
        });

        // Update button states when frame changes
        events.on('timeline.frame', () => {
            updateKeyButtonStates();
        });

        // Update button states when selection changes
        events.on('selection.changed', () => {
            updateKeyButtonStates();
        });

        // Update button states when track keys change
        events.on('track.keyAdded', () => {
            updateKeyButtonStates();
        });

        events.on('track.keyRemoved', () => {
            updateKeyButtonStates();
        });

        events.on('track.keyMoved', () => {
            updateKeyButtonStates();
        });

        events.on('track.keysLoaded', () => {
            updateKeyButtonStates();
        });

        events.on('track.keysCleared', () => {
            updateKeyButtonStates();
        });

        // cancel animation playback if user interacts with camera
        events.on('camera.controller', (type: string) => {
            if (events.invoke('timeline.playing')) {
                // stop
            }
        });

        // tooltips
        const shortcutManager: ShortcutManager = events.invoke('shortcutManager');
        const tooltip = (localeKey: string, shortcutId?: string) => {
            const text = localize(localeKey);
            if (shortcutId) {
                const shortcut = shortcutManager.formatShortcut(shortcutId);
                if (shortcut) {
                    return `${text} ( ${shortcut} )`;
                }
            }
            return text;
        };

        tooltips.register(prev, tooltip('tooltip.timeline.prev-key', 'timeline.prevKey'), 'top');
        tooltips.register(play, tooltip('tooltip.timeline.play', 'timeline.togglePlay'), 'top');
        tooltips.register(next, tooltip('tooltip.timeline.next-key', 'timeline.nextKey'), 'top');
        tooltips.register(addKey, tooltip('tooltip.timeline.add-key', 'timeline.addKey'), 'top');
        tooltips.register(removeKey, tooltip('tooltip.timeline.remove-key', 'timeline.removeKey'), 'top');
        tooltips.register(speed, localize('tooltip.timeline.frame-rate'), 'top');
        tooltips.register(frames, localize('tooltip.timeline.total-frames'), 'top');
        tooltips.register(smoothness, localize('tooltip.timeline.smoothness'), 'top');
    }
}

export { TimelinePanel };
