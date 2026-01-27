import { GSplatData } from 'playcanvas';

import type { DataTable, ColumnType } from '@playcanvas/splat-transform';

// Map DataTable column types to PLY property types
const typeMap: Record<ColumnType, string> = {
    'int8': 'char',
    'uint8': 'uchar',
    'int16': 'short',
    'uint16': 'ushort',
    'int32': 'int',
    'uint32': 'uint',
    'float32': 'float',
    'float64': 'double'
};

/**
 * Convert a splat-transform DataTable to PlayCanvas GSplatData.
 * @param dataTable - The DataTable from splat-transform
 * @returns GSplatData compatible with PlayCanvas
 */
const dataTableToGSplatData = (dataTable: DataTable): GSplatData => {
    const properties = dataTable.columns.map((col) => {
        const dataType = col.dataType as ColumnType | null;
        return {
            type: dataType ? typeMap[dataType] ?? 'float' : 'float',
            name: col.name,
            storage: col.data,
            byteSize: col.data.BYTES_PER_ELEMENT
        };
    });

    return new GSplatData([{
        name: 'vertex',
        count: dataTable.numRows,
        properties
    }]);
};

export { dataTableToGSplatData };
