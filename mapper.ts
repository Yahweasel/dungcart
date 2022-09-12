#!/usr/bin/env node
const fs = require("fs");

const io = require("./io.js");
const { wr } = io;

import type {Room, Row, Floor, Mapp} from "./mapp";

interface Direction {
    k: string; // "key" (name) for the direction
    // Offsets
    x: number;
    y: number;
    z: number;
}

// Standard directions
const n: Direction = {k: "n", x: 0, y: -1, z: 0},
      s: Direction = {k: "s", x: 0, y: 1, z: 0},
      w: Direction = {k: "w", x: -1, y: 0, z: 0},
      e: Direction = {k: "e", x: 1, y: 0, z: 0},
      u: Direction = {k: "u", x: 0, y: 0, z: -1},
      d: Direction = {k: "d", x: 0, y: 0, z: 1};

if (process.argv.length < 3) {
    console.error("Use: mapper.js <map file> [character set]");
    process.exit(1);
}

// Input our map file
const mapFile = process.argv[2];
let map: Mapp = {};

try {
    map = JSON.parse(fs.readFileSync(mapFile, "utf8"));
} catch (ex) { 0; }

let curZ = 1, curY = 0, curX = 0, curMode = "x", explDig = false,
    smallMode = false, curDir = n;
let floor = map[curZ];

// Character set
const charSet: Record<string, string> = JSON.parse(
    fs.readFileSync(process.argv[3] || "charset/lines.json")
);

// Flags are just in the session, not in the map (for remembering things)
const flags: Record<number, string> = {};
const flagsByLoc: Record<string, number> = {};

// Write from the character set to stdout
function wc(def: string) {
    io.wr(charSet[def]);
}

// Save the current map
function save() {
    fs.writeFileSync(mapFile, JSON.stringify(map));
}

/* Validate mins and maxes. Either all (with no options), or a given floor
 * (with one) or row (with two). */
function validate(z?: number, y?: number) {
    if (typeof z === "undefined") {
        // Validate every floor
        for (const zs of Object.keys(map)) {
            z = +zs;
            validate(z);
        }
        return;
    }

    const floor = map[z];
    if (!floor)
        return;

    if (typeof y === "undefined") {
        // Validate every row
        for (y = floor.min; y <= floor.max; y++) {
            validate(z, y);
            if (y === floor.min && !floor[y])
                floor.min++;
        }
        for (; floor.max >= floor.min && !floor[floor.max]; floor.max--);
        if (floor.max < floor.min) floor.max = floor.min;
        if (z !== 1 && z !== curZ &&
            floor.min === floor.max && !floor[floor.min]) {
            // We can delete this whole floor
            delete map[z];
        }
        return;
    }

    const row = floor[y];
    if (!row)
        return;

    // Validate the min and max
    for (; row.min <= row.max && !row[row.min]; row.min++);
    if (row.min > row.max) row.min = row.max;
    for (; row.max >= row.min && !row[row.max]; row.max--);
    if (row.max < row.min) row.max = row.min;
    if (row.min === row.max && !row[row.min]) {
        // We can delete this whole row
        delete floor[y];
    }
}

// Create a new floor from scratch
function newFloor(startY: number, startX: number) {
    const floor: Floor = {
        min: startY,
        max: startY
    };
    floor[startY] = {
        min: startX,
        max: startX
    };
    floor[startY][startX] = {};
    return floor;
}

// Move to another room, digging if asked
function move(dir: Direction, dig = false) {
    const row: Row = floor[curY] || {min: 0, max: 0};
    const room: Room = row[curX] || {};
    let ret = false;
    const nextZ = curZ + dir.z;
    let nextY = curY + dir.y;
    let nextX = curX + dir.x;
    if (dig) {
        nextY = loopY(nextY);
        nextX = loopX(nextX);
    }

    // Digging up and down is quite different
    if (dir.z !== 0) {
        if (!map[nextZ]) {
            if (!dig) return false;
            map[nextZ] = newFloor(nextY, nextX);
            ret = true;
        }
        floor = map[nextZ];
        curZ = nextZ;

        /* Validation always keeps floors active, so validate when we change
         * floors */
        validate();
        save();
    }

    curY = nextY;
    curX = nextX;

    // Make sure the room exists
    if (!floor[nextY]) {
        if (!dig) return false;
        floor[nextY] = {
            min: nextX,
            max: nextX
        };
        if (nextY < floor.min) floor.min = nextY;
        if (nextY > floor.max) floor.max = nextY;
    }
    const nextRow = floor[nextY];

    if (!nextRow[nextX]) {
        if (!dig) return false;
        const nextRoom: Room = nextRow[nextX] = {};
        if (nextX < nextRow.min) nextRow.min = nextX;
        if (nextX > nextRow.max) nextRow.max = nextX;
        ret = true;

        // Set its opposite exit
        if (dir === u) nextRoom.d = 1;
        else if (dir !== d) {
            room[dir.k] = 1;
            nextRoom[rotate(dir, 2).k] = 1;
        }
    }

    return ret;
}

