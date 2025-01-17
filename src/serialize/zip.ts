import { Crc } from "./crc";

// https://gist.github.com/rvaiya/4a2192df729056880a027789ae3cd4b7

type WriteFunc = (data: Uint8Array) => void;

class ZipArchive {
    // start a new file
    start: (filename: string) => void;

    // write data to file. can be called multiple times to stream data out.
    appendData: (data: Uint8Array) => void;

    // write text to the file. can be called multiple times to stream data out.
    appendText: (text: string) => void;

    // helper function which adds a file and appends its contents
    async file(filename: string, content: string | Uint8Array) {
        // start a new file
        await this.start(filename);

        // write file contents
        if (typeof content === 'string') {
            await this.appendText(content);
        } else {
            await this.appendData(content);
        }
    }

    // finish the archive
    end: () => void;

    constructor(writeFunc: WriteFunc) {
        const textEncoder = new TextEncoder();
        const files: { filename: Uint8Array, crc: Crc, sizeBytes: number }[] = [];

        const writeHeader = async (filename: string) => {
            const header = new Uint8Array(30 + filename.length);
            const view = new DataView(header.buffer);
            const filenameBuf = textEncoder.encode(filename);

            view.setUint32(0, 0x04034b50, true);
            view.setUint16(6, 0x8, true);               // indicate crc and size comes after
            view.setUint16(26, filename.length, true);
            header.set(filenameBuf, 30);

            await writeFunc(header);

            files.push({ filename: filenameBuf, crc: new Crc(), sizeBytes: 0 });
        };

        const writeFooter = async () => {
            const file = files[files.length - 1];
            const { crc, sizeBytes } = file;
            const data = new Uint8Array(16);
            const view = new DataView(data.buffer);
            view.setUint32(0, 0x08074b50, true);
            view.setUint32(4, crc.value(), true);
            view.setUint32(8, sizeBytes, true);
            view.setUint32(12, sizeBytes, true);
            await writeFunc(data);
        };

        this.start = async (filename: string) => {
            // write previous file footer
            if (files.length > 0) {
                await writeFooter();
            }

            await writeHeader(filename);
        };

        this.appendData = async (data: Uint8Array) => {
            const file = files[files.length - 1];
            file.sizeBytes += data.length;
            file.crc.update(data);
            await writeFunc(data);
        };

        this.appendText = async (text: string) => {
            await this.appendData(new TextEncoder().encode(text));
        };

        this.end = async () => {
            // write last file's footer
            await writeFooter();

            // write cd records
            let offset = 0;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const { filename, crc, sizeBytes } = file;

                const cdr = new Uint8Array(46 + filename.length);
                const view = new DataView(cdr.buffer);

                view.setUint32(0, 0x02014b50, true);
                view.setUint32(16, crc.value(), true);
                view.setUint32(20, sizeBytes, true);
                view.setUint32(24, sizeBytes, true);
                view.setUint16(28, filename.length, true);
                view.setUint32(42, offset, true);
                cdr.set(filename, 46);

                await writeFunc(cdr);

                offset += 30 + filename.length + sizeBytes + 16;
            }

            const filenameLength = files.reduce((tot, file) => tot + file.filename.length, 0);
            const dataLength = files.reduce((tot, file) => tot + file.sizeBytes, 0);

            // write eocd record
            const eocd = new Uint8Array(22);
            const eocdView = new DataView(eocd.buffer);
            eocdView.setUint32(0, 0x06054b50, true);
            eocdView.setUint16(8, files.length, true);
            eocdView.setUint16(10, files.length, true);
            eocdView.setUint32(12, filenameLength + files.length * 46, true);
            eocdView.setUint32(16, filenameLength + files.length * (30 + 16) + dataLength, true);

            await writeFunc(eocd);
        };
    }
}

export { ZipArchive };