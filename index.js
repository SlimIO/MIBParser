// Require Node.JS Dependencies
const { createReadStream, promises: { readdir, writeFile } } = require("fs");
const { join } = require("path");

// CONSTANTS
const BREAKLINE = ";".charCodeAt(0);
const IMPORT_KEY = "IMPORTS";
const IMPORT_KEY_LENGTH = IMPORT_KEY.length;
const MIBS_DIR = join(__dirname, "MIBS");

// REGEX
const ReMibFrom = /FROM\s([a-zA-Z0-9-]+)/gm;
const ReMibComment = /--\s+.*/gm;

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

async function main() {

    console.time("parseMib");
    const mibFiles = (await readdir(MIBS_DIR)).map(file => join(MIBS_DIR, file));
    const def = await Promise.all(
        mibFiles.map(file => MIBDefinitions(file))
    );
    console.timeEnd("parseMib");

    const retStr = JSON.stringify(def, null, 4);
    await writeFile("./parsed.json", retStr); 
}
main().catch(console.error);
