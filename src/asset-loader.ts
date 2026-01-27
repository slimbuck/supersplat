import { AppBase, Asset, GSplatData, GSplatResource, Vec3 } from 'playcanvas';

import { Events } from './events';
import { AssetSource } from './loaders/asset-source';
import { isSupportedFormat, isLccFormat, loadWithSplatTransform } from './loaders/splat-transform-loader';
import { Splat } from './splat';

const defaultOrientation = new Vec3(0, 0, 180);
const lccOrientation = new Vec3(90, 0, 180);

// handles loading gaussian splat assets
class AssetLoader {
    app: AppBase;
    events: Events;
    defaultAnisotropy: number;
    loadAllData = true;

    constructor(app: AppBase, events: Events, defaultAnisotropy?: number) {
        this.app = app;
        this.events = events;
        this.defaultAnisotropy = defaultAnisotropy || 1;
    }

    async load(assetSource: AssetSource) {
        const wrap = (gsplatData: GSplatData) => {
            const asset = new Asset(assetSource.filename || assetSource.url, 'gsplat', {
                url: assetSource.contents ? `local-asset-${Date.now()}` : assetSource.url ?? assetSource.filename,
                filename: assetSource.filename
            });
            this.app.assets.add(asset);
            asset.resource = new GSplatResource(this.app.graphicsDevice, gsplatData);
            return asset;
        };

        if (!assetSource.animationFrame) {
            this.events.fire('startSpinner');
        }

        try {
            const filename = assetSource.filename || assetSource.url || '';
            const lowerFilename = filename.toLowerCase();

            // Validate format is supported
            if (!isSupportedFormat(lowerFilename)) {
                throw new Error(`Unsupported file format: ${filename}`);
            }

            // Determine orientation based on format
            const orientation = isLccFormat(lowerFilename) ? lccOrientation : defaultOrientation;

            // Load using splat-transform
            const gsplatData = await loadWithSplatTransform(assetSource);

            // Support loading 2d splats by adding scale_2 property with almost 0 scale
            if (gsplatData.getProp('scale_0') && gsplatData.getProp('scale_1') && !gsplatData.getProp('scale_2')) {
                const scale2 = new Float32Array(gsplatData.numSplats).fill(Math.log(1e-6));
                gsplatData.addProp('scale_2', scale2);

                // place the new scale_2 property just after scale_1
                const props = gsplatData.getElement('vertex').properties;
                props.splice(props.findIndex((prop: any) => prop.name === 'scale_1') + 1, 0, props.splice(props.length - 1, 1)[0]);
            }

            // Check the data contains minimal set of properties we expect
            const required = [
                'x', 'y', 'z',
                'scale_0', 'scale_1', 'scale_2',
                'rot_0', 'rot_1', 'rot_2', 'rot_3',
                'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity'
            ];
            const missing = required.filter(x => !gsplatData.getProp(x));
            if (missing.length > 0) {
                throw new Error(`This file does not contain gaussian splatting data. The following properties are missing: ${missing.join(', ')}`);
            }

            const asset = wrap(gsplatData);
            return new Splat(asset, orientation);
        } finally {
            if (!assetSource.animationFrame) {
                this.events.fire('stopSpinner');
            }
        }
    }
}

export { AssetLoader };