// Toggle an exit in this direction
function toggleExit(dir: Direction) {
    const row: Row = floor[curY] || {min: 0, max: 0};
    const room: Room = row[curX] || {};
    if (dir === d) {
        if (room.d) {
            if (room.t) {
                delete room.t;
                delete room.d;
            } else
                room.t = 1;
        } else
            room.d = 1;
    } else {
        if (room[dir.k])
            delete room[dir.k];
        else
            room[dir.k] = 1;
    }
}

// "Paint" this room by connecting all exits to adjoining rooms
function paint() {
    const row: Row = floor[curY] || {min: 0, max: 0};
    const room = row[curX];
    for (const dir of [n, s, e, w]) {
        const rdir = rotate(dir, 2);
        const nRow: Row = floor[curY + dir.y] || {min: 0, max: 0};
        const nRoom = nRow[curX + dir.x];
        if (room && nRoom) {
            room[dir.k] = 1;
            nRoom[rdir.k] = 1;
        } else if (room) {
            delete room[dir.k];
        } else if (nRoom) {
            delete nRoom[rdir.k];
        }
    }
}

if (!map[curZ]) {
    // Need at least a starting floor!
    floor = map[curZ] = newFloor(0, 0);
    curMode = "x";
    explDig = true;
}

// Rotations of directions
function rotate(dir: Direction, by: number) {
    switch (by) {
        case 0:
            return dir;

        case 1:
        case -3:
            if (dir === n) return e;
            if (dir === e) return s;
            if (dir === s) return w;
            if (dir === w) return n;
            return n;

        case 2:
        case -2:
            if (dir === n) return s;
            if (dir === e) return w;
            if (dir === s) return n;
            if (dir === w) return e;
            return n;

        case 3:
        case -1:
            if (dir === n) return w;
            if (dir === e) return n;
            if (dir === s) return e;
            if (dir === w) return s;
            return n;
    }
    return n;
}

