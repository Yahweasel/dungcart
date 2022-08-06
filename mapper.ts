#!/usr/bin/env node
const fs = require("fs");

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
let mapFile = process.argv[2];
let map: Mapp = {};

try {
    map = JSON.parse(fs.readFileSync(mapFile, "utf8"));
} catch (ex) {}

let curZ = 1, curY = 0, curX = 0, curMode = "x", explDig = false,
    smallMode = false, curDir = n;
let floor = map[curZ];

// Character set
const charSet: Record<string, string> = JSON.parse(
    fs.readFileSync(process.argv[3] || "charset/lines.json")
);

// We want raw input
const stdin = process.stdin;
stdin.setRawMode(true);
stdin.resume();
stdin.setEncoding("utf8");

let stdinBuffer: string[] = [];
let stdinThen: (data:string)=>unknown = null;

// Handle this data
function stdinHandler(data: string) {
    for (let di = 0; di < data.length; di++) {
        stdinBuffer.push(data[di]);
        if (stdinThen) {
            const then = stdinThen;
            stdinThen = null;
            then(stdinBuffer.shift());
        }
    }
}
stdin.on("data", stdinHandler);

// Read a character from stdin then do something
function rd(then: (data:string)=>unknown) {
    if (stdinBuffer.length) {
        then(stdinBuffer.shift());
    } else {
        if (stdinThen)
            throw new Error();
        stdinThen = then;
    }
}

// Write to stdout
function wr(text: string) {
    process.stdout.write(text);
}

// Write from the character set to stdout
function wc(def: string) {
    process.stdout.write(charSet[def]);
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
        for (let zs of Object.keys(map)) {
            z = +zs;
            validate(z);
            if (z !== 1) {
                const floor = map[z];
                if (floor &&
                    floor.min === floor.max &&
                    !floor[floor.min]) {
                    // Delete this floor
                    delete map[z];
                }
            }
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
        for (; floor.max >= floor.min && !floor[floor.max]; floor.max--) {}
        if (floor.max < floor.min) floor.max = floor.min;
        if (floor.min === floor.max && !floor[floor.min] && z !== 1) {
            // We can delete this whole floor
            delete map[z];
        }
        return;
    }

    const row = floor[y];
    if (!row)
        return;

    // Validate the min and max
    for (; row.min <= row.max && !row[row.min]; row.min++) {}
    if (row.min > row.max) row.min = row.max;
    for (; row.max >= row.min && !row[row.max]; row.max--) {}
    if (row.max < row.min) row.max = row.min;
    if (row.min === row.max && !row[row.min]) {
        // We can delete this whole row
        delete floor[y];
    }
}

