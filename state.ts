/*
 * Copyright (C) 2022-2025 Yahweasel
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

import type {Room, Row, Floor, Mapp} from "./mapp";

interface Direction {
    k: string; // "key" (name) for the direction
    // Offsets
    x: number;
    y: number;
    z: number;
}

// Standard directions
export const
    n: Direction = {k: "n", x: 0, y: -1, z: 0},
    s: Direction = {k: "s", x: 0, y: 1, z: 0},
    w: Direction = {k: "w", x: -1, y: 0, z: 0},
    e: Direction = {k: "e", x: 1, y: 0, z: 0},
    ne: Direction = {k: "ne", x: 1, y: -1, z: 0},
    se: Direction = {k: "se", x: 1, y: 1, z: 0},
    sw: Direction = {k: "sw", x: -1, y: 1, z: 0},
    nw: Direction = {k: "nw", x: -1, y: -1, z: 0},
    u: Direction = {k: "u", x: 0, y: 0, z: -1},
    d: Direction = {k: "d", x: 0, y: 0, z: 1};

/**
 * Currently loaded map.
 */
export let map: Mapp = {};
export function setMap(to: Mapp) { map = to; }

/**
 * The undo buffer for the map.
 */
let undoBuffer: string[] = [];
let undoBufferSize = 0;

/**
 * Eight-direction mode.
 */
export let eight = false;
export function setEight(to: boolean) { eight = to; }

/**
 * Current location.
 */
export let curZ = 1, curY = 0, curX = 0, curDir = n;
export function setCurZ(to: number) { curZ = to; }
export function setCurY(to: number) { curY = to; }
export function setCurX(to: number) { curX = to; }
export function setCurDir(to: Direction) { curDir = to; }

/**
 * Current mode.
 */
export let curMode = "x", explDig = false;
export let curColor = 0;
export function setCurMode(to: string) { curMode = to; }
export function setExplDig(to: boolean) { explDig = to; }
export function setCurColor(to: number) { curColor = to; }

/**
 * Display in small mode?
 */
export let smallMode = false;
export function setSmallMode(to: boolean) { smallMode = to; }

/**
 * Current floor.
 */
export let floor: Floor;
export function setFloor(to: Floor) { floor = to; }

/**
 * Current map file.
 */
let mapFile: string | null = null;

/**
 * Load a map.
 */
export function loadMap(filename: string) {
    mapFile = filename;

    let mapStr = "{}";
    map = {};
    try {
        mapStr = fs.readFileSync(mapFile, "utf8");
        map = JSON.parse(mapStr);
    } catch (ex) { 0; }

    undoBuffer = [mapStr];
    undoBufferSize = mapStr.length;

    curZ = 1;
    curX = curY = 0;
    floor = map[curZ];
    if (!floor) {
        // Need at least a starting floor!
        floor = map[curZ] = newFloor(0, 0);
        explDig = true;
    }
}

/**
 * Save the current map, including to the undo buffer.
 */
export function save() {
    const mstr = JSON.stringify(map);
    fs.writeFileSync(mapFile!, mstr);
    undoBuffer.push(mstr);
    undoBufferSize += mstr.length;
    while (undoBuffer.length > 16 && undoBufferSize > 16777216) {
        const pop = undoBuffer.shift();
        undoBufferSize -= pop!.length;
    }
}

/**
 * Undo a change.
 */
export function undo() {
    if (undoBuffer.length <= 1)
        return false;
    const pop = undoBuffer.pop();
    undoBufferSize -= pop!.length;
    const load = undoBuffer.pop();

    // Load this map
    map = JSON.parse(load!);
    floor = map[curZ];
    if (!floor) {
        curZ = 1;
        floor = map[curZ];
    }
    if (!floor) {
        // No first floor???
        floor = map[curZ] = newFloor(0, 0);
        curY = 0;
        curX = 0;
    }

    save();
}

/**
 * Rotations of directions
 */
