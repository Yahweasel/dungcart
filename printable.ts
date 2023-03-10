#!/usr/bin/env node
/*
 * Copyright (C) 2022 Yahweasel
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 * OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 * CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE. 
 */

import * as fs from "fs";
import * as path from "path";

import type {Room, Row, Floor, Mapp} from "./mapp";

if (process.argv.length < 3) {
    console.error("Use: printable.js <map file> [character set]");
    process.exit(1);
}

const map: Mapp = JSON.parse(
    fs.readFileSync(process.argv[2], "utf8")
);
let minZ = 1, maxZ = 1;

// Find the character set file
const charSetFile = (() => {
    const charset = process.argv[3] || "lines";
    const base = `charset/${charset}.json`;
    const bindir = path.dirname(process.argv[1]);
    let f = base;
    for (const dir of [
        ".", bindir, `${bindir}/../dung-cart`, `${bindir}/../share/dung-cart`,
        "."
    ]) {
        f = `${dir}/${base}`;
        try {
            fs.accessSync(f);
            break;
        } catch (ex) {}
    }
    return f;
})();

// Load the character set
const charSet: Record<string, string> = JSON.parse(
    fs.readFileSync(charSetFile, "utf8")
);

function wr(str: string) {
    process.stdout.write(str);
}

function wc(def: string) {
    process.stdout.write(charSet[def]);
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
        "0*?????????" +
        "????????????????????????????????" +
        "??????????????????" +
        "??????????????";
    if (num < syms.length)
        return syms[num];

    return "?";
}

// Find the full z range
for (minZ = 1; map[minZ]; minZ--);
minZ++;
for (maxZ = 1; map[maxZ]; maxZ++);
maxZ--;

let footnoteNo = 1;
const footnotes: Record<number, string> = {};
const footnotesInv: Record<string, number> = {};

// Find all the footnotes
for (let z = minZ; z <= maxZ; z++) {
    const floor: Floor = map[z] || {min: 0, max: 0};

    for (let y = floor.min; y <= floor.max; y++) {
        const row = floor[y] || {min: 0, max: 0};

        for (let x = row.min; x <= row.max; x++) {
            const room: Room = row[x];

            if (room && (room.a || room.u || room.d)) {
                // This room may need a footnote
                const footnote: string[] = [];
                if (room.t)
                    footnote.push("Trap");
                if (room.a)
                    footnote.push("Note: " + room.a);
                if (room.u) {
                    const uRoom = fetchRoom(z-1, y, x);
                    if (uRoom) {
                        if (!uRoom.foot)
                            uRoom.foot = footnoteNo++;
                        footnote.push(`Up to ${footSym(uRoom.foot)}`);
                    }
                }
                if (room.d) {
                    const dRoom = fetchRoom(z+1, y, x);
                    if (dRoom) {
                        if (!dRoom.foot)
                            dRoom.foot = footnoteNo++;
                        footnote.push(`Down to ${footSym(dRoom.foot)}`);
                    }
                }

                if (footnote.length) {
                    // Check if this footnote already exists
                    const fstr = footnote.join(". ");
                    if (!room.foot && fstr in footnotesInv) {
                        room.foot = footnotesInv[fstr];
                    } else {
                        // Make it
                        if (!room.foot)
                            room.foot = footnoteNo++;
                        footnotes[room.foot] = fstr;
                        footnotesInv[fstr] = room.foot;
                    }
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
    let minX = Infinity, maxX = -Infinity;
    for (let y = floor.min; y <= floor.max; y++) {
        const row = floor[y];
        if (!row)
            continue;
        for (let x = row.min; x <= row.max && x < minX; x++) {
            if (row[x]) {
                minX = x;
                break;
            }
        }
        for (let x = row.max; x >= row.min && x > maxX; x--) {
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
                   (room ? "4" : "") +
                   ((room && room.n && nRoom && nRoom.s) ? "e" : ""));
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
                   (room ? "34" : "") +
                   (nRoom ? "n" : "") +
                   (room ? "s" : ""));
            }

            if (room && room.foot) {
                // Footnote
                wr(footSym(room.foot));
            } else {
                wc("+" +
                   (nRoom ? "1" : "") +
                   (neRoom ? "2" : "") +
                   (room ? "3" : "") +
                   (eRoom ? "4" : "") +
                   ((nRoom && nRoom.e && neRoom && neRoom.w) ? "n" : "") +
                   ((neRoom && neRoom.s && eRoom && eRoom.n) ? "e" : "") +
                   ((eRoom && eRoom.w && room && room.e) ? "s" : "") +
                   ((room && room.n && nRoom && nRoom.s) ? "w" : ""));
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
                        wc("+24e");
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
                   (eRoom ? "4e" : "") +
                   (room ? "w" : ""));
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
            wc("v");
        else
            wc("+" + (room ? "12n" : ""));

        wc("+" +
           (room ? "1" : "") +
           (eRoom ? "2" : "") +
           ((room && room.e && eRoom && eRoom.w) ? "n" : ""));
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
