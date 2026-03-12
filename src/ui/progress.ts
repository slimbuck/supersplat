import { Button, Container, Element, Label } from '@playcanvas/pcui';

import { BaseDialog } from './base-dialog';
import { localize } from './localization';

class Progress extends BaseDialog {
    setHeader: (headerText: string) => void;
    setText: (text: string) => void;
    setProgress: (progress: number) => void;
    showCancelButton: (show: boolean) => void;
    declare onCancel: (() => void) | null;

    constructor(args = {}) {
        super({
            ...args,
            id: 'progress-container',
            showFooter: false
        });

        this.onCancel = null;
        this.dom.style.cursor = 'progress';

        const text = new Element({
            dom: 'div',
            class: 'ss-progress-text'
        });

        const bar = new Element({
            dom: 'div',
            class: ['ss-progress-bar', 'pulsate']
        });

        const cancelButton = new Button({
            class: 'ss-progress-cancel',
            text: localize('panel.render.cancel'),
            hidden: true
        });

        cancelButton.on('click', () => {
            if (this.onCancel) this.onCancel();
        });

        this.contentContainer.append(text);
        this.contentContainer.append(bar);
        this.contentContainer.append(cancelButton);

        this.dom.addEventListener('keydown', (event) => {
            if (this.hidden) return;
            event.stopPropagation();
            event.preventDefault();
        });

        this.setHeader = (headerMsg: string) => {
            this.headerLabel.text = headerMsg;
        };

        this.setText = (textMsg: string) => {
            text.dom.textContent = textMsg;
        };

        this.setProgress = (progress: number) => {
            bar.dom.style.backgroundImage = `linear-gradient(90deg, #F60 0%, #F60 ${progress}%, #00000000 ${progress}%, #00000000 100%)`;
        };

        this.showCancelButton = (show: boolean) => {
            cancelButton.hidden = !show;
        };
    }
}

export { Progress };
