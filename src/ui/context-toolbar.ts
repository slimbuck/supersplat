import { Button, Container, ContainerArgs } from '@playcanvas/pcui';

class ContextToolbar extends Container {
    constructor(canvasContainer: Container, args: ContainerArgs = {}) {
        super({
            ...args,
            class: [
                'ss-context-toolbar',
                ...(Array.isArray(args.class) ? args.class :
                    args.class ? [args.class] : [])
            ],
            hidden: true
        });

        this.dom.addEventListener('pointerdown', (e: Event) => e.stopPropagation());

        canvasContainer.append(this);
    }

    show() {
        this.hidden = false;
    }

    hide() {
        this.hidden = true;
    }

    static createSelectionButtons(apply: (op: 'set' | 'add' | 'remove') => void) {
        const setButton = new Button({ text: 'Set', class: 'ss-context-toolbar-button' });
        const addButton = new Button({ text: 'Add', class: 'ss-context-toolbar-button' });
        const removeButton = new Button({ text: 'Remove', class: 'ss-context-toolbar-button' });

        setButton.dom.addEventListener('pointerdown', (e: Event) => {
            e.stopPropagation();
            apply('set');
        });
        addButton.dom.addEventListener('pointerdown', (e: Event) => {
            e.stopPropagation();
            apply('add');
        });
        removeButton.dom.addEventListener('pointerdown', (e: Event) => {
            e.stopPropagation();
            apply('remove');
        });

        return { set: setButton, add: addButton, remove: removeButton };
    }
}

export { ContextToolbar };
