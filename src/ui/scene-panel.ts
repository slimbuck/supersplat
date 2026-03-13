import { Container, Element, Label } from '@playcanvas/pcui';

import { Events } from '../events';
import { BasePanel } from './base-panel';
import { localize } from './localization';
import { SplatList } from './splat-list';
import { parseSvg } from './svg';
import sceneImportSvg from './svg/import.svg';
import sceneNewSvg from './svg/new.svg';
import soloSvg from './svg/solo.svg';
import { Tooltips } from './tooltips';
import { Transform } from './transform';

class ScenePanel extends BasePanel {
    constructor(events: Events, tooltips: Tooltips, args = {}) {
        super(events, {
            ...args,
            id: 'scene-panel',
            icon: '\uE344',
            label: localize('panel.scene-manager')
        });

        let soloActive = false;

        const soloToggle = new Container({
            class: 'ss-panel-header-button'
        });
        soloToggle.dom.appendChild(parseSvg(soloSvg));

        soloToggle.on('click', () => {
            soloActive = !soloActive;
            if (soloActive) {
                soloToggle.class.add('active');
            } else {
                soloToggle.class.remove('active');
            }
            events.fire('scene.solo', soloActive);
        });

        const sceneImport = new Container({
            class: 'ss-panel-header-button'
        });
        sceneImport.dom.appendChild(parseSvg(sceneImportSvg));

        const sceneNew = new Container({
            class: 'ss-panel-header-button'
        });
        sceneNew.dom.appendChild(parseSvg(sceneNewSvg));

        this.headerContainer.append(soloToggle);
        this.headerContainer.append(sceneImport);
        this.headerContainer.append(sceneNew);

        sceneImport.on('click', async () => {
            await events.invoke('scene.import');
        });

        sceneNew.on('click', () => {
            events.invoke('doc.new');
        });

        tooltips.register(soloToggle, localize('tooltip.scene.solo'), 'top');
        tooltips.register(sceneImport, 'Import Scene', 'top');
        tooltips.register(sceneNew, 'New Scene', 'top');

        const splatList = new SplatList(events);

        const splatListContainer = new Container({
            class: 'splat-list-container'
        });
        splatListContainer.append(splatList);

        const transformHeader = new Container({
            class: 'ss-panel-header'
        });

        const transformIcon = new Label({
            text: '\uE111',
            class: 'ss-panel-header-icon'
        });

        const transformLabel = new Label({
            text: localize('panel.scene-manager.transform'),
            class: 'ss-panel-header-label'
        });

        transformHeader.append(transformIcon);
        transformHeader.append(transformLabel);

        this.append(splatListContainer);
        this.append(transformHeader);
        this.append(new Transform(events));
        this.append(new Element({
            class: 'ss-panel-header',
            height: 20
        }));
    }
}

export { ScenePanel };