export function rotate(dir: Direction, by: number) {
    switch (by) {
        case 0:
            return dir;

        case 1:
        case -3:
            if (eight) {
                if (dir === n) return ne;
                if (dir === ne) return e;
                if (dir === e) return se;
                if (dir === se) return s;
                if (dir === s) return sw;
                if (dir === sw) return w;
                if (dir === w) return nw;
                if (dir === nw) return n;
            } else {
                if (dir === n) return e;
                if (dir === e) return s;
                if (dir === s) return w;
                if (dir === w) return n;
            }
            return n;

        case 2:
        case -2:
            if (dir === n) return s;
            if (dir === ne) return sw;
            if (dir === e) return w;
            if (dir === se) return nw;
            if (dir === s) return n;
            if (dir === sw) return ne;
            if (dir === w) return e;
            if (dir === nw) return se;
            return n;

        case 3:
        case -1:
            if (eight) {
                if (dir === n) return nw;
                if (dir === ne) return n;
                if (dir === e) return ne;
                if (dir === se) return e;
                if (dir === s) return se;
                if (dir === sw) return s;
                if (dir === w) return sw;
                if (dir === nw) return w;
            } else {
                if (dir === n) return w;
                if (dir === e) return n;
                if (dir === s) return e;
                if (dir === w) return s;
            }
            return n;
    }
    return n;
}

/**
 * Validate mins and maxes. Either all (with no options), or a given floor
 * (with one) or row (with two).
 */
export function validate(z?: number, y?: number) {
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

/**
 * Create a new floor from scratch, with a room at the given location.
 */
export function newFloor(startY: number, startX: number) {
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

/**
 * Move to another room, digging if asked.
 */
export function move(dir: Direction, dig = false) {
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

        // Set its color
        if (curColor)
            nextRoom.c = curColor;
    }

    return ret;
}

/**
 * Rotate our current direction.
 */
export function rotateCur(by: number) {
    curDir = rotate(curDir, by);
}

/**
 * Toggle an exit in this direction.
 */
export function toggleExit(dir: Direction) {
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

/**
 * "Paint" this room by connecting all exits to adjoining rooms.
 */
export function paint() {
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

/**
 * Move in the given direction, paint, and save.
 */
export function movePaint(dir: Direction) {
    move(dir, true);
    paint();
    save();
}

/**
 * Recolor the current room.
 */
export function recolor() {
    const curRow = floor[curY];
    if (!curRow) return;
    const curRoom = curRow[curX];
    if (!curRoom) return;
    if (curColor)
        curRoom.c = curColor;
    else
        delete curRoom.c;
    save();
}

/**
 * Validate the current location, with respect to looping.
 */
export function validateLocation() {
    if (curMode !== "r") {
        curY = loopY(curY);
        curX = loopX(curX);
    }
}

/**
 * Move a floor (or the entire map) by the given amount in X.
 */
export function moveFloorX(by: number, allFloors: boolean) {
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

        if (floor.loop)
            mergeLoop(+z);
    }
    validate();
    save();
}

/**
 * Move a floor (or the entire map) by the given amount in Y.
 */
export function moveFloorY(by: number, allFloors: boolean) {
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

        if (floor.loop)
            mergeLoop(+z);
    }
    validate();
    save();
}

/**
 * Get a Y location with looping in mind.
 */
export function loopY(y: number) {
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

/**
 * Get an X location with looping in mind
 */
export function loopX(x: number) {
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

/**
 * Move an entire room, presumably due to looping, merging it with the
 * target room to the degree that that's possible. Returns true if the move
 * was successful. The map must be *validated* and saved after this.
 */
export function moveRoom(
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
        map[toZ] = newFloor(toY, toX);
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

/**
 * Merge looping rooms on this floor.
 */
export function mergeLoop(z?: number) {
    if (typeof z === "undefined")
        z = curZ;
    const floor = map[z];
    if (!floor)
        return;

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
                moveRoom(curZ, fromY, x, curZ, toY, x);
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
                moveRoom(curZ, y, fromX, curZ, y, toX);
            }
        }
    }
}

