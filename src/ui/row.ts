import { Container, Element, Label } from '@playcanvas/pcui';

interface RowOptions {
    labelText: string;
    control: Element;
    rowClass?: string;
    labelClass?: string;
}

const createRow = (options: RowOptions): Container => {
    const row = new Container({
        class: options.rowClass ?? 'ss-panel-row'
    });

    const label = new Label({
        text: options.labelText,
        class: options.labelClass ?? 'ss-panel-row-label'
    });

    row.append(label);
    row.append(options.control);

    return row;
};

export { createRow };
