// Require Node.JS Dependencies
const { createReadStream, promises: { readdir, writeFile } } = require("fs");
const { join } = require("path");

// CONSTANTS
const BREAKLINE = ";".charCodeAt(0);
const IMPORT_KEY = "IMPORTS";
const EQUAL_SIGN = "=".charCodeAt(0);
const DOUBLE_DOT_SIGN = ":".charCodeAt(0);
const CLOSE_BRACKET = "}".charCodeAt(0);
const IMPORT_KEY_LENGTH = IMPORT_KEY.length;
const MIBS_DIR = join(__dirname, "MIBS");

// REGEX
const ReMibFrom = /FROM\s([a-zA-Z0-9-]+)/gm;
const ReMibComment = /--\s+.*/gm;
const ReASN1Group = /::=\s+{\s[\w-]+\s[0-9]\s}/gm;

/**
 * @function cleanUpANS1Comments
 * @desc Delete ASN1 comments
 * @param {!String} str 
 */
function cleanUpANS1Comments(str) {
    let comment;
    while((comment = ReMibComment.exec(str)) !== null) {
        str = str.replace(comment[0], "");
    }
    while((comment = ReMibComment.exec(str)) !== null) {
        str = str.replace(comment[0], "");
    }
    while((comment = ReMibComment.exec(str)) !== null) {
        str = str.replace(comment[0], "");
    }

    return str;
}

/**
 * @async
 * @function MIBDefinitions
 * @desc pStrrieve MIB definition!
 * @param {!String} mibPath path to mib file!
 */
async function MIBDefinitions(mibPath) {
    const buffers = [];

    // Read and get MIB header
    const readStream = createReadStream(mibPath, { highWaterMark: 1024 });
    for await (const buf of readStream) {
        const closeIndex = buf.indexOf(BREAKLINE);
        if (closeIndex !== -1) {
            buffers.push(buf.slice(0, closeIndex));
            break;
        }
        buffers.push(buf);
    }
    readStream.close();

    // Transform header to string!
    const pStr = cleanUpANS1Comments(buffers.map((buf) => buf.toString()).join(""));

    // Retrieve mib name!
    const mibNameRet = /([a-zA-Z0-9-]+)\s+DEFINITIONS\s+::=\sBEGIN/g.exec(pStr);
    const ret = {
        file: mibPath,
        name: mibNameRet !== null ? mibNameRet[1] : "unknown",
        dependencies: []
    };

    let from, startIndex = pStr.indexOf(IMPORT_KEY) + IMPORT_KEY_LENGTH;
    while((from = ReMibFrom.exec(pStr)) !== null) {
        const [completeMatch, fromMibName] = from;
        const endIndex = pStr.indexOf(completeMatch) - 1;

        ret.dependencies.push({
            name: fromMibName,
            members: pStr.slice(startIndex, endIndex).split(",").map((mem) => mem.trim())
        });
        startIndex = endIndex + (completeMatch.length + 1);
    }

    return ret;
}

async function parseASN1(mibPath) {
    // Declare variables
    const buffersArr = [];
    let tBuffers = [];
    let startIndex = 0;
    let seekCloseBlock = false;

    // Read and get MIB header
    const readStream = createReadStream(mibPath, { highWaterMark: 1024 });
    for await (let buf of readStream) {
        {
            const breakIndex = buf.indexOf(BREAKLINE);
            if (breakIndex !== -1) {
                buf = buf.slice(breakIndex + 1, buf.length);
            }
        }

        let j = 0;

        let oneMatch = false;
        for (let i = 0; i < buf.length; i++) {
            if (buf[i] === EQUAL_SIGN) {
                seekCloseBlock = true;
            }
            else if (buf[i] === CLOSE_BRACKET && seekCloseBlock) {
                const fBuf = tBuffers.length > 0 ? Buffer.concat([...tBuffers, buf]) : buf;
                const ret = fBuf.slice(startIndex, (fBuf.length - (buf.length - i)) + 1);
                tBuffers = [];
                buffersArr.push(ret);
                console.log(ret.toString());
                console.log("-----------------\n\n");
                if (j === 3) {
                    process.exit(0);
                }
                j++;

                startIndex = i+2;
                seekCloseBlock = false;
                oneMatch = true;
            }
        }

        if (startIndex <= buf.length) {
            tBuffers.push(oneMatch ? buf.slice(startIndex, buf.length) : buf);
        }
    }
    readStream.close();

    // let buffer = Buffer.concat(buffersArr);
    // buffer = buffer.slice(buffer.indexOf(BREAKLINE) + 1, buffer.length);

    // // Declare variables
    // let startIndex = 0;
    // let seekCloseBlock = false;
    // const bufBlocks = [];

    // // Match all blocks!
    // for (let i = 0; i < buffer.length; ++i) {
    //     const charCode = buffer[i];
    //     if (charCode === EQUAL_SIGN) {
    //         if (i < 2) continue;
    //         if (buffer[i - 1] === DOUBLE_DOT_SIGN && buffer[i - 2] === DOUBLE_DOT_SIGN) {
    //             seekCloseBlock = true;
    //         }
    //     }
    //     else if(charCode === CLOSE_BRACKET && seekCloseBlock) {
    //         bufBlocks.push(buffer.slice(startIndex, i + 1));
    //         startIndex = i + 2;
    //         seekCloseBlock = false;
    //     }
    // }

    // console.log(JSON.stringify(buffersArr.map((buf) => buf.toString()), null, 4));
}

async function main() {
    let importDef;

    console.time("exec");
    await parseASN1(join(MIBS_DIR, "TUNNEL-MIB.txt"));
    console.timeEnd("exec");

    // // Read headers!
    // {
    //     console.time("parseMib");
    //     const mibFiles = (await readdir(MIBS_DIR)).map(file => join(MIBS_DIR, file));
    //     importDef = await Promise.all(
    //         mibFiles.map(file => MIBDefinitions(file))
    //     );
    //     console.timeEnd("parseMib");
    // }

    // // Get all mibs name in a Set
    // const mibs = new Set(importDef.map((mib) => mib.name));

    // // Check for missing mibs!
    // for (const mib of importDef) {
    //     for (const { name } of mib.dependencies) {
    //         if (mibs.has(name)) continue;
    //         console.log(`Missing MIB :: ${name} in dependencies of MIB :: ${mib.name}`);
    //     }
    // }

    // const retStr = JSON.stringify(importDef, null, 4);
    // await writeFile("./parsed.json", retStr); 
}
main().catch(console.error);
