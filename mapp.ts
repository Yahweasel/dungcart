// Our map is floors full of rows full of rooms
export type Room = Record<string, number> & {
    // These are stored as numbers to make the JSON smaller
    n?: number;
    s?: number;
    e?: number;
    w?: number;
    u?: number;
    d?: number;
    t?: number; // Indicates that down is a trap
    a?: string; // Note
    foot?: number; // Only used temporarily by the printable mapper
};

export type Row = Record<number, Room> & {min: number, max: number};
export type Floor = Record<number, Row> & {min: number, max: number};
export type Mapp = Record<number, Floor>;
