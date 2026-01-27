/**
 * Browser-compatible WriteFileSystem for use with splat-transform.
 * Adapts supersplat's Writer interface to splat-transform's FileSystem interface.
 */

import type { FileSystem, Writer as SplatTransformWriter } from '@playcanvas/splat-transform';

import { Writer } from '../serialize/writer';

/**
 * Adapter that wraps supersplat's Writer to match splat-transform's Writer interface.
 */
class WriterAdapter implements SplatTransformWriter {
    private writer: Writer;

    constructor(writer: Writer) {
        this.writer = writer;
    }

    write(data: Uint8Array): void | Promise<void> {
        return this.writer.write(data);
    }

    close(): void | Promise<void> {
        return this.writer.close();
    }
}

/**
 * Browser-compatible FileSystem implementation for splat-transform.
 * Wraps a single Writer for output operations.
 */
class BrowserWriteFileSystem implements FileSystem {
    private writer: Writer;
    private writerAdapter: WriterAdapter;

    constructor(writer: Writer) {
        this.writer = writer;
        this.writerAdapter = new WriterAdapter(writer);
    }

    createWriter(filename: string): Promise<SplatTransformWriter> {
        // Return the underlying writer adapter
        // In browser context with bundled SOG output, all writes go to the same stream
        return Promise.resolve(this.writerAdapter);
    }

    async mkdir(path: string): Promise<void> {
        // No-op in browser - zip handles directory structure internally
    }
}

export { BrowserWriteFileSystem, WriterAdapter };
