#!/usr/bin/env node
const fs = require("fs");

import type {Room, Row, Floor, Mapp} from "./mapp";

const map: Mapp = JSON.parse(
    fs.readFileSync(process.argv[2], "utf8")
);
let minZ = 1, maxZ = 1;

// Different modes for different types of printing
const charSet: Record<string, string> = JSON.parse(
    fs.readFileSync(process.argv[3], "utf8")
);

function wr(str: string) {
    process.stdout.write(str);
}

function wc(def: string) {
    process.stdout.write(charSet[def]);
}

// Force a room to exist at the given location
function forceRoom(z, y, x) {
    if (z < minZ)
        minZ = z;
    if (z > maxZ)
        maxZ = z;
    let floor = map[z];
    if (!floor)
        floor = map[z] = {min: 0, max: 0};

    if (y < floor.min)
        floor.min = y;
    if (y > floor.max)
        floor.max = y;
    let row = floor[y];
    if (!row)
        row = floor[y] = {min: 0, max: 0};

    if (x < row.min)
        row.min = x;
    if (x > row.max)
        row.max = x;
    let room = row[x];
    if (!room)
        room = row[x] = {};

    return room;
}

// Fetch the room from this location, if it exists
function fetchRoom(z, y, x) {
    const floor: Floor = map[z] || {min: 0, max: 0};
    const row: Row = floor[y] || {min: 0, max: 0};
    return row[x];
}

// A footnote symbol for any footnote value
function footSym(num) {
    if (num < 36) {
        // Simplest case
        return num.toString(36);
    }
    num -= 36;

    if (num < 26) {
        // We didn't use capital letters yet
        return (num + 10).toString(36).toUpperCase();
    }
    num -= 26;

    const syms =
        "0*†‡⹋" +
        "αβγδεζθιλμξπςσφψ" +
        "ΓΔΛΞΠΣΦΨΩ" +
        "бджийшБ";
    if (num < syms.length)
        return syms[num];

    return "?";
}

// Find the full z range
for (minZ = 1; map[minZ]; minZ--) {}
minZ++;
for (maxZ = 1; map[maxZ]; maxZ++) {}
maxZ--;

let footnoteNo = 1;
const footnotes: Record<number, string> = {};

// Find all the footnotes
for (let z = minZ; z <= maxZ; z++) {
    const floor: Floor = map[z] || {min: 0, max: 0};

    for (let y = floor.min; y <= floor.max; y++) {
        const row = floor[y] || {min: 0, max: 0};

        for (let x = row.min; x <= row.max; x++) {
            const room: Room = row[x];

            if (room && (room.a || room.u || room.d)) {
                // This room may need a footnote
                let footnote: string[] = [];
                if (room.t)
                    footnote.push("Trap");
                if (room.a)
                    footnote.push("Note: " + room.a);
                if (room.u) {
                    let uRoom = fetchRoom(z-1, y, x);
                    if (uRoom) {
                        if (!uRoom.foot)
                            uRoom.foot = footnoteNo++;
                        footnote.push(`Up to ${footSym(uRoom.foot)}`);
                    }
                }
                if (room.d) {
                    let dRoom = fetchRoom(z+1, y, x);
                    if (dRoom) {
                        if (!dRoom.foot)
                            dRoom.foot = footnoteNo++;
                        footnote.push(`Down to ${footSym(dRoom.foot)}`);
                    }
                }

                if (footnote.length) {
                    if (!room.foot)
                        room.foot = footnoteNo++;
                    footnotes[room.foot] = footnote.join(". ");
                }
            }
        }
    }
}

// Then draw
for (let z = minZ; z <= maxZ; z++) {
    const floor: Floor = map[z] || {min: 0, max: 0};

    if (minZ !== maxZ)
        wr(`Floor ${z}:\n`);

    // Find the full X range
    let minX = 0, maxX = 0;
    for (let y = floor.min; y <= floor.max; y++) {
        const row = floor[y];
        if (!row)
            continue;
        for (let x = row.min; x < minX; x++) {
            if (row[x]) {
                minX = x;
                break;
            }
        }
        for (let x = row.max; x > maxX; x--) {
            if (row[x]) {
                maxX = x;
                break;
            }
        }
    }

    let prevRow: Row = {min: 0, max: 0};
    for (let y = floor.min; y <= floor.max; y++) {
        const row = floor[y] || {min: 0, max: 0};

        // First the north row
        for (let x = minX; x <= maxX; x++) {
            const room: Room = row[x];
            const nRoom: Room = prevRow[x];
            const eRoom: Room = row[x+1];
            const neRoom: Room = prevRow[x+1];

            // Leftmost
            if (x === minX) {
                wc("+" +
                   (nRoom ? "2" : "") +
                   (room ? "4" : ""));
            }

            // North exit
            if (room && room.n) {
                if (nRoom && nRoom.s)
                    wc(" ");
                else
                    wc("^");
            } else if (nRoom && nRoom.s) {
                wc("v");
            } else {
                wc("+" +
                   (nRoom ? "12" : "") +
                   (room ? "34" : ""));
            }

            if (room && room.foot) {
                // Footnote
                wr(footSym(room.foot));
            } else {
                wc("+" +
                   (nRoom ? "1" : "") +
                   (neRoom ? "2" : "") +
                   (room ? "3" : "") +
                   (eRoom ? "4" : ""));
            }
        }
        wr("\n");

        // Now the row itself
        for (let x = minX; x <= maxX; x++) {
            const room = row[x];
            const eRoom = row[x+1];

            // Leftmost
            if (x === minX) {
                if (room) {
                    if (room.w)
                        wc("<");
                    else
                        wc("+24");
                } else {
                    wc("+");
                }
            }

            // Room itself
            if (room) {
                if (room.t) {
                    wc("t");
                } else if (room.u) {
                    if (room.d)
                        wc("ud");
                    else
                        wc("u");
                } else if (room.d) {
                    wc("d");
                } else if (room.a) {
                    wc("n");
                } else {
                    wc("_");
                }
            } else {
                wc(".");
            }

            // And to the right
            if (room && room.e) {
                if (eRoom && eRoom.w)
                    wc(" ");
                else
                    wc(">");
            } else if (eRoom && eRoom.w) {
                wc("<");
            } else {
                wc("+" +
                   (room ? "1" : "") +
                   (eRoom ? "2" : "") +
                   (room ? "3" : "") +
                   (eRoom ? "4" : ""));
            }
        }
        wr("\n");

        prevRow = row;
    }

    // Now the bottom row
    for (let x = minX; x <= maxX; x++) {
        const room = prevRow[x];
        const eRoom = prevRow[x+1];

        if (x === minX)
            wc("+" + (room ? "2" : ""));

        if (room && room.s)
            wr("v");
        else
            wc("+" + (room ? "12" : ""));

        wc("+" +
           (room ? "1" : "") +
           (eRoom ? "2" : ""));
    }
    wr("\n");

    wr("\n");
}

// Then footnotes
if (footnoteNo > 1) {
    wr("Footnotes:\n");
    for (let fi = 1; fi < footnoteNo; fi++) {
        const footnote = footnotes[fi];
        if (footnote)
            wr(`${footSym(fi)}: ${footnote}\n`);
    }
}
