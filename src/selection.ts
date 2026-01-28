import { Camera } from './camera';
import { Element, ElementType } from './element';
import { Events } from './events';
import { Scene } from './scene';
import { Splat } from './splat';

/**
 * Selectable element type - can be a Splat or Camera.
 */
type Selectable = Splat | Camera | null;

const registerSelectionEvents = (events: Events, scene: Scene) => {
    let selection: Selectable = null;

    const setSelection = (element: Selectable) => {
        // For splats, check visibility
        if (element && element.type === ElementType.splat) {
            const splat = element as Splat;
            if (!splat.visible) {
                return; // Don't select hidden splats
            }
        }

        if (element !== selection) {
            const prev = selection;
            selection = element;
            events.fire('selection.changed', selection, prev);
        }
    };

    events.on('selection', (element: Selectable) => {
        setSelection(element);
    });

    events.function('selection', () => {
        return selection;
    });

    // Check if camera is currently selected
    events.function('selection.isCamera', () => {
        return selection !== null && selection.type === ElementType.camera;
    });

    // Check if a splat is currently selected
    events.function('selection.isSplat', () => {
        return selection !== null && selection.type === ElementType.splat;
    });

    // Get selected splat (returns null if camera or nothing is selected)
    events.function('selection.splat', () => {
        if (selection && selection.type === ElementType.splat) {
            return selection as Splat;
        }
        return null;
    });

    // Get selected camera (returns null if splat or nothing is selected)
    events.function('selection.camera', () => {
        if (selection && selection.type === ElementType.camera) {
            return selection as Camera;
        }
        return null;
    });

    // Select camera
    events.on('selection.selectCamera', () => {
        setSelection(scene.camera);
    });

    events.on('selection.next', () => {
        const splats = scene.getElementsByType(ElementType.splat) as Splat[];
        if (splats.length > 0) {
            if (selection && selection.type === ElementType.splat) {
                const idx = splats.indexOf(selection as Splat);
                setSelection(splats[(idx + 1) % splats.length]);
            } else {
                // If camera is selected, switch to first splat
                setSelection(splats[0]);
            }
        }
    });

    events.on('scene.elementAdded', (element: Element) => {
        if (element.type === ElementType.splat) {
            setSelection(element as Splat);
        }
    });

    events.on('scene.elementRemoved', (element: Element) => {
        if (element === selection) {
            const splats = scene.getElementsByType(ElementType.splat) as Splat[];
            // Select another splat or null if none left
            setSelection(splats.length > 0 ? splats.find(v => v !== element) ?? null : null);
        }
    });

    events.on('splat.visibility', (splat: Splat) => {
        if (splat === selection && !splat.visible) {
            setSelection(null);
        }
    });

    events.on('camera.focalPointPicked', (details: { splat: Splat }) => {
        setSelection(details.splat);
    });
};

export { registerSelectionEvents, Selectable };
