type Property = {
    name: string,
    data: Float32Array
};

type Element = {
    name: string,
    length: number,
    properties: Property[]
};

const writePly = (elements: Element[]) => {
    const headerText = [
        'ply',
        'format binary_little_endian 1.0',
        elements.map((element) => {
            return [`element ${element.name} ${element.length}`].concat(element.properties.map((property) => {
                return `property float ${property.name}`;
            }));
        }),
        'end_header\n'
    ].flat(2).join('\n');

    const header = (new TextEncoder()).encode(headerText);

    const result = new Uint8Array(
        header.byteLength +
        elements.reduce((acc, element) => {
            return acc + element.properties.reduce((acc, property) => {
                return acc + property.data.byteLength;
            }, 0);
        }, 0)
    );

    result.set(header);

    const dataView = new DataView(result.buffer);
    let offset = header.byteLength;

    for (let i = 0; i < elements.length; ++i) {
        const element = elements[i];
        const properties = element.properties;
        for (let j = 0; j < element.length; ++j) {
            for (let k = 0; k < properties.length; ++k) {
                dataView.setFloat32(offset, properties[k].data[j], true);
                offset += 4;
            }
        }
    }

    return result;
};

export { writePly };
