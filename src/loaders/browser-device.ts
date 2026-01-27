/**
 * Browser WebGPU device creation for use with splat-transform.
 * Creates a WebgpuGraphicsDevice for GPU-accelerated k-means clustering.
 */

import {
    GraphicsDevice,
    PIXELFORMAT_BGRA8,
    Texture,
    WebgpuGraphicsDevice
} from 'playcanvas';

// Cached GPU device for reuse across exports
let cachedDevice: GraphicsDevice | null = null;
let cachedBackbuffer: Texture | null = null;

/**
 * Create or retrieve a cached WebGPU device for compute operations.
 * The device is created once and reused for subsequent exports.
 *
 * This function is compatible with splat-transform's DeviceCreator type.
 *
 * @returns Promise resolving to a GraphicsDevice
 * @throws Error if WebGPU is not available
 */
const createBrowserDevice = async (): Promise<GraphicsDevice> => {
    if (cachedDevice) {
        return cachedDevice;
    }

    if (!navigator.gpu) {
        throw new Error('WebGPU is not available in this browser');
    }

    // Create a minimal canvas for the graphics device
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;

    const graphicsDevice = new WebgpuGraphicsDevice(canvas, {
        antialias: false,
        depth: false,
        stencil: false
    });

    await graphicsDevice.createDevice();

    // Create external backbuffer (required by PlayCanvas)
    const backbuffer = new Texture(graphicsDevice, {
        width: 1024,
        height: 512,
        name: 'SogComputeBackbuffer',
        mipmaps: false,
        format: PIXELFORMAT_BGRA8
    });

    // @ts-ignore - externalBackbuffer is an internal property
    graphicsDevice.externalBackbuffer = backbuffer;

    cachedDevice = graphicsDevice;
    cachedBackbuffer = backbuffer;

    return cachedDevice;
};

/**
 * Destroy the cached GPU device if it exists.
 * Call this when cleaning up resources.
 */
const destroyBrowserDevice = () => {
    if (cachedBackbuffer) {
        cachedBackbuffer.destroy();
        cachedBackbuffer = null;
    }
    if (cachedDevice) {
        cachedDevice.destroy();
        cachedDevice = null;
    }
};

export { createBrowserDevice, destroyBrowserDevice };
