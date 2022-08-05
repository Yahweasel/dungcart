#!/usr/bin/env node
const fs = require("fs");

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
    console.error("Use: mapper.js <map file>");
    process.exit(1);
}

// Our map is floors full of rows full of rooms
type Room = Record<string, boolean> & {
    n?: boolean;
    s?: boolean;
    e?: boolean;
    w?: boolean;
    u?: boolean;
    d?: boolean;
    t?: boolean; // Indicates that down is a trap
    a?: string; // Note
};

type Row = Record<number, Room> & {min: number, max: number};
type Floor = Record<number, Row> & {min: number, max: number};
type Mapp = Record<number, Floor>;

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

// Input our map file
let mapFile = process.argv[2];
let map: Mapp = {};

try {
    map = JSON.parse(fs.readFileSync(mapFile, "utf8"));
} catch (ex) {}

let curZ = 1, curY = 0, curX = 0, curMode = "x", explDig = false, curDir = n;
let floor = map[curZ];

// Save the current map
function save() {
    fs.writeFileSync(mapFile, JSON.stringify(map));
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
        if (dir === u) nextRoom.d = true;
        else if (dir === d) {} // maybe pitfall
        else {
            room[dir.k] = true;
            nextRoom[rotate(dir, 2).k] = true;
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
                room.t = true;
        } else
            room.d = true;
    } else {
        if (room[dir.k])
            delete room[dir.k];
        else
            room[dir.k] = true;
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
            room[dir.k] = true;
            nRoom[rdir.k] = true;
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
    const curRoom = drawScreen();

    // And the current mode
    cln();
    switch (curMode) {
        case "x": wr("Exploring" + (explDig ? " + digging" : "") + "\n"); break;
        case "d": wr("Digging\n"); break;
        case "r": wr("Reading\n"); break;
        case "p": wr("Painting\n"); break;
        default: wr("???\n"); break;
    }

    // Our current facing if applicable
    cln();
    if (curMode === "x" || curMode === "d")
        wr("Facing " + curDir.k);
    wr("\n");

    // And request input
    clr();
    wr("> ");
    cursor(true);

    rd(main);
}

// Draw the map part of the screen
function drawScreen() {
    let curRoom: Room = {};

    // Figure out our display ranges
    let maxH = ~~((termSize.h-7)/2);
    if (maxH < 8) maxH = 8;
    let maxW = ~~(termSize.w/2-2);
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

    // Draw the floor as-is
    cursor(false);
    reset();
    color();
    cln();
    wr(`Floor ${curZ} `);
    color(4);
    wr(`(${curX}, ${-curY})\n`);
    let prevRow: Row = {min: 0, max: 0};
    for (let y = minY; y <= maxY; y++) {
        let row: Row = floor[y] || {min: 0, max: 0};

        // North paths first
        for (let x: number = minX; x <= maxX; x++) {
            let room: Room = row[x] || {};
            let nRoom: Room = prevRow[x] || {};
            let eRoom: Room = row[x+1] || {};
            let neRoom: Room = prevRow[x+1] || {};

            color(7);

            // NW tile
            if (x === minX) {
                let wRoom = row[x-1] || {};
                let nwRoom = prevRow[x-1] || {};
                if (room.n && nRoom.s &&
                    room.w && wRoom.e &&
                    nRoom.w && nwRoom.e) {
                    wr(fullBlock);
                } else {
                    wr(" ");
                }
            }

            // N tile
            if (room.n) {
                wr(nRoom.s ? fullBlock : upTriangle);
            } else if (nRoom.s) {
                wr(downTriangle);
            } else {
                wr(" ");
            }

            // NE tile indicates extra state
            if (room.a && (room.u || room.d)) {
                // Show the note with color instead of text
                color(62, 2);
            } else if (room.n && nRoom.s &&
                room.e && eRoom.w &&
                nRoom.e && neRoom.w &&
                eRoom.n && neRoom.s) {
                color(2, 7);
            } else {
                color(62, 0);
            }
            if (room.u) {
                if (room.d)
                    wr("\u2195" /* ^v */);
                else
                    wr("\u2191" /* ^ */);
            } else if (room.d) {
                if (room.t)
                    wr("\u2913" /* v trap */);
                else
                    wr("\u2193" /* v */);
            } else if (room.a) {
                wr("\u25a4" /* note */);
            } else {
                wr(" ");
            }
        }
        cln();
        wr("\n");

        // Now the row of rooms itself
        for (let x: number = minX; x <= maxX; x++) {
            let room: Room = row[x] || {};
            let eRoom: Room = row[x+1] || {};

            if (x === minX) {
                let wRoom: Room = row[x-1] || {};
                color(7);
                if (room.w) {
                    wr(wRoom.e ? fullBlock : leftTriangle);
                } else if (wRoom.e) {
                    wr(rightTriangle);
                } else {
                    wr(" ");
                }
            }

            color(1, row[x] ? 67 : 0);
            if (y === curY && x === curX) {
                // This is our current room, so indicate it
                curRoom = room;
                if (curMode === "r" || curMode === "p")
                    wr("\u25cf" /* @ */);
                else switch (curDir.k) {
                    case "n": wr("\u25b4" /* ^ */); break;
                    case "e": wr("\u25b8" /* > */); break;
                    case "s": wr("\u25be" /* v */); break;
                    case "w": wr("\u25c2" /* < */); break;
                    default:  wr("\u25cf" /* @ */);
                }

            } else {
                wr(" ");

            }

            color(7);
            if (room.e) {
                wr(eRoom.w ? fullBlock : rightTriangle);
            } else if (eRoom.w) {
                wr(leftTriangle);
            } else {
                wr(" ");
            }
        }
        cln();
        wr("\n");

        if (y === maxY) {
            // We need to draw any southern exits
            color(7);
            wr(" ");
            for (let x = minX; x <= maxX; x++) {
                let room = row[x] || {};
                if (room.s)
                    wr(downTriangle);
                else
                    wr(" ");
                wr(" ");
            }
            cln();
            wr("\n");
        }

        prevRow = row;
    }

    // Write anything about the current room
    cln();
    color();
    if (curRoom.a)
        wr("Note: " + curRoom.a);
    wr("\n");

    return curRoom;
}

// Edit a note
function editNote() {
    let note = "";
    let row: Row = floor[curY] || {min: 0, max: 0};
    let room: Room = row[curX] || {};

    wr("\nNote: ");
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
