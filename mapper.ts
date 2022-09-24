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

import * as io from "./io";
const { wr } = io;
import * as state from "./state";

import type {Room, Row, Floor, Mapp} from "./mapp";

if (process.argv.length < 3) {
    console.error("Use: mapper.js <map file> [character set]");
    process.exit(1);
}

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

// Character set
const charSet: Record<string, string> = JSON.parse(
    fs.readFileSync(charSetFile, "utf8")
);

// Flags are just in the session, not in the map (for remembering things)
const flags: Record<number, string> = {};
const flagsByLoc: Record<string, number> = {};

// Write from the character set to stdout
function wc(def: string) {
    io.wr(charSet[def]);
}

// The main interface
async function main() {
    io.clear();
    io.cursor(false);

    while (true) {
        // Validate the location
        state.validateLocation();

        // Draw the screen
        const curRoom = state.smallMode ? drawScreenSmall() : drawScreen();

        // Write anything about the current room
        io.cln();
        io.color();
        if (curRoom.a)
            wr("Note: " + curRoom.a);
        wr("\n");

        // And the current mode
        io.cln();
        switch (state.curMode) {
            case "x":
                wr((state.explDig ? "Digging" : "Exploring") + "\n");
                break;
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
                switch (state.curMode + data) {
                    // exploring
                    case "xw":
                        state.move(state.curDir, state.explDig);
                        if (state.explDig)
                            state.save();
                        break;

                    case "xa":
                        state.rotateCur(-1);
                        break;

                    case "xs":
                        state.rotateCur(2);
                        break;

                    case "xd":
                        state.rotateCur(1);
                        break;

                    case "xr":
                        state.move(state.u, state.explDig);
                        io.clear();
                        if (state.explDig)
                            state.save();
                        break;

                    case "xf":
                        state.move(state.d, state.explDig);
                        io.clear();
                        if (state.explDig)
                            state.save();
                        break;

                    // painting
                    case "pw": state.movePaint(state.n); break;
                    case "pa": state.movePaint(state.w); break;
                    case "ps": state.movePaint(state.s); break;
                    case "pd": state.movePaint(state.e); break;
                    case "pr": state.movePaint(state.u); io.clear(); break;
                    case "pf": state.movePaint(state.d); io.clear(); break;

                    // reading
                    case "rw": state.move(state.n, false); break;
                    case "ra": state.move(state.w, false); break;
                    case "rs": state.move(state.s, false); break;
                    case "rd": state.move(state.e, false); break;
                    case "rr": state.move(state.u, false); io.clear(); break;
                    case "rf": state.move(state.d, false); io.clear(); break;
                }
                break;

            // Exit digging
            case "W":
                state.toggleExit(state.curDir);
                state.save();
                break;

            case "A":
                state.toggleExit(state.rotate(state.curDir, -1));
                state.save();
                break;

            case "S":
                state.toggleExit(state.rotate(state.curDir, 2));
                state.save();
                break;

            case "D":
                state.toggleExit(state.rotate(state.curDir, 1));
                state.save();
                break;

            case "R":
                state.toggleExit(state.u);
                state.save();
                break;

            case "F":
                state.toggleExit(state.d);
                state.save();
                break;

            case "z": // delete
                delete state.floor[state.curY][state.curX];
                if (state.curMode === "p") {
                    state.paint();
                }
                state.validate();
                state.save();
                break;

            case "e": // edit note
                await editNote();
                break;

            case "v": // small mode
                state.setSmallMode(!state.smallMode);
                break;

            case "t": // read mode
                state.setCurMode((state.curMode === "r") ? "x" : "r");
                break;

            case "g": // paint mode
                state.setCurMode((state.curMode === "p") ? "x" : "p");
                break;

            case " ": // Explore mode
                if (state.curMode === "x") {
                    state.setExplDig(!state.explDig);
                } else {
                    state.setCurMode("x");
                    state.setExplDig(false);
                }
                break;

            case "x": // Dig mode
                if (state.curMode === "x") {
                    state.setExplDig(!state.explDig);
                } else {
                    state.setCurMode("x");
                    state.setExplDig(true);
                }
                break;

            case "1":
            case "2":
            case "3":
            case "4":
            {
                // Flags
                const flag = data.charCodeAt(0) - ("0").charCodeAt(0);
                const loc = `${state.curZ},${state.curY},${state.curX}`;
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

            case "u": // Undo
                state.undo();
                break;

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
        const loc = `${state.curZ},${y},${x}`;
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
    let minY = state.curY - Math.floor((io.termSize.h-4)/4);
    let minX = state.curX - Math.floor(io.termSize.w/4);
    const endY = io.termSize.h - 3;

    // Draw the floor
    const loop = state.floor.loop || {};
    io.reset();
    io.cln();
    wr(`Floor ${state.curZ} `);
    io.color(4);
    wr(`(${state.curX}, ${-state.curY})\n`);
    let scY = 1;
    let prevRow: Row = state.floor[minY-1] ||
        state.floor[state.loopY(minY-1)] || {min: 0, max: 0};
    for (let ay = minY;; ay++) {
        const y = state.loopY(ay);
        const row: Row = state.floor[ay] || state.floor[y] ||
            {min: 0, max: 0};
        let scX = 0;

        // North paths first
        for (let ax: number = minX;; ax++) {
            const x = state.loopX(ax);
            const room = row[ax] || row[x];
            const nRoom = prevRow[ax] || prevRow[x];
            const eRoom = row[ax+1] || row[state.loopX(ax+1)];
            const neRoom = prevRow[ax+1] || prevRow[state.loopX(ax+1)];

            if (ay === y && ax === x)
                io.color();
            else if (room && (row === state.floor[ay] && room === row[ax]))
                io.color(61);
            else
                io.color(60);

            // NW tile
            if (ax === minX) {
                const wRoom = row[ax-1] || row[state.loopX(ax-1)];
                const nwRoom = prevRow[ax-1] || prevRow[state.loopX(ax-1)];
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

            /* If this is where the character is, the NE tile indicates
             * extra state */
            if (ay !== state.curY || ax !== state.curX ||
                !extraState(room, y, x)) {
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
            const x = state.loopX(ax);
            const room = row[ax] || row[x];
            const eRoom = row[ax+1] || row[state.loopX(ax+1)];

            let fg = 60;
            if (ay === y && ax === x)
                fg = 67;
            else if (room && (row === state.floor[ay] && room === row[ax]))
                fg = 61;
            io.color(fg);

            if (ax === minX) {
                const wRoom = row[ax-1] || row[state.loopX(ax-1)];
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

            if (ay === state.curY && ax === state.curX) {
                io.color(1);
                // This is our current room, so indicate it
                curRoom = room || {};
                if (state.curMode === "r" || state.curMode === "p")
                    wc("@");
                else switch (state.curDir.k) {
                    case "n": wc("^"); break;
                    case "e": wc(">"); break;
                    case "s": wc("v"); break;
                    case "w": wc("<"); break;
                    default:  wc("@");
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
    const curRow: Row = state.floor[state.curY] || {min: 0, max: 0};
    const curRoom: Room = curRow[state.curX] || {};

    // Figure out our display ranges
    const maxH = io.termSize.h-4;
    let minY = state.curY - Math.floor(maxH/4)*2 - 1;
    let maxY = minY + maxH - 1;
    const maxW = io.termSize.w;
    let minX = state.curX - Math.floor(maxW/4)*2 - 1;
    let maxX = minX + maxW - 1;

    // Draw the floor indicator
    io.reset();
    io.color();
    io.cln();
    wr(`Floor ${state.curZ} `);
    // FIXME: duplication
    io.color(1);
    if (state.curMode === "r" || state.curMode === "p")
        wr("\u25cf" /* @ */);
    else switch (state.curDir.k) {
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
    wr(` (${state.curX}, ${-state.curY})\n`);
    io.color();

    for (let ay = minY; ay <= maxY; ay++) {
        const y = state.loopY(ay);
        const row: Row = state.floor[ay] || state.floor[y] ||
            {min: 0, max: 0};

        for (let ax: number = minX; ax <= maxX; ax++) {
            const x = state.loopX(ax);
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
            else if (room && (row === state.floor[ay] && room === row[ax]))
                fg = 61;
            let bg = 0;
            if (ay === state.curY && ax === state.curX)
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
    const row: Row = state.floor[state.curY] || {min: 0, max: 0};
    const room: Room = row[state.curX] || {};

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
            state.save();
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

    io.cursor(true);
    const data = await io.rd();
    io.cursor(false);
    switch (data) {
        case "w":
        case "W":
            state.moveFloorY(-1, (data === "W"));
            break;

        case "a":
        case "A":
            state.moveFloorX(-1, (data === "A"));
            break;

        case "s":
        case "S":
            state.moveFloorY(1, (data === "S"));
            break;

        case "d":
        case "D":
            state.moveFloorX(1, (data === "D"));
            break;
    }

    io.clear();
}

// The loop menu
async function loopMenu() {
    // Get the loop status for display
    const loopStatus: string[] = [];
    if (state.floor.loop) {
        for (const dir of ["s", "n"]) {
            const l = state.floor.loop[dir];
            if (typeof l === "number")
                loopStatus.push(dir.toUpperCase() + `: ${-l}`);
        }
        for (const dir of ["w", "e"]) {
            const l = state.floor.loop[dir];
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
z: Clear looping data for this floor.
q: Cancel.

Current loop status: ${loopStr || "non-looping"}
> `);

    function setLoop(dir: string) {
        const loop = state.floor.loop = state.floor.loop || {};
        loop[dir] = (dir === "n" || dir === "s") ? state.curY : state.curX;
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
        state.mergeLoop();
        state.validate();
        state.save();
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
            delete state.floor.loop;
            state.validate();
            state.save();
            break;
    }

    io.clear();
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
u: Undo
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

state.loadMap(process.argv[2]);
main();