// The main interface
async function main() {
    io.clear();
    io.cursor(false);

    while (true) {
        // Validate the location
        if (curMode !== "r") {
            curY = loopY(curY);
            curX = loopX(curX);
        }

        // Draw the screen
        const curRoom = smallMode ? drawScreenSmall() : drawScreen();

        // Write anything about the current room
        io.cln();
        io.color();
        if (curRoom.a)
            wr("Note: " + curRoom.a);
        wr("\n");

        // And the current mode
        io.cln();
        switch (curMode) {
            case "x": wr((explDig ? "Digging" : "Exploring") + "\n"); break;
            case "r": wr("Reading\n"); break;
            case "p": wr("Painting\n"); break;
            default: wr("???\n"); break;
        }

        // And request input
        io.clr();
        wr("> ");
        io.cursor(true);
        const data = await io.rd();
        io.cursor(false);

        if (data === "\x03" || data === "q") {
            // ctrl+C or quit
            io.clear();
            io.reset();
            io.cursor(true);
            process.exit(0);
        }

        // Perform the requested action
        switch (data) {
            // Movement
            case "w":
            case "a":
            case "s":
            case "d":
            case "r": // up
            case "f": // down
                switch (curMode + data) {
                    // exploring
                    case "xw": move(curDir, explDig); if (explDig) save(); break;
                    case "xa": curDir = rotate(curDir, -1); break;
                    case "xs": curDir = rotate(curDir, 2); break;
                    case "xd": curDir = rotate(curDir, 1); break;
                    case "xr": move(u, explDig); io.clear(); if (explDig) save(); break;
                    case "xf": move(d, explDig); io.clear(); if (explDig) save(); break;

                    // painting
                    case "pw": move(n, true); paint(); save(); break;
                    case "pa": move(w, true); paint(); save(); break;
                    case "ps": move(s, true); paint(); save(); break;
                    case "pd": move(e, true); paint(); save(); break;
                    case "pr": move(u, true); paint(); io.clear(); save(); break;
                    case "pf": move(d, true); paint(); io.clear(); save(); break;

                    // reading
                    case "rw": move(n, false); break;
                    case "ra": move(w, false); break;
                    case "rs": move(s, false); break;
                    case "rd": move(e, false); break;
                    case "rr": move(u, false); io.clear(); break;
                    case "rf": move(d, false); io.clear(); break;
                }
                break;

            // Digging
            case "W": toggleExit(curDir); save(); break;
            case "A": toggleExit(rotate(curDir, -1)); save(); break;
            case "S": toggleExit(rotate(curDir, 2)); save(); break;
            case "D": toggleExit(rotate(curDir, 1)); save(); break;
            case "R": toggleExit(u); save(); break;
            case "F": toggleExit(d); save(); break;

            case "z": // delete
                delete floor[curY][curX];
                if (curMode === "p") {
                    paint();
                }
                validate();
                save();
                break;

            case "e": // edit note
                await editNote();
                break;

            case "v": // small mode
                smallMode = !smallMode;
                break;

            case "t": // read mode
                curMode = (curMode === "r") ? "x" : "r";
                break;

            case "g": // paint mode
                curMode = (curMode === "p") ? "x" : "p";
                break;

            case " ": // mode change
                if (curMode === "x") {
                    explDig = !explDig;
                } else {
                    curMode = "x";
                    explDig = false;
                }
                break;

            case "x": // activate explore + dig
                if (curMode === "x") {
                    explDig = !explDig;
                } else {
                    curMode = "x";
                    explDig = true;
                }
                break;

            case "1":
            case "2":
            case "3":
            case "4":
            {
                // Flags
                const flag = data.charCodeAt(0) - ("0").charCodeAt(0);
                const loc = curZ + "," + curY + "," + curX;
                if (flagsByLoc[loc]) {
                    const oldFlag = flagsByLoc[loc];
                    delete flags[oldFlag];
                    delete flagsByLoc[loc];
                    if (oldFlag === flag)
                        break;
                }
                if (flags[flag]) {
                    const oldLoc = flags[flag];
                    delete flags[flag];
                    delete flagsByLoc[oldLoc];
                }
                flags[flag] = loc;
                flagsByLoc[loc] = flag;
                break;
            }

            case "o": // "oops": fix major problems
                await oopsMenu();
                break;

            case "l": // loop menu
                await loopMenu();
                break;

            // Help
            case "h":
            case "H":
            case "/":
            case "?":
                await help();
                break;
        }
    }
}

