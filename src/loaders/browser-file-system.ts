import { dirname, join } from 'pathe';

import type { AssetSource } from './asset-source';

// Define compatible interfaces for splat-transform
// These match the splat-transform ReadStream and ReadSource interfaces

interface ReadStream {
    readonly expectedSize: number | undefined;
    bytesRead: number;
    pull(target: Uint8Array): Promise<number>;
    readAll(): Promise<Uint8Array>;
    close(): void;
}

interface ReadSource {
    readonly size: number | undefined;
    readonly seekable: boolean;
    read(start?: number, end?: number): ReadStream;
    close(): void;
}

type ProgressCallback = (bytesLoaded: number, totalBytes: number | undefined) => void;

interface ReadFileSystem {
    createSource(filename: string, progress?: ProgressCallback): Promise<ReadSource>;
}

/**
 * ReadStream implementation for reading from fetch responses.
 */
class BrowserReadStream implements ReadStream {
    readonly expectedSize: number | undefined;
    bytesRead: number = 0;

    private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    private buffer: Uint8Array | null = null;
    private bufferOffset: number = 0;
    private closed: boolean = false;

    constructor(response: Response, expectedSize?: number) {
        this.expectedSize = expectedSize;
        if (response.body) {
            this.reader = response.body.getReader();
        }
    }

    async pull(target: Uint8Array): Promise<number> {
        if (this.closed || !this.reader) {
            return 0;
        }

        let targetOffset = 0;

        // First, consume any leftover data from previous read
        if (this.buffer && this.bufferOffset < this.buffer.length) {
            const remaining = this.buffer.length - this.bufferOffset;
            const toCopy = Math.min(remaining, target.length);
            target.set(this.buffer.subarray(this.bufferOffset, this.bufferOffset + toCopy));
            this.bufferOffset += toCopy;
            targetOffset += toCopy;
            this.bytesRead += toCopy;

            if (targetOffset >= target.length) {
                return targetOffset;
            }

            if (this.bufferOffset >= this.buffer.length) {
                this.buffer = null;
                this.bufferOffset = 0;
            }
        }

        // Read from stream
        while (targetOffset < target.length) {
            const { done, value } = await this.reader.read();

            if (done || !value) {
                break;
            }

            const toCopy = Math.min(value.length, target.length - targetOffset);
            target.set(value.subarray(0, toCopy), targetOffset);
            targetOffset += toCopy;
            this.bytesRead += toCopy;

            // Store leftover for next pull
            if (toCopy < value.length) {
                this.buffer = value;
                this.bufferOffset = toCopy;
                break;
            }
        }

        return targetOffset;
    }

    async readAll(): Promise<Uint8Array> {
        const capacity = this.expectedSize ?? 65536;
        let buffer = new Uint8Array(capacity);
        let length = 0;

        while (true) {
            if (length >= buffer.length) {
                const newBuffer = new Uint8Array(buffer.length * 2);
                newBuffer.set(buffer);
                buffer = newBuffer;
            }

            const n = await this.pull(buffer.subarray(length));
            if (n === 0) break;
            length += n;
        }

        return buffer.subarray(0, length);
    }

    close(): void {
        this.closed = true;
        if (this.reader) {
            this.reader.cancel();
            this.reader = null;
        }
        this.buffer = null;
    }
}

/**
 * ReadStream for reading from a File or Blob.
 */
class BlobReadStream implements ReadStream {
    readonly expectedSize: number;
    bytesRead: number = 0;

    private blob: Blob;
    private offset: number;
    private end: number;

    constructor(blob: Blob, start: number = 0, end?: number) {
        this.blob = blob;
        this.offset = start;
        this.end = end ?? blob.size;
        this.expectedSize = this.end - this.offset;
    }

    async pull(target: Uint8Array): Promise<number> {
        const remaining = this.end - this.offset;
        if (remaining <= 0) {
            return 0;
        }

        const bytesToRead = Math.min(target.length, remaining);
        const slice = this.blob.slice(this.offset, this.offset + bytesToRead);
        const arrayBuffer = await slice.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        target.set(data);
        this.offset += bytesToRead;
        this.bytesRead += bytesToRead;

        return bytesToRead;
    }

    async readAll(): Promise<Uint8Array> {
        const slice = this.blob.slice(this.offset, this.end);
        const arrayBuffer = await slice.arrayBuffer();
        this.bytesRead = arrayBuffer.byteLength;
        return new Uint8Array(arrayBuffer);
    }

    close(): void {
        // Nothing to clean up for Blob
    }
}

/**
 * A ReadStream that lazily initiates the fetch on first pull.
 */
class LazyUrlReadStream implements ReadStream {
    readonly expectedSize: number | undefined;
    bytesRead: number = 0;

    private url: string;
    private headers: Record<string, string>;
    private innerStream: BrowserReadStream | null = null;
    private fetchPromise: Promise<BrowserReadStream> | null = null;
    private closed: boolean = false;

    constructor(url: string, headers: Record<string, string>, expectedSize?: number) {
        this.url = url;
        this.headers = headers;
        this.expectedSize = expectedSize;
    }

    private async ensureStream(): Promise<BrowserReadStream | null> {
        if (this.closed) {
            return null;
        }

        if (this.innerStream) {
            return this.innerStream;
        }

        if (!this.fetchPromise) {
            this.fetchPromise = (async () => {
                const response = await fetch(this.url, { headers: this.headers });
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
                }
                return new BrowserReadStream(response, this.expectedSize);
            })();
        }

