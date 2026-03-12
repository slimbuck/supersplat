import { Element } from '@playcanvas/pcui';

/**
 * Parse an encoded SVG data URI string into an HTMLElement.
 */
const parseSvg = (svgString: string): HTMLElement => {
    const decodedStr = decodeURIComponent(svgString.substring('data:image/svg+xml,'.length));
    return new DOMParser().parseFromString(decodedStr, 'image/svg+xml').documentElement as unknown as HTMLElement;
};

/**
 * Create a PCUI Element wrapping a decoded SVG.
 */
const createSvgElement = (svgString: string, args: Record<string, unknown> = {}): Element => {
    return new Element({
        dom: parseSvg(svgString),
        ...args
    });
};

export { parseSvg, createSvgElement };
