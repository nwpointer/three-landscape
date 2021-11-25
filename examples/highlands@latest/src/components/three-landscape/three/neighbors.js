
import { Matrix3 } from "three";

export function findMSB(n) {
    if (n === 0) return 0
    let msb = 0;

    while (n > 1) {
        ++msb;
        n = n >> 1;
    }

    return msb;
}

export function computeVertices(k) {
    let root = new Matrix3().set(
        2, 0, 2,
        0, 0, 2,
        0, 0, 0
    )
    root = root.multiplyMatrices(lebMatrix(k), root)
    return root.transpose().toArray()
}


export let G = [
    n => [
        2 * n[3] + 1,
        2 * n[2] + 1,
        2 * n[1] + 1,
        2 * n[3]
    ],
    n => [
        2 * n[2],
        2 * n[3],
        2 * n[0],
        2 * n[3] + 1
    ]
]

let M = [
    new Matrix3().set(0, 1, 0, 0.5, 0, 0.5, 0, 0, 1),
    new Matrix3().set(1, 0, 0, 0.5, 0, 0.5, 0, 1, 0),

]

export function path(k) {
    let length = findMSB(k);
    return k.toString(2).slice(-length)
}

export function lebMatrix(k) {
    const m = new Matrix3().identity();
    if (k == 1) return m;
    for (let b of path(k)) {
        m.multiplyMatrices(M[b], m)
    }
    return m
}

export function sibling(k) {
    return k ^ 1
}

export const EDGE = 2;

export function neighbors(k) {
    let n = [0, 0, 0, 1];
    for (let b of path(k)) {
        n = G[b](n);
    }
    return n;
}