        this.innerStream = await this.fetchPromise;
        return this.innerStream;
    }

    async pull(target: Uint8Array): Promise<number> {
        const stream = await this.ensureStream();
        if (!stream) {
            return 0;
        }

        const result = await stream.pull(target);
        this.bytesRead = stream.bytesRead;
        return result;
    }

    async readAll(): Promise<Uint8Array> {
        const stream = await this.ensureStream();
        if (!stream) {
            return new Uint8Array(0);
        }

        const result = await stream.readAll();
        this.bytesRead = stream.bytesRead;
        return result;
    }

    close(): void {
        this.closed = true;
        if (this.innerStream) {
            this.innerStream.close();
            this.innerStream = null;
        }
    }
}

/**
 * ReadSource implementation for Files (Blobs).
 */
class BlobReadSource implements ReadSource {
    readonly size: number;
    readonly seekable: boolean = true;

    private blob: Blob;
    private closed: boolean = false;

    constructor(blob: Blob) {
        this.blob = blob;
        this.size = blob.size;
    }

    read(start: number = 0, end: number = this.size): ReadStream {
        if (this.closed) {
            throw new Error('Source has been closed');
        }
        return new BlobReadStream(this.blob, start, end);
    }

    close(): void {
        this.closed = true;
    }
}

/**
 * ReadSource implementation for URLs with Range header support.
 */
class UrlReadSource implements ReadSource {
    readonly size: number | undefined;
    readonly seekable: boolean = true;

    private url: string;
    private closed: boolean = false;

    constructor(url: string, size?: number) {
        this.url = url;
        this.size = size;
    }

    read(start?: number, end?: number): ReadStream {
        if (this.closed) {
            throw new Error('Source has been closed');
        }

        // Calculate expected size for this range
        let expectedSize: number | undefined;
        if (start !== undefined || end !== undefined) {
            const rangeStart = start ?? 0;
            const rangeEnd = end ?? this.size;
            if (rangeEnd !== undefined) {
                expectedSize = rangeEnd - rangeStart;
            }
        } else {
            expectedSize = this.size;
        }

        // Create fetch with Range header if needed
        const headers: Record<string, string> = {};
        if (start !== undefined || end !== undefined) {
            const rangeStart = start ?? 0;
            const rangeEnd = end !== undefined ? end - 1 : '';
            headers.Range = `bytes=${rangeStart}-${rangeEnd}`;
        }

        // Return a lazy stream that fetches on first pull
        return new LazyUrlReadStream(this.url, headers, expectedSize);
    }

    close(): void {
        this.closed = true;
    }
}

/**
 * Browser-compatible ReadFileSystem for use with splat-transform.
 * Supports loading from File objects, URLs, and resolving related files.
 */
class BrowserReadFileSystem implements ReadFileSystem {
    private assetSource: AssetSource;
    private baseUrl: string;
    private urlCache: Map<string, string> = new Map();

    constructor(assetSource: AssetSource) {
        this.assetSource = assetSource;

        // Determine base URL for resolving relative paths
        const primaryFile = assetSource.url ?? assetSource.filename ?? '';
        this.baseUrl = dirname(primaryFile);
    }

    async createSource(filename: string, progress?: ProgressCallback): Promise<ReadSource> {
        // First, try to get the file from assetSource mappings
        if (this.assetSource.mapFile) {
            const mappedFile = this.assetSource.mapFile(filename);
            if (mappedFile) {
                if (mappedFile.contents) {
                    if (progress) {
                        progress(mappedFile.contents.size, mappedFile.contents.size);
                    }
                    return new BlobReadSource(mappedFile.contents);
                } else if (mappedFile.url) {
                    return this.createUrlSource(mappedFile.url, progress);
                }
            }
        }

        // Try mapUrl for URL-based resolution
        if (this.assetSource.mapUrl) {
            const mappedUrl = this.assetSource.mapUrl(filename);
            if (mappedUrl && mappedUrl !== filename) {
                return this.createUrlSource(mappedUrl, progress);
            }
        }

        // Check if the primary file matches the requested filename
        const lowerFilename = filename.toLowerCase();
        const primaryFilename = (this.assetSource.filename ?? '').toLowerCase();

        if (lowerFilename === primaryFilename || filename === this.assetSource.filename) {
            if (this.assetSource.contents) {
                if (progress) {
                    progress(this.assetSource.contents.size, this.assetSource.contents.size);
                }
                return new BlobReadSource(this.assetSource.contents);
            } else if (this.assetSource.url) {
                return this.createUrlSource(this.assetSource.url, progress);
            }
        }

        // Resolve relative to base URL
        const resolvedUrl = this.baseUrl ? join(this.baseUrl, filename) : filename;
        return this.createUrlSource(resolvedUrl, progress);
    }

    private async createUrlSource(url: string, progress?: ProgressCallback): Promise<UrlReadSource> {
        // Make a HEAD request to get the size
        try {
            const headResponse = await fetch(url, { method: 'HEAD' });
            if (!headResponse.ok) {
                throw new Error(`HTTP error ${headResponse.status}: ${headResponse.statusText}`);
            }

            const contentLength = headResponse.headers.get('Content-Length');
            const size = contentLength ? parseInt(contentLength, 10) : undefined;

            if (progress) {
                progress(0, size);
            }

            return new UrlReadSource(url, size);
        } catch {
            // If HEAD fails, create source without size
            if (progress) {
                progress(0, undefined);
            }
            return new UrlReadSource(url, undefined);
        }
    }

    /**
     * Register a URL for a filename (for object URLs from Files).
     */
    registerUrl(filename: string, url: string): void {
        this.urlCache.set(filename.toLowerCase(), url);
    }

    /**
     * Clean up any registered object URLs.
     */
    cleanup(): void {
        for (const url of this.urlCache.values()) {
            if (url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        }
        this.urlCache.clear();
    }
}

export { BrowserReadFileSystem, BlobReadSource, UrlReadSource };
export type { ReadFileSystem, ReadSource, ReadStream, ProgressCallback };
