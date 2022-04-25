#!/usr/bin/env node
const fs = require("fs");

const n = {k: "n", x: 0, y: -1, z: 0},
      s = {k: "s", x: 0, y: 1, z: 0},
      w = {k: "w", x: -1, y: 0, z: 0},
      e = {k: "e", x: 1, y: 0, z: 0},
      u = {k: "u", x: 0, y: 0, z: -1},
      d = {k: "d", x: 0, y: 0, z: 1};

if (process.argv.length < 3) {
    console.error("Use: mapper.js <map file>");
    process.exit(1);
}

// We want raw input
var stdin = process.stdin;
stdin.setRawMode(true);
stdin.resume();
stdin.setEncoding("utf8");

var stdinBuffer = [];
var stdinThen = null;

function stdinHandler(data) {
    for (var di = 0; di < data.length; di++) {
        stdinBuffer.push(data[di]);
        if (stdinThen) {
            var then = stdinThen;
            stdinThen = null;
            then(stdinBuffer.shift());
        }
    }
}
stdin.on("data", stdinHandler);

function rd(then) {
    if (stdinBuffer.length) {
        then(stdinBuffer.shift());
    } else {
        if (stdinThen)
            throw new Error();
        stdinThen = then;
    }
}

function wr(text) {
    process.stdout.write(text);
}

// Input our map file
var mapFile = process.argv[2];
var map = {};

try {
    map = JSON.parse(fs.readFileSync(mapFile, "utf8"));
} catch (ex) {}

// Save the current map
function save() {
    fs.writeFileSync(mapFile, JSON.stringify(map));
}

var curZ = 1, curY = 0, curX = 0, curMode = "x", curDir = n;