// Draw the map part of the screen
function drawScreen() {
    /* Draw the extra state for this room. Returns true if there was any
     * extra state to draw. */
    function extraState(room: Room, y: number, x: number): boolean {
        const loc = curZ + "," + y + "," + x;
        const flag = flagsByLoc[loc];
        if (room && (room.a || flag || room.u || room.d)) {
            if ((room.a || flag) && (room.u || room.d)) {
                // Show the note with color instead of text
                io.color(62, 2);
            } else if (flag) {
                io.color(65, 0);
            } else {
                io.color(62, 0);
            }
        }
        if (room && room.t) {
            wc("t");
            return true;
        } else if (room && room.u) {
            if (room.d)
                wc("ud");
            else
                wc("u");
            return true;
        } else if (room && room.d) {
            wc("d");
            return true;
        } else if (flag) {
            wr(String.fromCharCode(0x30 + flag));
            return true;
        } else if (room && room.a) {
            wc("n");
            return true;
        }

        return false;
    }

    let curRoom: Room = {};

    // Figure out our display ranges
    let maxH = Math.floor((io.termSize.h-4)/2);
    if (maxH < 8) maxH = 8;
    let maxW = Math.floor(io.termSize.w/2);
    if (maxW < 8) maxW = 8;
    let minY, minX;
    {
        const hh = maxH/2;
        minY = Math.floor(curY - hh);
    }
    {
        const hw = maxW/2;
        minX = Math.floor(curX - hw);
    }
    const endY = io.termSize.h - 3;

    // Draw the floor
    const loop = floor.loop || {};
    io.reset();
    io.cln();
    wr(`Floor ${curZ} `);
    io.color(4);
    wr(`(${curX}, ${-curY})\n`);
    let scY = 1;
    let prevRow: Row = floor[minY-1] || floor[loopY(minY-1)] ||
        {min: 0, max: 0};
    for (let ay = minY;; ay++) {
        const y = loopY(ay);
        const row: Row = floor[ay] || floor[y] || {min: 0, max: 0};
        let scX = 0;

        // North paths first
        for (let ax: number = minX;; ax++) {
            const x = loopX(ax);
            const room = row[ax] || row[x];
            const nRoom = prevRow[ax] || prevRow[x];
            const eRoom = row[ax+1] || row[loopX(ax+1)];
            const neRoom = prevRow[ax+1] || prevRow[loopX(ax+1)];

            if (ay === y && ax === x)
                io.color();
            else if (room && (row === floor[ay] && room === row[ax]))
                io.color(61);
            else
                io.color(60);

            // NW tile
            if (ax === minX) {
                const wRoom = row[ax-1] || row[loopX(ax-1)];
                const nwRoom = prevRow[ax-1] || prevRow[loopX(ax-1)];
                wc("+" +
                   (nwRoom ? "1" : "") +
                   (nRoom ? "2" : "") +
                   (wRoom ? "3" : "") +
                   (room ? "4" : "") +
                   ((nwRoom && nwRoom.e && nRoom && nRoom.w) ? "n" : "") +
                   ((nRoom && nRoom.s && room && room.n) ? "e" : "") +
                   ((room && room.w && wRoom && wRoom.e) ? "s" : "") +
                   ((wRoom && wRoom.n && nwRoom && nwRoom.s) ? "w" : ""));
                if (++scX >= io.termSize.w)
                    break;
            }

            // N tile
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
            if (++scX >= io.termSize.w)
                break;

            // If this is where the character is, the NE tile indicates extra state
            if (ay !== curY || ax !== curX || !extraState(room, y, x)) {
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
            if (++scX >= io.termSize.w)
                break;
        }
        io.cln();
        wr("\n");
        if (++scY >= endY)
            break;
        scX = 0;

        // Now the row of rooms itself
        for (let ax: number = minX;; ax++) {
            const x = loopX(ax);
            const room = row[ax] || row[x];
            const eRoom = row[ax+1] || row[loopX(ax+1)];

            let fg = 60;
            if (ay === y && ax === x)
                fg = 67;
            else if (room && (row === floor[ay] && room === row[ax]))
                fg = 61;
            io.color(fg);

            if (ax === minX) {
                const wRoom = row[ax-1] || row[loopX(ax-1)];
                if (room && room.w) {
                    if (wRoom && wRoom.e)
                        wc(" ");
                    else
                        wc("<");
                } else if (wRoom && wRoom.e) {
                    wc(">");
                } else {
                    wc("+" +
                       (wRoom ? "1" : "") +
                       (room ? "2" : "") +
                       (wRoom ? "3" : "") +
                       (room ? "4e" : "") +
                       (wRoom ? "w" : ""));
                }
                if (++scX >= io.termSize.w)
                    break;
            }

            if (ay === curY && ax === curX) {
                io.color(1);
                // This is our current room, so indicate it
                curRoom = room || {};
                if (curMode === "r" || curMode === "p")
                    wr("\u25cf" /* @ */);
                else switch (curDir.k) {
                    case "n": wr("\u25b4" /* ^ */); break;
                    case "e": wr("\u25b8" /* > */); break;
                    case "s": wr("\u25be" /* v */); break;
                    case "w": wr("\u25c2" /* < */); break;
                    default:  wr("\u25cf" /* @ */);
                }
                io.color(fg);

            } else if (extraState(room, y, x)) {
                // Just fix the color
                io.color(fg);

            } else if (room) {
                wc("_");

            } else {
                wc(".");

            }
            if (++scX >= io.termSize.w)
                break;

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
            if (++scX >= io.termSize.w)
                break;
        }
        io.cln();
        wr("\n");
        if (++scY >= endY)
            break;

        prevRow = row;
    }

    for (; scY < io.termSize.h - 5; scY++) {
        io.cln();
        wr("\n");
    }

    return curRoom;
}

// Draw the map part of the screen, small mode
function drawScreenSmall() {
    const curRow: Row = floor[curY] || {min: 0, max: 0};
    const curRoom: Room = curRow[curX] || {};

    // Figure out our display ranges
    let maxH = io.termSize.h-4;
    if (maxH < 8) maxH = 8;
    let maxW = io.termSize.w-1;
    if (maxW < 8) maxW = 8;
    let minY, maxY, minX, maxX;
    {
        const hh = Math.floor(maxH/2);
        minY = curY - hh;
        maxY = curY + hh - 1;
    }
    {
        const hw = Math.floor(maxW/2);
        minX = curX - hw;
        maxX = curX + hw - 1;
    }

    // Draw the floor indicator
    io.reset();
    io.color();
    io.cln();
    wr(`Floor ${curZ} `);
    // FIXME: duplication
    io.color(1);
    if (curMode === "r" || curMode === "p")
        wr("\u25cf" /* @ */);
    else switch (curDir.k) {
        case "n": wr("\u25b4" /* ^ */); break;
        case "e": wr("\u25b8" /* > */); break;
        case "s": wr("\u25be" /* v */); break;
        case "w": wr("\u25c2" /* < */); break;
        default:  wr("\u25cf" /* @ */);
    }
    wr(" ");
    if (curRoom.a && (curRoom.u || curRoom.d)) {
        io.color(62, 2);
    } else {
        io.color(2);
    }
    if (curRoom.u) {
        if (curRoom.d)
            wr("\u2195" /* ^v */);
        else
            wr("\u2191" /* ^ */);
    } else if (curRoom.d) {
        if (curRoom.t)
            wr("\u2913" /* v trap */);
        else
            wr("\u2193" /* v */);
    } else if (curRoom.a) {
        wr("\u25a4" /* note */);
    } else {
        wr(" ");
    }
    io.color(4);
    wr(` (${curX}, ${-curY})\n`);
    io.color();

    for (let ay = minY; ay <= maxY; ay++) {
        const y = loopY(ay);
        const row: Row = floor[ay] || floor[y] || {min: 0, max: 0};

        for (let ax: number = minX; ax <= maxX; ax++) {
            const x = loopX(ax);
            const room: Room = row[ax] || row[x] || {};

            const ind =
                room.n ? (
                    room.e ? (
                        room.s ? (
                            room.w ? "\u256c" : "\u2560"
                        ) : (
                            room.w ? "\u2569" : "\u255a"
                        )
                    ) : (
                        room.s ? (
                            room.w ? "\u2563" : "\u2551"
                        ) : (
                            room.w ? "\u255d" : "\u2579"
                        )
                    )
                ) : (
                    room.e ? (
                        room.s ? (
                            room.w ? "\u2566" : "\u2554"
                        ) : (
                            room.w ? "\u2550" : "\u257a"
                        )
                    ) : (
                        room.s ? (
                            room.w ? "\u2557" : "\u257b"
                        ) : (
                            room.w ? "\u2578" : (
                                (row[ax] || row[x]) ? "\u25a1" : " "
                            )
                        )
                    )
                );

            // Select the colors based on what's here
            let fg = 60;
            if (ay === y && ax === x)
                fg = 67;
            else if (room && (row === floor[ay] && room === row[ax]))
                fg = 61;
            let bg = 0;
            if (ay === curY && ax === curX)
                bg += 1;
            if (room.a || room.u || room.d)
                bg += 2;
            io.color(fg, bg);
            wr(ind);
        }
        io.color();
        io.cln();
        wr("\n");
    }

    return curRoom;
}

// Edit a note
async function editNote() {
    let note = "";
    const row: Row = floor[curY] || {min: 0, max: 0};
    const room: Room = row[curX] || {};

    wr("\r");
    io.cln();
    wr("Note: ");

    io.cursor(true);
    while (true) {
        const data = await io.rd();
        if (data === "\n" || data === "\r") {
            // End of line
            if (note === "")
                delete room.a;
            else
                room.a = note;
            save();
            break;

        } else if (data === "\x7f") {
            // backspace
            note = note.slice(0, note.length - 1);
            wr("\rNote: " + note);
            io.cln();

        } else if (data === "\x03") {
            // ctrl+C
            process.exit(0);

        } else {
            wr(data);
            note += data;

        }
    }
    io.cursor(false);
    io.clear();
}

// The "oops" menu: fix issues with the map
async function oopsMenu() {
    io.clear();
    io.reset();
    io.color();
    wr(
`wasd: Move this floor in the given direction.
WASD: Move all floors in the given direction.
q: Cancel.
> `);

    // Fix the X in the given direction
    function moveX(by: number, allFloors: boolean) {
        for (const z of Object.keys(map)) {
            if (!allFloors && +z !== curZ) continue;
            const floor = map[z];

            for (let y = floor.min; y <= floor.max; y++) {
                const row = floor[y];
                if (!row) continue;

                for (let x = (by > 0) ? row.max : row.min;
                     x >= row.min && x <= row.max;
                     x -= by) {
                    if (!row[x])
                        continue;
                    row[x + by] = row[x];
                    delete row[x];
                }
                row.min += by;
                row.max += by;
            }
        }
        validate();
        save();
    }

    // Fix by Y in the given direction
    function moveY(by: number, allFloors: boolean) {
        for (const z of Object.keys(map)) {
            if (!allFloors && +z !== curZ) continue;
            const floor = map[z];

            for (let y = (by > 0) ? floor.max : floor.min;
                 y >= floor.min && y <= floor.max;
                 y -= by) {
                if (!floor[y])
                    continue;
                floor[y + by] = floor[y];
                delete floor[y];
            }
            floor.min += by;
            floor.max += by;
        }
        validate();
        save();
    }

    io.cursor(true);
    const data = await io.rd();
    io.cursor(false);
    switch (data) {
        case "w":
        case "W":
            moveY(-1, (data === "W"));
            break;

        case "a":
        case "A":
            moveX(-1, (data === "A"));
            break;

        case "s":
        case "S":
            moveY(1, (data === "S"));
            break;

        case "d":
        case "D":
            moveX(1, (data === "D"));
            break;
    }

    io.clear();
}

// The loop menu
async function loopMenu() {
    // Get the loop status for display
    const loopStatus: string[] = [];
    if (floor.loop) {
        for (const dir of ["s", "n"]) {
            const l = floor.loop[dir];
            if (typeof l === "number")
                loopStatus.push(dir.toUpperCase() + `: ${-l}`);
        }
        for (const dir of ["w", "e"]) {
            const l = floor.loop[dir];
            if (typeof l === "number")
                loopStatus.push(dir.toUpperCase() + `: ${l}`);
        }
    }
    const loopStr = loopStatus.join(", ");

    // Display the menu
    io.clear();
    io.reset();
    io.color();
    wr(
`wasd: Set loop point.
WASD: Rotate rooms within the loop points.
z: Clear looping data for this floor.
q: Cancel.

Current loop status: ${loopStr || "non-looping"}
> `);

    function setLoop(dir: string) {
        const loop = floor.loop = floor.loop || {};
        loop[dir] = (dir === "n" || dir === "s") ? curY : curX;
        if (typeof loop.n === "number" &&
            typeof loop.s === "number" &&
            loop.s < loop.n) {
            const tmp = loop.s;
            loop.s = loop.n;
            loop.n = tmp;
        }
        if (typeof loop.w === "number" &&
            typeof loop.e === "number" &&
            loop.e < loop.w) {
            const tmp = loop.e;
            loop.e = loop.w;
            loop.w = tmp;
        }
        mergeLoop();
        validate();
        save();
    }

    io.cursor(true);
    const data = await io.rd();
    io.cursor(false);
    switch (data) {
        case "w":
            setLoop("n");
            break;

        case "a":
            setLoop("w");
            break;

        case "s":
            setLoop("s");
            break;

        case "d":
            setLoop("e");
            break;

        case "z":
            delete floor.loop;
            validate();
            save();
            break;
    }

    io.clear();
}

// Get a Y location with looping in mind
function loopY(y: number) {
    const loop = floor.loop;
    if (!loop ||
        typeof loop.n !== "number" ||
        typeof loop.s !== "number")
        return y;
    const len = loop.s - loop.n + 1;
    while (y < loop.n)
        y += len;
    while (y > loop.s)
        y -= len;
    return y;
}

// Get an X location with looping in mind
function loopX(x: number) {
    const loop = floor.loop;
    if (!loop ||
        typeof loop.w !== "number" ||
        typeof loop.e !== "number")
        return x;
    const len = loop.e - loop.w + 1;
    while (x < loop.w)
        x += len;
    while (x > loop.e)
        x -= len;
    return x;
}

/* Move an entire room, presumably due to looping, merging it with the
 * target room to the degree that that's possible. Returns true if the move
 * was successful. The map must be *validated* and saved after this. */
function moveRoom(
    fromZ: number, fromY: number, fromX: number,
    toZ: number, toY: number, toX: number
) {
    // Find the "from" room
    const fromFloor = map[fromZ];
    if (!fromFloor)
        return false;
    const fromRow = fromFloor[fromY];
    if (!fromRow)
        return false;
    const fromRoom = fromRow[fromX];
    if (!fromRoom)
        return false;

    // Find the "to" row
    if (!map[toZ]) {
        const f = map[toZ] = newFloor(toY, toX);
        // So that it'll merge properly
        delete map[toZ][toY][toX];
    }
    const toFloor = map[toZ];
    if (!toFloor[toY]) {
        toFloor[toY] = {min: toX, max: toX};
        if (toY < toFloor.min)
            toFloor.min = toY;
        if (toY > toFloor.max)
            toFloor.max = toY;
    }
    const toRow = toFloor[toY];

    // If there is no to *room*, this is easy; just move it
    if (!toRow[toX]) {
        toRow[toX] = fromRoom;
        if (toX < toRow.min)
            toRow.min = toX;
        if (toX > toRow.max)
            toRow.max = toX;
        delete fromRow[fromX];
        return true;
    }

    function exits(room: Room) {
        return Object.keys(room)
            .sort()
            .filter(x => x != "a" /* handled separately */)
            .join("");
    }

    // Otherwise, attempt to merge them
    const toRoom = toRow[toX];
    if (exits(fromRoom) !== exits(toRoom)) {
        // Can't merge, different exits
        return false;
    }

    // Exits are the same, so just worry about the note
    if (fromRoom.a) {
        if (toRoom.a)
            toRoom.a += "/" + fromRoom.a;
        else
            toRoom.a = fromRoom.a;
    }

    // Delete the old room, now that it's merged
    delete fromRow[fromX];
    return true;
}

// Merge looping rooms on this floor
function mergeLoop() {
    let changed = false;
    const loop = floor.loop;
    if (!loop)
        return;

    if (typeof loop.n === "number" &&
        typeof loop.s === "number") {
        // Merge Y loops
        for (let fromY = floor.min; fromY <= floor.max; fromY++) {
            const fromRow = floor[fromY];
            if (!fromRow)
                continue;
            const toY = loopY(fromY);
            if (fromY === toY)
                continue;

            for (let x = fromRow.min; x <= fromRow.max; x++)
                changed = moveRoom(curZ, fromY, x, curZ, toY, x) || changed;
        }
    }

    if (typeof loop.w === "number" &&
        typeof loop.e === "number") {
        // Merge X loops
        for (let y = floor.min; y <= floor.max; y++) {
            const row = floor[y];
            if (!row)
                continue;

            for (let fromX = row.min; fromX <= row.max; fromX++) {
                if (!row[fromX])
                    continue;
                const toX = loopX(fromX);
                if (fromX === toX)
                    continue;
                changed = moveRoom(curZ, y, fromX, curZ, y, toX) || changed;
            }
        }
    }

    if (changed) {
        validate();
        save();
    }
}


// Help screen
async function help() {
    io.clear();
    io.reset();
    io.color();
    wr(
`Help:
space: Enter/exit explore mode
x: Enter/exit digging mode
t: Enter/exit read mode
g: Enter/exit paint mode
e: Edit note
v: Switch between view sizes
z: Delete room
o: "Oops" menu: fix major problems
l: Loop menu, set floor looping parameters
1-4: Place/unplace flags 1-4
q: Quit

Movement: wasd, r = up, f = down
Explore: Move directionally
Digging: Move directionally, create new rooms
Read: Move in absolute directions
Paint: Move in absolute directions, painting
       rooms

Shift+wasdrf: Digs exits\n`);
    await io.rd();
}

main();
