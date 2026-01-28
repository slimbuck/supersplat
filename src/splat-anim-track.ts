import { Quat, Vec3 } from 'playcanvas';

import { CubicSpline } from './anim/spline';
import { AnimTrack } from './anim-track';
import { Events } from './events';
import { Splat } from './splat';

type TransformKey = {
    frame: number;
    position: Vec3;
    rotation: Quat;
    scale: Vec3;
};

/**
 * Splat animation track that manages transform keyframes and interpolation.
 * Implements AnimTrack interface so it can be used with the timeline system.
 */
class SplatAnimTrack implements AnimTrack {
    private keyframes: TransformKey[] = [];
    private events: Events;
    private splat: Splat;
    private positionSpline: CubicSpline | null = null;
    private scaleSpline: CubicSpline | null = null;
    private onTimelineChange: ((frame: number) => void) | null = null;

    constructor(events: Events, splat: Splat) {
        this.events = events;
        this.splat = splat;
    }

    get keys(): readonly number[] {
        return this.keyframes.map(k => k.frame);
    }

    addKey(frame: number): void {
        const entity = this.splat.entity;
        const position = entity.getLocalPosition().clone();
        const rotation = entity.getLocalRotation().clone();
        const scale = entity.getLocalScale().clone();

        const existingIndex = this.keyframes.findIndex(k => k.frame === frame);
        const isNew = existingIndex === -1;

        const newKey: TransformKey = {
            frame,
            position,
            rotation,
            scale
        };

        if (isNew) {
            this.keyframes.push(newKey);
            this.rebuildSplines();
            this.events.fire('track.keyAdded', frame);
        } else {
            this.keyframes[existingIndex] = newKey;
            this.rebuildSplines();
            this.events.fire('track.keyUpdated', frame);
        }
    }

    removeKey(frame: number): void {
        const index = this.keyframes.findIndex(k => k.frame === frame);
        if (index !== -1) {
            this.keyframes.splice(index, 1);
            this.rebuildSplines();
            this.events.fire('track.keyRemoved', frame);
        }
    }

    moveKey(fromFrame: number, toFrame: number): void {
        if (fromFrame === toFrame) return;

        const index = this.keyframes.findIndex(k => k.frame === fromFrame);
        if (index === -1) return;

        // Remove any existing keyframe at the target frame
        const toIndex = this.keyframes.findIndex(k => k.frame === toFrame);
        if (toIndex !== -1) {
            this.keyframes.splice(toIndex, 1);
        }

        // Update the frame
        this.keyframes[index].frame = toFrame;
        this.rebuildSplines();
        this.events.fire('track.keyMoved', fromFrame, toFrame);
    }

    evaluate(frame: number): void {
        this.onTimelineChange?.(frame);
    }

    clear(): void {
        this.keyframes.length = 0;
        this.positionSpline = null;
        this.scaleSpline = null;
        this.onTimelineChange = null;
        this.events.fire('track.keysCleared');
    }

    /**
     * Get all keyframes (used for serialization).
     */
    getKeyframes(): readonly TransformKey[] {
        return this.keyframes;
    }

    /**
     * Load keyframes from serialized data.
     */
    loadKeyframes(keyframesData: TransformKey[]): void {
        this.keyframes.length = 0;
        keyframesData.forEach((kf) => {
            this.keyframes.push({
                frame: kf.frame,
                position: new Vec3(kf.position.x, kf.position.y, kf.position.z),
                rotation: new Quat(kf.rotation.x, kf.rotation.y, kf.rotation.z, kf.rotation.w),
                scale: new Vec3(kf.scale.x, kf.scale.y, kf.scale.z)
            });
        });
        this.rebuildSplines();
        this.events.fire('track.keysLoaded', this.keys);
    }

    private rebuildSplines(): void {
        const duration = this.events.invoke('timeline.frames');
        const smoothness = this.events.invoke('timeline.smoothness');

        const orderedKeys = this.keyframes.slice()
        .filter(k => k.frame < duration)
        .sort((a, b) => a.frame - b.frame);

        if (orderedKeys.length < 2) {
            this.positionSpline = null;
            this.scaleSpline = null;
            this.onTimelineChange = null;
            return;
        }

        // Build position spline
        const times = orderedKeys.map(k => k.frame);
        const posPoints: number[] = [];
        const scalePoints: number[] = [];

        for (const key of orderedKeys) {
            posPoints.push(key.position.x, key.position.y, key.position.z);
            scalePoints.push(key.scale.x, key.scale.y, key.scale.z);
        }

        this.positionSpline = CubicSpline.fromPointsLooping(duration, times, posPoints, smoothness);
        this.scaleSpline = CubicSpline.fromPointsLooping(duration, times, scalePoints, smoothness);

        // Store ordered keys for rotation slerp
        const rotationKeys = orderedKeys;

        const posResult: number[] = [];
        const scaleResult: number[] = [];
        const position = new Vec3();
        const rotation = new Quat();
        const scale = new Vec3();

        this.onTimelineChange = (frame: number) => {
            // Evaluate position spline
            this.positionSpline!.evaluate(frame, posResult);
            position.set(posResult[0], posResult[1], posResult[2]);

            // Evaluate scale spline
            this.scaleSpline!.evaluate(frame, scaleResult);
            scale.set(scaleResult[0], scaleResult[1], scaleResult[2]);

            // Interpolate rotation using slerp
            // Find the two keyframes to interpolate between
            let prevKey = rotationKeys[rotationKeys.length - 1];
            let nextKey = rotationKeys[0];
            let t = 0;

            for (let i = 0; i < rotationKeys.length; i++) {
                if (rotationKeys[i].frame > frame) {
                    nextKey = rotationKeys[i];
                    prevKey = rotationKeys[i > 0 ? i - 1 : rotationKeys.length - 1];
                    break;
                }
                if (i === rotationKeys.length - 1) {
                    // Frame is after last key, interpolate to first key (looping)
                    prevKey = rotationKeys[i];
                    nextKey = rotationKeys[0];
                }
            }

            // Calculate interpolation factor
            const prevFrame = prevKey.frame;
            let nextFrame = nextKey.frame;

            // Handle looping case
            if (nextFrame <= prevFrame) {
                nextFrame += duration;
            }
            if (frame < prevFrame) {
                // We're before the first key, wrap around
                t = (frame + duration - prevFrame) / (nextFrame - prevFrame);
            } else {
                t = (frame - prevFrame) / (nextFrame - prevFrame);
            }

            t = Math.max(0, Math.min(1, t));

            // Slerp between rotations
            rotation.slerp(prevKey.rotation, nextKey.rotation, t);

            // Apply transform to splat
            this.splat.move(position, rotation, scale);
        };
    }
}

export { SplatAnimTrack, TransformKey };
