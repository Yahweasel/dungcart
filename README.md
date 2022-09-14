# Dung Cart

Dung Cart (short for Dungeon Cartographer) is an interactive mapping tool for
use in those awful pseudo-3D dungeon crawling games like the Wizardry series,
The Bard's Tale, Phantasy Star 1, etc. Like a real dung cart, its goal is to be
a tool that makes a shitty situation just a bit less shitty.

Run Dung Cart as `dung-cart <map file> [charset]`. The charset argument is
optional. If running out of the source directory, run it as `./mapper.js`. The
map file will be created if it doesn't already exist.

Dung cart has two main operating modes: *digging* an *exploring*. In either
mode, move with WASD. In digging mode, while moving, if a cell doesn't exist,
it will be created, and connected to the previous cell; the intention of this
mode is to be used when you're first exploring a dungeon and want to define it.
In exploring mode, you move without digging new cells. Shift-clicking WASD
defines or undefines an exit from the current cell in the given direction. When
first exploring, you should probably define exits for any cell that has
multiple exits, to remind yourself to go back and explore the rest.

Cells can be given notes by pressing 'e'. Other tools are available; press 'h'
to see all actions.

In addition, a “reading” mode is available by pressing 't', which is similar to
exploring but with absolute directions (i.e., 'w' is always north), and a
“painting” mode is available by pressing 'g', which is useful for filling in
large chambers that are otherwise rather burdensome to fill.


## Printable maps

Dung Cart is principally an interactive tool, but its maps can also be
transcribed into printable text files, using `dung-cart-printable <map file>`
(`./printable.js` in the source directory).


## Character sets

The main character set uses box drawing characters available on most terminals.
If your terminal is more limited, or you'd just like to make the map look a bit
different, other character sets are available: `ascii`, `ascii-plus`, and
`blocks`.
