// We want raw input
const stdin = process.stdin;
stdin.setRawMode(true);
stdin.resume();
stdin.setEncoding("utf8");

// Size of the terminal
export const termSize = {w: 80, h: 25};
function onResize() {
    termSize.w = process.stdout.columns;
    termSize.h = process.stdout.rows;
}
if (process.stdout.isTTY) {
    process.stdout.on("resize", onResize);
    onResize();
}

// Handle stdin through a buffer
const stdinBuffer: string[] = [];
let stdinThen: (value: unknown)=>unknown = null;

/**
 * Handler for a single "packet" of stdin data
 */
function stdinHandler(data: string) {
    for (let di = 0; di < data.length; di++)
        stdinBuffer.push(data[di]);
    if (stdinThen) {
        const then = stdinThen;
        stdinThen = null;
        then(null);
    }
}
stdin.on("data", stdinHandler);

// Read a character from stdin
export async function rd() {
    while (!stdinBuffer.length)
        await new Promise(res => stdinThen = res);
    return stdinBuffer.shift();
}

// Write to stdout
export function wr(text: string) {
    process.stdout.write(text);
}

// Set the color
export function color(fg = 67, bg = 0) {
    fg += 30;
    bg += 40;
    wr("\x1b[m\x1b[" + bg + "m\x1b[" + fg + "m");
}

// Reset our screen position
export function reset() {
    color();
    wr("\x1b[H");
}

// Clear the screen
export function clear() {
    wr("\x1b[2J");
}

// Clear the REST of the screen
export function clr() {
    wr("\x1b[J");
}

// Clear the line
export function cln() {
    wr("\x1b[K");
}

// Show or hide the cursor
export function cursor(on: boolean) {
    wr("\x1b[?25" + (on?"h":"l"));
}
