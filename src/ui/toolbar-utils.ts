import { Button, Element } from '@playcanvas/pcui';

import { Events } from '../events';
import { ShortcutManager } from '../shortcut-manager';
import { localize } from './localization';
import { parseSvg } from './svg';

const buildTooltipText = (events: Events, localeKey: string, shortcutId?: string): string => {
    const text = localize(localeKey);
    if (shortcutId) {
        const shortcutManager: ShortcutManager = events.invoke('shortcutManager');
        const shortcut = shortcutManager.formatShortcut(shortcutId);
        if (shortcut) {
            return `${text} ( ${shortcut} )`;
        }
    }
    return text;
};

const createToolbarButton = (svgModule: string, cssClass: string | string[], id?: string): Button => {
    const button = new Button({
        ...(id && { id }),
        class: cssClass
    });
    button.dom.appendChild(parseSvg(svgModule));
    return button;
};

const createToolbarSeparator = (cssClass: string): Element => {
    return new Element({ class: cssClass });
};

const stopToolbarPointerEvents = (element: HTMLElement) => {
    element.addEventListener('pointerdown', (event: Event) => event.stopPropagation());
    element.addEventListener('wheel', (event: Event) => event.stopPropagation());
};

export { buildTooltipText, createToolbarButton, createToolbarSeparator, stopToolbarPointerEvents };