// Create a new floor from scratch
function newFloor(startY, startX) {
    var floor = {
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
function move(dir, dig) {
    var ret = false;
    var nextZ = curZ + dir.z;
    var nextY = curY + dir.y;
    var nextX = curX + dir.x;

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
    var nextRow = floor[nextY];

    if (!nextRow[nextX]) {
        if (!dig) return false;
        var nextRoom = nextRow[nextX] = {};
        if (nextX < nextRow.min) nextRow.min = nextX;
        if (nextX > nextRow.max) nextRow.max = nextX;
        ret = true;

        // Set its opposite exit
        if (dir === u) nextRoom.d = 1;
        else if (dir === d) {} // maybe pitfall
        else nextRoom[rotate(dir, 2).k] = 1;
    }

    return ret;
}

// Toggle an exit in this direction
function toggleExit(dir) {
    var row = floor[curY] || {};
    var room = row[curX] || {};
    if (dir === d) {
        if (room.d) {
            if (room.l) {
                delete room.l;
                delete room.d;
            } else
                room.l = 1;
        } else
            room.d = 1;
    } else {
        if (room[dir.k])
            delete room[dir.k];
        else
            room[dir.k] = 1;
    }
}

if (!map[curZ]) {
    // Need at least a starting floor!
    map[curZ] = newFloor(0, 0);
    map[curZ][curY][curX].u = 1;
    curMode = "d";
}

var floor = map[curZ];
var minX, maxX;

// Calculate the X range for the current floor
function calcXRange() {
    minX = maxX = 0;
    for (var y = floor.min; y <= floor.max; y++) {
        if (!floor[y]) continue;
        if (floor[y].min < minX) minX = floor[y].min;
        if (floor[y].max > maxX) maxX = floor[y].max;
    }
    if (curX < minX) minX = curX;
    if (curX > maxX) maxX = curX;
}
calcXRange();

// Rotations of directions
function rotate(dir, by) {
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
function color(fg, bg) {
    if (typeof fg === "undefined") fg = 67;
    if (typeof bg === "undefined") bg = 0;
    fg += 30;
    bg += 40;
    wr("\x1b[m\x1b[" + bg + "m\x1b[" + fg + "m");
}

// Size of the terminal
var termSize = {w: 80, h: 25};
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
function cursor(on) {
    wr("\x1b[?25" + (on?"h":"l"));
}

// Our main input function
function main(data) {
    var curRoom = {};

    if (data === "\x03" || data === "q") {
        // ctrl+C or quit
        wr("\n");
        process.exit(0);
    }

    // Perform the requested action
    switch (curMode) {
        case "d":
            switch (data) {
                case "w": toggleExit(curDir); save(); break;
                case "a": toggleExit(rotate(curDir, -1)); save(); break;
                case "s": toggleExit(rotate(curDir, 2)); save(); break;
                case "d": toggleExit(rotate(curDir, 1)); save(); break;
                case "r": toggleExit(u); save(); break;
                case "f": toggleExit(d); save(); break;
                case "z": delete floor[curY][curX]; curMode = "x"; save(); break;
                case " ": curMode = "x"; break;
            }
            break;

        case "x":
            switch (data) {
                case "w": if (move(curDir, true)) curMode = "d"; save(); break;
                case "a": curDir = rotate(curDir, -1); break;
                case "s": curDir = rotate(curDir, 2); break;
                case "d": curDir = rotate(curDir, 1); break;
                case "r": if (move(u, true)) curMode = "d"; clear(); save(); break;
                case "f": if (move(d, true)) curMode = "d"; clear(); save(); break;
                case "z": delete floor[curY][curX]; save(); break;
                case " ": curMode = "d"; break;
                case "t": curMode = "r"; break;

                case "e":
                    // Edit the note
                    (function() {
                        var note = "";
                        var row = floor[curY] || {};
                        var room = row[curX] || {};

                        wr("\nNote: ");
                        cursor(true);

                        function input(data) {
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
                    })();
                    return;
            }
            break;

        case "r":
            switch (data) {
                case "w": move(n, false); break;
                case "a": move(w, false); break;
                case "s": move(s, false); break;
                case "d": move(e, false); break;
                case "r": move(u, false); clear(); break;
                case "f": move(d, false); clear(); break;
                case " ": curMode = "x"; break;
            }
            break;

        default: curMode = "x";
    }

    // Figure out our display ranges
    var maxH = ~~((termSize.h-7)/2);
    if (maxH < 8) maxH = 8;
    var maxW = ~~(termSize.w/2-2);
    if (maxW < 8) maxW = 8;
    var minY = floor.min;
    var maxY = floor.max;
    if (curY < minY) minY = curY;
    if (curY > maxY) maxY = curY;
    if (maxY - minY > maxH) {
        // Too tall!
        var hh = ~~(maxH/2);
        minY = curY - hh;
        maxY = curY + hh - 1;
    }
    calcXRange();
    if (maxX - minX > maxW) {
        var hw = ~~(maxW/2);
        minX = curX - hw;
        maxX = curX + hw - 1;
    }

    // Draw the floor as-is
    cursor(false);
    reset();
    cln();
    wr("Floor " + curZ + "\n");
    var prevRow = {};
    for (var y = minY; y <= maxY; y++) {
        var row = floor[y] || {};

        // Any north paths first
        wr(" ");
        for (var x = minX; x <= maxX; x++) {
            var prevRoom = prevRow[x] || {};
            var room = row[x] || {};
            if (room.n) {
                if (prevRoom.s)
                    wr("|");
                else
                    wr("^");
            } else if (prevRoom.s)
                wr("v");
            else
                wr(" ");

            if (room.a) {
                if (room.u || room.d)
                    wr("!");
                else
                    wr("*");
            } else if (room.u) {
                if (room.d)
                    wr("L");
                else
                    wr("U");
            } else if (room.d) {
                if (room.l)
                    wr("D");
                else
                    wr("d");
            } else
                wr(" ");
        }
        cln();
        wr("\n");

        // Now the row of rooms itself
        var prevRoom = {};
        for (var x = minX; x <= maxX; x++) {
            var room = row[x] || {};
            if (room.w) {
                if (prevRoom.e)
                    wr("-");
                else
                    wr("<");
            } else if (prevRoom.e)
                wr(">");
            else
                wr(" ");
            if (y == curY && x == curX) {
                curRoom = room;
                color(1);
                if (curMode === "r")
                    wr("@");
                else switch (curDir.k) {
                    case "n": wr("^"); break;
                    case "e": wr(">"); break;
                    case "s": wr("v"); break;
                    case "w": wr("<"); break;
                    default:  wr("@");
                }
                color();
            } else if (row[x])
                wr(".");
            else
                wr(" ");
            prevRoom = room;
        }
        if (prevRoom.e)
            wr(">");
        else
            wr(" ");
        cln();
        wr("\n");

        if (y === maxY) {
            // We need to draw any southern exits
            wr(" ");
            for (var x = minX; x <= maxX; x++) {
                var room = row[x] || {};
                if (room.s)
                    wr("v ");
                else
                    wr("  ");
            }
            cln();
            wr("\n");
        }

        prevRow = row;
    }

    // Write anything about the current room
    cln();
    if (curRoom.a)
        wr("Note: " + curRoom.a);
    wr("\n");

    // And the current mode
    cln();
    switch (curMode) {
        case "x": wr("Exploring\n"); break;
        case "d": wr("Digging\n"); break;
        case "r": wr("Reading\n"); break;
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

clear();
main("");
