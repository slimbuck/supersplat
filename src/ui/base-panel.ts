import { Container, ContainerArgs, Label } from '@playcanvas/pcui';

import { Events } from '../events';

interface BasePanelArgs extends ContainerArgs {
    icon?: string;
    label?: string;
    panelName?: string;
    excludes?: string;
}

const panelPointerEvents = ['pointerdown', 'pointerup', 'pointermove', 'wheel', 'dblclick'];

class BasePanel extends Container {
    protected headerContainer: Container;
    protected headerLabel: Label;

    constructor(events: Events, args: BasePanelArgs = {}) {
        const {
            icon,
            label,
            panelName,
            excludes,
            ...containerArgs
        } = args;

        super({
            ...containerArgs,
            class: [
                'panel',
                ...(Array.isArray(containerArgs.class) ? containerArgs.class :
                    containerArgs.class ? [containerArgs.class] : [])
            ]
        });

        panelPointerEvents.forEach((eventName) => {
            this.dom.addEventListener(eventName, (event: Event) => event.stopPropagation());
        });

        this.headerContainer = new Container({
            class: 'ss-panel-header'
        });

        if (icon) {
            const iconLabel = new Label({
                text: icon,
                class: 'ss-panel-header-icon'
            });
            this.headerContainer.append(iconLabel);
        }

        this.headerLabel = new Label({
            text: label ?? '',
            class: 'ss-panel-header-label'
        });

        this.headerContainer.append(this.headerLabel);
        this.append(this.headerContainer);

        if (panelName) {
            const setVisible = (visible: boolean) => {
                if (visible === this.hidden) {
                    this.hidden = !visible;
                    events.fire(`${panelName}.visible`, visible);
                }
            };

            events.function(`${panelName}.visible`, () => {
                return !this.hidden;
            });

            events.on(`${panelName}.setVisible`, (visible: boolean) => {
                setVisible(visible);
            });

            events.on(`${panelName}.toggleVisible`, () => {
                setVisible(this.hidden);
            });

            if (excludes) {
                events.on(`${excludes}.visible`, (visible: boolean) => {
                    if (visible) {
                        setVisible(false);
                    }
                });
            }
        }
    }
}

export { BasePanel, BasePanelArgs };