// Create a new floor from scratch
function newFloor(startY: number, startX: number) {
    let floor: Floor = {
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
function move(dir: Direction, dig: boolean = false) {
    let row: Row = floor[curY] || {min: 0, max: 0};
    let room: Room = row[curX] || {};
    let ret = false;
    let nextZ = curZ + dir.z;
    let nextY = curY + dir.y;
    let nextX = curX + dir.x;

    // Digging up and down is quite different
    if (dir.z !== 0) {
        if (!map[nextZ]) {
            if (!dig) return false;
            map[nextZ] = newFloor(nextY, nextX);
            ret = true;
        }
        floor = map[nextZ];
        curZ = nextZ;
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
    let nextRow = floor[nextY];

    if (!nextRow[nextX]) {
        if (!dig) return false;
        let nextRoom: Room = nextRow[nextX] = {};
        if (nextX < nextRow.min) nextRow.min = nextX;
        if (nextX > nextRow.max) nextRow.max = nextX;
        ret = true;

        // Set its opposite exit
        if (dir === u) nextRoom.d = 1;
        else if (dir === d) {} // maybe pitfall
        else {
            room[dir.k] = 1;
            nextRoom[rotate(dir, 2).k] = 1;
        }
    }

    return ret;
}

// Toggle an exit in this direction
function toggleExit(dir: Direction) {
    let row: Row = floor[curY] || {min: 0, max: 0};
    let room: Room = row[curX] || {};
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
    curMode = "d";
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

// Set the color
function color(fg: number = 67, bg: number = 0) {
    fg += 30;
    bg += 40;
    wr("\x1b[m\x1b[" + bg + "m\x1b[" + fg + "m");
}

// Size of the terminal
let termSize = {w: 80, h: 25};
function onResize() {
    termSize.w = process.stdout.columns;
    termSize.h = process.stdout.rows;
}
if (process.stdout.isTTY) {
    process.stdout.on("resize", onResize);
    onResize();
}

// Reset our screen position
function reset() {
    color();
    wr("\x1b[H");
}

// Clear the screen
function clear() {
    wr("\x1b[2J");
}

// Clear the REST of the screen
function clr() {
    wr("\x1b[J");
}

// Clear the line
function cln() {
    wr("\x1b[K");
}

// Show or hide the cursor
function cursor(on: boolean) {
    wr("\x1b[?25" + (on?"h":"l"));
}

// Set or unset bold
function bold(on: boolean) {
    wr("\x1b[" + (on?"1":"0") + "m");
}

// Block drawing characters
const fullBlock = "\u2588",
      upTriangle = "\ud83e\udf6f",
      rightTriangle = "\ud83e\udf6c",
      downTriangle = "\ud83e\udf6d",
      leftTriangle = "\ud83e\udf6e";

// Our main input function
function main(data: string) {
    if (data === "\x03" || data === "q") {
        // ctrl+C or quit
        wr("\n");
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
                // digging
                case "dw": toggleExit(curDir); save(); break;
                case "da": toggleExit(rotate(curDir, -1)); save(); break;
                case "ds": toggleExit(rotate(curDir, 2)); save(); break;
                case "dd": toggleExit(rotate(curDir, 1)); save(); break;
                case "dr": toggleExit(u); save(); break;
                case "df": toggleExit(d); save(); break;

                // exploring
                case "xw": move(curDir, explDig); if (explDig) save(); break;
                case "xa": curDir = rotate(curDir, -1); break;
                case "xs": curDir = rotate(curDir, 2); break;
                case "xd": curDir = rotate(curDir, 1); break;
                case "xr": move(u, explDig); clear(); if (explDig) save(); break;
                case "xf": move(d, explDig); clear(); if (explDig) save(); break;

                // painting
                case "pw": move(n, true); paint(); save(); break;
                case "pa": move(w, true); paint(); save(); break;
                case "ps": move(s, true); paint(); save(); break;
                case "pd": move(e, true); paint(); save(); break;
                case "pr": move(u, true); paint(); clear(); save(); break;
                case "pf": move(d, true); paint(); clear(); save(); break;

                // reading
                case "rw": move(n, false); break;
                case "ra": move(w, false); break;
                case "rs": move(s, false); break;
                case "rd": move(e, false); break;
                case "rr": move(u, false); clear(); break;
                case "rf": move(d, false); clear(); break;
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
            if (curMode !== "r") {
                delete floor[curY][curX];
                if (curMode === "p") {
                    paint();
                } else {
                    curMode = "x";
                }
                validate();
                save();
            }
            break;

        case "e": // edit note
            if (curMode !== "r") {
                editNote();

                // editNote will resume the main loop itself
                return;
            }
            break;

        case "v": // small mode
            smallMode = !smallMode;
            break;

        case "t": // read mode
            curMode = "r";
            break;

        case "g": // paint mode
            curMode = "p";
            break;

        case " ": // mode change
            if (curMode === "x") {
                curMode = "d";
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

        // Help
        case "h":
        case "H":
        case "/":
        case "?":
            help();
            return;
    }

    // Draw the screen
    const curRoom = smallMode ? drawScreenSmall() : drawScreen();

    // Write anything about the current room
    cln();
    color();
    if (curRoom.a)
        wr("Note: " + curRoom.a);
    wr("\n");

    // And the current mode
    cln();
    switch (curMode) {
        case "x": wr("Exploring" + (explDig ? " + digging" : "") + "\n"); break;
        case "d": wr("Digging\n"); break;
        case "r": wr("Reading\n"); break;
        case "p": wr("Painting\n"); break;
        default: wr("???\n"); break;
    }

    // And request input
    clr();
    wr("> ");
    cursor(true);

    rd(main);
}

// Draw the map part of the screen
function drawScreen() {
    /* Draw the extra state for this room. Returns true if there was any extra
     * state to draw. */
    function extraState(room: Room): boolean {
        if (room && (room.a || room.u || room.d)) {
            if (room.a && (room.u || room.d)) {
                // Show the note with color instead of text
                color(62, 2);
            } else {
                color(62, 0);
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
        } else if (room && room.a) {
            wc("n");
            return true;
        }

        return false;
    }

    let curRoom: Room = {};

    // Figure out our display ranges
    let maxH = ~~((termSize.h-4)/2);
    if (maxH < 8) maxH = 8;
    let maxW = ~~(termSize.w/2);
    if (maxW < 8) maxW = 8;
    let minY, minX, endY;
    {
        let hh = maxH/2;
        minY = ~~(curY - hh);
    }
    {
        let hw = maxW/2;
        minX = ~~(curX - hw);
    }
    endY = termSize.h - 3;

    // Draw the floor
    cursor(false);
    reset();
    cln();
    wr(`Floor ${curZ} `);
    color(4);
    wr(`(${curX}, ${-curY})\n`);
    let scY = 1;
    let prevRow: Row = floor[minY-1] || {min: 0, max: 0};
    for (let y = minY;; y++) {
        let row: Row = floor[y] || {min: 0, max: 0};
        let scX = 0;

        // North paths first
        for (let x: number = minX;; x++) {
            const room = row[x];
            const nRoom = prevRow[x];
            const eRoom = row[x+1];
            const neRoom = prevRow[x+1];

            color();

            // NW tile
            if (x === minX) {
                const wRoom = row[x-1];
                const nwRoom = prevRow[x-1];
                wc("+" +
                   (nwRoom ? "1" : "") +
                   (nRoom ? "2" : "") +
                   (wRoom ? "3" : "") +
                   (room ? "4" : "") +
                   ((nwRoom && nwRoom.e && nRoom && nRoom.w) ? "n" : "") +
                   ((nRoom && nRoom.s && room && room.n) ? "e" : "") +
                   ((room && room.w && wRoom && wRoom.e) ? "s" : "") +
                   ((wRoom && wRoom.n && nwRoom && nwRoom.s) ? "w" : ""));
                if (++scX >= termSize.w)
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
            if (++scX >= termSize.w)
                break;

            // If this is where the character is, the NE tile indicates extra state
            if (y !== curY || x !== curX || !extraState(room)) {
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
            if (++scX >= termSize.w)
                break;
        }
        cln();
        wr("\n");
        if (++scY >= endY)
            break;
        scX = 0;

        // Now the row of rooms itself
        for (let x: number = minX;; x++) {
            const room = row[x];
            const eRoom = row[x+1];

            if (x === minX) {
                const wRoom = row[x-1];
                color();
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
                if (++scX >= termSize.w)
                    break;
            }

            if (y === curY && x === curX) {
                color(1);
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
                color();

            } else if (extraState(room)) {
                // Just fix the color back after the extra state
                color();

            } else if (room) {
                wc("_");

            } else {
                wc(".");

            }
            if (++scX >= termSize.w)
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
            if (++scX >= termSize.w)
                break;
        }
        cln();
        wr("\n");
        if (++scY >= endY)
            break;

        prevRow = row;
    }

    for (; scY < termSize.h - 5; scY++) {
        cln();
        wr("\n");
    }

    return curRoom;
}

// Draw the map part of the screen, small mode
function drawScreenSmall() {
    const curRow: Row = floor[curY] || {min: 0, max: 0};
    const curRoom: Room = curRow[curX] || {};

    // Figure out our display ranges
    let maxH = termSize.h-4;
    if (maxH < 8) maxH = 8;
    let maxW = termSize.w-1;
    if (maxW < 8) maxW = 8;
    let minY, maxY, minX, maxX;
    {
        let hh = ~~(maxH/2);
        minY = curY - hh;
        maxY = curY + hh - 1;
    }
    {
        let hw = ~~(maxW/2);
        minX = curX - hw;
        maxX = curX + hw - 1;
    }

    // Draw the floor indicator
    cursor(false);
    reset();
    color();
    cln();
    wr(`Floor ${curZ} `);
    // FIXME: duplication
    color(1);
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
        color(62, 2);
    } else {
        color(2);
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
    color(4);
    wr(` (${curX}, ${-curY})\n`);
    color();

    for (let y = minY; y <= maxY; y++) {
        let row: Row = floor[y] || {min: 0, max: 0};

        for (let x: number = minX; x <= maxX; x++) {
            let room: Room = row[x] || {};

            let ind =
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
                                row[x] ? "\u25a1" : " "
                            )
                        )
                    )
                );

            // Select the colors based on what's here
            let bg = 0;
            if (y === curY && x === curX)
                bg += 1;
            if (room.a || room.u || room.d)
                bg += 2;
            color(67, bg);
            wr(ind);
        }
        cln();
        wr("\n");
    }

    return curRoom;
}

// Edit a note
function editNote() {
    let note = "";
    let row: Row = floor[curY] || {min: 0, max: 0};
    let room: Room = row[curX] || {};

    wr("\r");
    cln();
    wr("Note: ");
    cursor(true);

    function input(data: string) {
        if (data === "\n" || data === "\r") {
            // End of line
            if (note === "")
                delete room.a;
            else
                room.a = note;
            save();
            clear();
            main("");
        } else if (data === "\x7f") {
            // backspace
            note = note.slice(0, note.length - 1);
            wr("\rNote: " + note);
            cln();
            rd(input);
        } else if (data === "\x03") {
            // ctrl+C
            process.exit(0);
        } else {
            wr(data);
            note += data;
            rd(input);
        }
    }
    rd(input);
}

// Help screen
function help() {
    cursor(false);
    clear();
    reset();
    color();
    wr(
`Help:
space: Toggle between explore and dig modes
x: Enter explore+dig mode
t: Enter read mode
g: Enter paint mode
e: Edit note
v: Switch between view sizes
z: Delete room
q: Quit

Movement: wasd, r = up, f = down
Explore: Move directionally
Explore+dig: Move directionally, create new
             rooms
Dig: Creates or removes exits in specified
     direction
Read: Move in absolute directions
Paint: Move in absolute directions, painting
       rooms

Shift+wasdrf: Always digs\n`);
    cursor(true);
    rd(() => main(""));
}

clear();
main("");
