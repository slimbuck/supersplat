import { GSplatData } from 'playcanvas';

import { readFile, getInputFormat, combine, DataTable } from '@playcanvas/splat-transform';

import type { AssetSource } from './asset-source';
import { BrowserReadFileSystem } from './browser-file-system';
import { dataTableToGSplatData } from './data-table-to-gsplat';

// Default options for reading files
const defaultOptions = {
    iterations: 10,
    lodSelect: [-1],          // Select highest quality LOD by default
    unbundled: false,
    lodChunkCount: 512,
    lodChunkExtent: 16
};

/**
 * Supported file formats that can be loaded via splat-transform.
 */
const SUPPORTED_EXTENSIONS = ['.ply', '.splat', '.sog', '.lcc', '.ksplat', '.spz'];

/**
 * Check if a filename is supported by splat-transform.
 * @param filename - The filename to check
 * @returns True if the format is supported
 */
const isSupportedFormat = (filename: string): boolean => {
    const lowerFilename = filename.toLowerCase();
    return SUPPORTED_EXTENSIONS.some(ext => lowerFilename.endsWith(ext)) ||
           lowerFilename.endsWith('meta.json');
};

/**
 * Load a gaussian splat file using splat-transform.
 * @param assetSource - The asset source containing file info
 * @returns GSplatData ready for use with PlayCanvas
 */
const loadWithSplatTransform = async (assetSource: AssetSource): Promise<GSplatData> => {
    const filename = assetSource.filename || assetSource.url || '';

    // Get the input format
    let inputFormat;
    try {
        inputFormat = getInputFormat(filename);
    } catch {
        throw new Error(`Unsupported file format: ${filename}`);
    }

    // Create the browser file system for reading
    const fileSystem = new BrowserReadFileSystem(assetSource);

    try {
        // Read the file(s) into DataTable(s)
        // Cast to any to allow our compatible ReadFileSystem interface
        const dataTables = await readFile({
            filename,
            inputFormat,
            options: defaultOptions,
            params: [],
            fileSystem: fileSystem as any
        });

        let dataTable: DataTable;

        if (dataTables.length === 0) {
            throw new Error('No data found in file');
        } else if (dataTables.length === 1) {
            dataTable = dataTables[0];
        } else {
            // LCC and some formats may return multiple LOD tables
            // Combine them into a single table
            dataTable = combine(dataTables);
        }

        // Convert to GSplatData
        return dataTableToGSplatData(dataTable);
    } finally {
        // Clean up any resources
        fileSystem.cleanup();
    }
};

/**
 * Get the appropriate orientation for a file format.
 * LCC files need a different orientation than other formats.
 * @param filename - The filename to check
 * @returns True if this is an LCC file that needs special orientation
 */
const isLccFormat = (filename: string): boolean => {
    return filename.toLowerCase().endsWith('.lcc');
};

export { loadWithSplatTransform, isSupportedFormat, isLccFormat, SUPPORTED_EXTENSIONS };
