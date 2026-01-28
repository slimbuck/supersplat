import { Events } from './events';

/**
 * Interface for animation tracks that can be attached to animatable targets.
 * Each track owns its keyframes and handles interpolation/evaluation.
 */
interface AnimTrack {
    /** Array of frame numbers where keyframes exist */
    readonly keys: readonly number[];

    /**
     * Add a keyframe at the specified frame, capturing current state.
     * If a key already exists at this frame, it will be updated.
     */
    addKey(frame: number): void;

    /**
     * Remove the keyframe at the specified frame.
     */
    removeKey(frame: number): void;

    /**
     * Move a keyframe from one frame to another.
     */
    moveKey(fromFrame: number, toFrame: number): void;

    /**
     * Evaluate the animation at the given frame and apply to the target.
     */
    evaluate(frame: number): void;

    /**
     * Clear all keyframes.
     */
    clear(): void;
}

/**
 * Interface for objects that can have animation tracks attached.
 */
interface Animatable {
    /** The animation track for this object, if any */
    readonly animTrack: AnimTrack | null;
}

/**
 * Check if an object is animatable (has an animation track).
 */
const isAnimatable = (obj: any): obj is Animatable => {
    return obj && 'animTrack' in obj && obj.animTrack !== null;
};

/**
 * Register animation track events on the event system.
 * These events delegate to the currently selected animatable's track.
 */
const registerAnimTrackEvents = (events: Events) => {
    // Get the animation track of the currently selected element
    const getActiveTrack = (): AnimTrack | null => {
        // Check if camera is selected
        const cameraSelected = events.invoke('selection.isCamera');
        if (cameraSelected) {
            return events.invoke('camera.animTrack');
        }

        // Check if selection has an animation track
        const selection = events.invoke('selection');
        if (selection && isAnimatable(selection)) {
            return selection.animTrack;
        }

        return null;
    };

    // Get keys from active track
    events.function('track.keys', () => {
        const track = getActiveTrack();
        return track ? track.keys : [];
    });

    // Add key to active track
    events.on('track.addKey', (frame?: number) => {
        const track = getActiveTrack();
        if (track) {
            const keyFrame = frame ?? events.invoke('timeline.frame');
            track.addKey(keyFrame);
        }
    });

    // Remove key from active track
    events.on('track.removeKey', (frame?: number) => {
        const track = getActiveTrack();
        if (track) {
            const keyFrame = frame ?? events.invoke('timeline.frame');
            track.removeKey(keyFrame);
        }
    });

    // Move key in active track
    events.on('track.moveKey', (fromFrame: number, toFrame: number) => {
        const track = getActiveTrack();
        if (track) {
            track.moveKey(fromFrame, toFrame);
        }
    });
};

export { AnimTrack, Animatable, isAnimatable, registerAnimTrackEvents };
