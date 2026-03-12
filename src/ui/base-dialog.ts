import { Button, Container, ContainerArgs, Label } from '@playcanvas/pcui';

import { localize } from './localization';

interface BaseDialogArgs extends ContainerArgs {
    // Dialog title text (displayed in header, uppercased by CSS)
    title?: string;
    // Whether to show a footer with Cancel/OK buttons
    showFooter?: boolean;
    // Custom OK button text
    okText?: string;
    // Custom cancel button text
    cancelText?: string;
    // Whether clicking the overlay dismisses the dialog
    dismissOnOverlayClick?: boolean;
}

class BaseDialog extends Container {
    protected dialogContainer: Container;
    protected headerContainer: Container;
    protected headerLabel: Label;
    protected contentContainer: Container;
    protected footerContainer: Container | null;
    protected cancelButton: Button | null;
    protected okButton: Button | null;

    protected onCancel: (() => void) | null = null;
    protected onOK: (() => void) | null = null;

    private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

    constructor(args: BaseDialogArgs = {}) {
        const {
            title = '',
            showFooter = true,
            okText,
            cancelText,
            dismissOnOverlayClick = false,
            ...containerArgs
        } = args;

        super({
            ...containerArgs,
            class: [
                'ss-overlay',
                ...(Array.isArray(containerArgs.class) ? containerArgs.class :
                    containerArgs.class ? [containerArgs.class] : [])
            ],
            hidden: containerArgs.hidden ?? true,
            tabIndex: containerArgs.tabIndex ?? -1
        });

        // Dialog container
        this.dialogContainer = new Container({
            class: 'ss-dialog'
        });

        // Header
        this.headerContainer = new Container({
            class: ['ss-dialog-header', 'ss-dialog-drag-handle']
        });

        this.headerLabel = new Label({
            class: 'ss-dialog-header-label',
            text: title
        });

        this.headerContainer.append(this.headerLabel);

        // Content
        this.contentContainer = new Container({
            class: 'ss-dialog-content'
        });

        // Footer
        if (showFooter) {
            this.footerContainer = new Container({
                class: 'ss-dialog-footer'
            });

            this.cancelButton = new Button({
                class: 'ss-dialog-button',
                text: cancelText ?? localize('popup.cancel')
            });

            this.okButton = new Button({
                class: 'ss-dialog-button',
                text: okText ?? localize('popup.ok')
            });

            this.cancelButton.on('click', () => this.onCancel?.());
            this.okButton.on('click', () => this.onOK?.());

            this.footerContainer.append(this.cancelButton);
            this.footerContainer.append(this.okButton);
        } else {
            this.footerContainer = null;
            this.cancelButton = null;
            this.okButton = null;
        }

        // Assemble
        this.dialogContainer.append(this.headerContainer);
        this.dialogContainer.append(this.contentContainer);
        if (this.footerContainer) {
            this.dialogContainer.append(this.footerContainer);
        }

        this.append(this.dialogContainer);

        // Click outside to close
        if (dismissOnOverlayClick) {
            this.on('click', () => this.onCancel?.());
            this.dialogContainer.on('click', (event: MouseEvent) => {
                event.stopPropagation();
            });
        }
    }

    /**
     * Show the dialog, attaching keyboard handlers for Escape/Enter.
     * Subclasses should call super.showDialog() at the start of their show() method.
     */
    protected showDialog() {
        this.hidden = false;

        this.keydownHandler = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'Escape':
                    this.onCancel?.();
                    break;
                case 'Enter':
                    if (!e.shiftKey) this.onOK?.();
                    break;
                default:
                    e.stopPropagation();
                    break;
            }
        };

        this.dom.addEventListener('keydown', this.keydownHandler);
        this.dom.focus();
    }

    /**
     * Hide the dialog, removing keyboard handlers.
     * Subclasses should call super.hideDialog() at the end of their hide() method.
     */
    protected hideDialog() {
        if (this.keydownHandler) {
            this.dom.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }
        this.hidden = true;
    }

    destroy() {
        this.hideDialog();
        super.destroy();
    }
}

export { BaseDialog, BaseDialogArgs };
