import { Vec3 } from 'playcanvas';

import { CubicSpline } from './anim/spline';
import { AnimTrack } from './anim-track';
import { Events } from './events';

type Pose = {
    name: string,
    frame: number,
    position: Vec3,
    target: Vec3
};

/**
 * Camera animation track that manages camera keyframes and interpolation.
 * Implements AnimTrack interface so it can be used with the timeline system.
 */
class CameraAnimTrack implements AnimTrack {
    private poses: Pose[] = [];
    private events: Events;
    private onTimelineChange: ((frame: number) => void) | null = null;

    constructor(events: Events) {
        this.events = events;
    }

    get keys(): readonly number[] {
        return this.poses.map(p => p.frame);
    }

    addKey(frame: number): void {
        const pose = this.events.invoke('camera.getPose');
        if (!pose) return;

        const existingIndex = this.poses.findIndex(p => p.frame === frame);
        const isNew = existingIndex === -1;

        // camera.getPose returns plain {x,y,z} objects, convert to Vec3
        const newPose: Pose = {
            name: `camera_${this.poses.length}`,
            frame,
            position: new Vec3(pose.position.x, pose.position.y, pose.position.z),
            target: new Vec3(pose.target.x, pose.target.y, pose.target.z)
        };

        if (isNew) {
            this.poses.push(newPose);
            this.rebuildSpline();
            this.events.fire('track.keyAdded', frame);
        } else {
            this.poses[existingIndex] = newPose;
            this.rebuildSpline();
            this.events.fire('track.keyUpdated', frame);
        }
    }

    removeKey(frame: number): void {
        const index = this.poses.findIndex(p => p.frame === frame);
        if (index !== -1) {
            this.poses.splice(index, 1);
            this.rebuildSpline();
            this.events.fire('track.keyRemoved', frame);
        }
    }

    moveKey(fromFrame: number, toFrame: number): void {
        if (fromFrame === toFrame) return;

        const index = this.poses.findIndex(p => p.frame === fromFrame);
        if (index === -1) return;

        // Remove any existing pose at the target frame
        const toIndex = this.poses.findIndex(p => p.frame === toFrame);
        if (toIndex !== -1) {
            this.poses.splice(toIndex, 1);
        }

        // Update the frame
        this.poses[index].frame = toFrame;
        this.rebuildSpline();
        this.events.fire('track.keyMoved', fromFrame, toFrame);
    }

    evaluate(frame: number): void {
        this.onTimelineChange?.(frame);
    }

    clear(): void {
        this.poses.length = 0;
        this.onTimelineChange = null;
        this.events.fire('track.keysCleared');
    }

    /**
     * Add a pose directly (used for deserialization).
     */
    addPose(pose: Pose): void {
        if (pose.frame === undefined) {
            return;
        }

        // If a pose already exists at this frame, update it
        const idx = this.poses.findIndex(p => p.frame === pose.frame);
        if (idx !== -1) {
            this.poses[idx] = pose;
        } else {
            this.poses.push(pose);
        }

        this.rebuildSpline();
    }

    /**
     * Get all poses (used for serialization).
     */
    getPoses(): readonly Pose[] {
        return this.poses;
    }

    /**
     * Load poses from serialized data.
     */
    loadPoses(posesData: Pose[]): void {
        this.poses.length = 0;
        posesData.forEach((pose) => {
            this.poses.push(pose);
        });
        this.rebuildSpline();
        // Notify UI to rebuild with loaded keys
        this.events.fire('track.keysLoaded', this.keys);
    }

    private rebuildSpline(): void {
        const duration = this.events.invoke('timeline.frames');

        const orderedPoses = this.poses.slice()
        // filter out keys beyond the end of the timeline
        .filter(a => a.frame < duration)
        // order keys by time for spline
        .sort((a, b) => a.frame - b.frame);

        // construct the spline points to be interpolated
        const times = orderedPoses.map(p => p.frame);
        const points: number[] = [];
        for (let i = 0; i < orderedPoses.length; ++i) {
            const p = orderedPoses[i];
            points.push(p.position.x, p.position.y, p.position.z);
            points.push(p.target.x, p.target.y, p.target.z);
        }

        if (orderedPoses.length > 1) {
            // interpolate camera positions and camera target positions
            const spline = CubicSpline.fromPointsLooping(duration, times, points, this.events.invoke('timeline.smoothness'));
            const result: number[] = [];
            const pose = { position: new Vec3(), target: new Vec3() };

            this.onTimelineChange = (frame: number) => {
                // evaluate the spline at current time
                spline.evaluate(frame, result);

                // set camera pose
                pose.position.set(result[0], result[1], result[2]);
                pose.target.set(result[3], result[4], result[5]);
                this.events.fire('camera.setPose', pose, 0);
            };
        } else {
            this.onTimelineChange = null;
        }
    }
}

const registerCameraPosesEvents = (events: Events) => {
    const track = new CameraAnimTrack(events);

    // Expose the camera animation track
    events.function('camera.animTrack', () => {
        return track;
    });

    // Legacy support: expose poses
    events.function('camera.poses', () => {
        return track.getPoses();
    });

    // Legacy support: add pose directly
    events.on('camera.addPose', (pose: Pose) => {
        track.addPose(pose);
    });

    // Evaluate track on timeline changes
    events.on('timeline.time', (time: number) => {
        track.evaluate(time);
    });

    events.on('timeline.frame', (frame: number) => {
        track.evaluate(frame);
    });

    // Rebuild spline when timeline parameters change
    events.on('timeline.frames', () => {
        // Trigger rebuild by evaluating at current frame
        track.evaluate(events.invoke('timeline.frame'));
        // Notify UI that keys may have changed (filtered by duration)
        events.fire('track.keysChanged');
    });

    events.on('timeline.smoothness', () => {
        track.evaluate(events.invoke('timeline.frame'));
    });

    // Clear track when scene is cleared
    events.on('scene.clear', () => {
        track.clear();
    });

    // Serialization

    events.function('docSerialize.poseSets', (): any[] => {
        const pack3 = (v: Vec3) => [v.x, v.y, v.z];
        const poses = track.getPoses();

        if (poses.length === 0) {
            return [];
        }

        return [{
            name: 'set0',
            poses: poses.map((pose) => {
                return {
                    name: pose.name,
                    frame: pose.frame,
                    position: pack3(pose.position),
                    target: pack3(pose.target)
                };
            })
        }];
    });

    events.function('docDeserialize.poseSets', (poseSets: any[]) => {
        if (poseSets.length === 0) {
            return;
        }

        const fps = events.invoke('timeline.frameRate');

        // Load poses from first poseSet
        const loadedPoses: Pose[] = poseSets[0].poses.map((docPose: any, index: number) => {
            return {
                name: docPose.name,
                frame: docPose.frame ?? (index * fps),
                position: new Vec3(docPose.position),
                target: new Vec3(docPose.target)
            };
        });

        track.loadPoses(loadedPoses);
    });
};

export { registerCameraPosesEvents, CameraAnimTrack, Pose };
