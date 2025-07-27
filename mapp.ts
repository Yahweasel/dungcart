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

// Our map is floors full of rows full of rooms
export type Room = Record<string, number> & {
    // These are stored as numbers to make the JSON smaller
    n?: number;
    s?: number;
    e?: number;
    w?: number;
    ne?: number;
    se?: number;
    sw?: number;
    nw?: number;
    u?: number;
    d?: number;
    t?: number; // Indicates that down is a trap
    a?: string; // Note
    c?: number; // Color
    foot?: number; // Only used temporarily by the printable mapper
};

// Information on how a floor loops
export type Loop = {
    // Each is the loop point (last index before looping) in that direction
    n?: number;
    s?: number;
    e?: number;
    w?: number;
}

export type Row = Record<number, Room> & {min: number, max: number};
export type Floor = Record<number, Row> & {min: number, max: number, loop?: Loop};
export type Mapp = Record<number, Floor>;
