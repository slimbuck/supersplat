import { Container, Element, Label } from '@playcanvas/pcui';

import { Events } from '../events';
import { localize } from './localization';
import { parseSvg } from './svg';
import centersSvg from './svg/centers.svg';
import ringsSvg from './svg/rings.svg';
import { Tooltips } from './tooltips';

class ModeToggle extends Container {
    constructor(events: Events, tooltips: Tooltips, args = {}) {
        args = {
            id: 'mode-toggle',
            class: 'centers-mode',
            ...args
        };

        super(args);

        const centersIcon = new Element({
            id: 'centers-icon',
            dom: parseSvg(centersSvg)
        });

        const ringsIcon = new Element({
            id: 'rings-icon',
            dom: parseSvg(ringsSvg)
        });

        const centersText = new Label({
            id: 'centers-text',
            text: localize('panel.mode.centers')
        });

        const ringsText = new Label({
            id: 'rings-text',
            text: localize('panel.mode.rings')
        });

        this.append(centersIcon);
        this.append(ringsIcon);
        this.append(centersText);
        this.append(ringsText);

        this.dom.addEventListener('pointerdown', (event) => {
            event.stopPropagation();
            events.fire('camera.toggleMode');
            events.fire('camera.setOverlay', true);
        });

        events.on('camera.mode', (mode: string) => {
            this.class[mode === 'centers' ? 'add' : 'remove']('centers-mode');
            this.class[mode === 'rings' ? 'add' : 'remove']('rings-mode');
        });

        tooltips.register(this, localize('tooltip.right-toolbar.splat-mode'));
    }
}

export { ModeToggle };
