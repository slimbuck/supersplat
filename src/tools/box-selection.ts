import { Container, NumericInput } from '@playcanvas/pcui';
import { TranslateGizmo, Vec3 } from 'playcanvas';

import { BoxShape } from '../box-shape';
import { Events } from '../events';
import { Scene } from '../scene';
import { Splat } from '../splat';
import { ContextToolbar } from '../ui/context-toolbar';

class BoxSelection {
    activate: () => void;
    deactivate: () => void;

    active = false;

    constructor(events: Events, scene: Scene, canvasContainer: Container) {
        const box = new BoxShape();

        const gizmo = new TranslateGizmo(scene.camera.camera, scene.gizmoLayer);

        gizmo.on('render:update', () => {
            scene.forceRender = true;
        });

        gizmo.on('transform:move', () => {
            box.moved();
        });

        // ui
        const selectToolbar = new ContextToolbar(canvasContainer);

        const apply = (op: 'set' | 'add' | 'remove') => {
            const p = box.pivot.getPosition();
            events.fire('select.byBox', op, [p.x, p.y, p.z, box.lenX, box.lenY, box.lenZ]);
        };

        const { set: setButton, add: addButton, remove: removeButton } = ContextToolbar.createSelectionButtons(apply);

        const lenX = new NumericInput({
            precision: 2,
            value: box.lenX,
            placeholder: 'LenX',
            width: 80,
            min: 0.01
        });

        const lenY = new NumericInput({
            precision: 2,
            value: box.lenY,
            placeholder: 'LenY',
            width: 80,
            min: 0.01
        });

        const lenZ = new NumericInput({
            precision: 2,
            value: box.lenZ,
            placeholder: 'LenZ',
            width: 80,
            min: 0.01
        });

        selectToolbar.append(setButton);
        selectToolbar.append(addButton);
        selectToolbar.append(removeButton);
        selectToolbar.append(lenX);
        selectToolbar.append(lenY);
        selectToolbar.append(lenZ);

        lenX.on('change', () => {
            box.lenX = lenX.value;
        });
        lenY.on('change', () => {
            box.lenY = lenY.value;
        });
        lenZ.on('change', () => {
            box.lenZ = lenZ.value;
        });

        events.on('camera.focalPointPicked', (details: { splat: Splat, position: Vec3 }) => {
            if (this.active) {
                box.pivot.setPosition(details.position);
                gizmo.attach([box.pivot]);
            }
        });

        const updateGizmoSize = () => {
            const { camera, canvas } = scene;
            if (camera.ortho) {
                gizmo.size = 1125 / canvas.clientHeight;
            } else {
                gizmo.size = 1200 / Math.max(canvas.clientWidth, canvas.clientHeight);
            }
        };
        updateGizmoSize();
        events.on('camera.resize', updateGizmoSize);
        events.on('camera.ortho', updateGizmoSize);

        this.activate = () => {
            this.active = true;
            scene.add(box);
            gizmo.attach([box.pivot]);
            selectToolbar.show();
        };

        this.deactivate = () => {
            selectToolbar.hide();
            gizmo.detach();
            scene.remove(box);
            this.active = false;
        };
    }
}

export { BoxSelection };
