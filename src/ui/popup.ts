import { Button, Container, Label } from '@playcanvas/pcui';

import { BaseDialog } from './base-dialog';
import { localize } from './localization';
import { Tooltips } from './tooltips';

interface ShowOptions {
    type: 'error' | 'info' | 'yesno' | 'okcancel';
    message: string;
    header?: string;
    link?: string;
}

class Popup extends BaseDialog {
    show: (options: ShowOptions) => void;

    constructor(tooltips: Tooltips, args = {}) {
        super({
            ...args,
            id: 'popup',
            showFooter: false
        });

        const text = new Label({
            class: 'ss-popup-text'
        });

        const linkText = new Label({
            class: 'ss-popup-link-text'
        });

        const linkCopy = new Button({
            class: 'ss-popup-link-copy',
            icon: 'E351'
        });

        const linkRow = new Container({
            class: 'ss-popup-link-row'
        });

        linkRow.append(linkText);
        linkRow.append(linkCopy);

        const okButton = new Button({
            class: 'ss-popup-button',
            text: localize('popup.ok')
        });

        const cancelButton = new Button({
            class: 'ss-popup-button',
            text: localize('popup.cancel')
        });

        const yesButton = new Button({
            class: 'ss-popup-button',
            text: localize('popup.yes')
        });

        const noButton = new Button({
            class: 'ss-popup-button',
            text: localize('popup.no')
        });

        const buttons = new Container({
            class: 'ss-popup-buttons'
        });

        buttons.append(okButton);
        buttons.append(cancelButton);
        buttons.append(yesButton);
        buttons.append(noButton);

        this.contentContainer.append(text);
        this.contentContainer.append(linkRow);
        this.contentContainer.append(buttons);

        let okFn: () => void;
        let cancelFn: () => void;
        let yesFn: () => void;
        let noFn: () => void;
        let containerFn: () => void;
        let copyFn: () => void;

        okButton.on('click', () => okFn());
        cancelButton.on('click', () => cancelFn());
        yesButton.on('click', () => yesFn());
        noButton.on('click', () => noFn());

        this.on('click', () => containerFn());

        this.dialogContainer.on('click', (event: MouseEvent) => {
            event.stopPropagation();
        });

        linkCopy.on('click', () => copyFn());

        this.show = (options: ShowOptions) => {
            this.headerLabel.text = options.header;
            text.text = options.message;

            const { type, link } = options;

            ['error', 'info', 'yesno', 'okcancel'].forEach((t) => {
                text.class[t === type ? 'add' : 'remove'](t);
            });

            okButton.hidden = type === 'yesno';
            cancelButton.hidden = type !== 'okcancel';
            yesButton.hidden = type !== 'yesno';
            noButton.hidden = type !== 'yesno';

            linkRow.hidden = link === undefined;
            if (link !== undefined) {
                linkText.dom.innerHTML = `<a href='${link}' target='_blank'>${link}</a>`;
                linkCopy.icon = 'E352';
            }

            return new Promise<{action: string, value?: string}>((resolve) => {
                okFn = () => {
                    this.hideDialog();
                    resolve({ action: 'ok' });
                };
                cancelFn = () => {
                    this.hideDialog();
                    resolve({ action: 'cancel' });
                };
                yesFn = () => {
                    this.hideDialog();
                    resolve({ action: 'yes' });
                };
                noFn = () => {
                    this.hideDialog();
                    resolve({ action: 'no' });
                };
                containerFn = () => {
                    if (type === 'info' && link === undefined) {
                        cancelFn();
                    }
                };
                copyFn = () => {
                    navigator.clipboard.writeText(link);
                    linkCopy.icon = 'E348';
                };

                this.onCancel = () => {
                    if (type === 'yesno') {
                        noFn();
                    } else {
                        cancelFn();
                    }
                };

                this.showDialog();
            });
        };

        tooltips.register(linkCopy, localize('popup.copy-to-clipboard'));
    }
}

export { ShowOptions, Popup };
