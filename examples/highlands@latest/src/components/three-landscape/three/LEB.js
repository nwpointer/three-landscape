
// import { Matrix3 } from "three";
const { Matrix3 } = require('three');

const EDGE = 2;

// module.exports = { neighbors, findMSB, EDGE, computeVertices }

export {
    neighbors, findMSB, EDGE, computeVertices, computeVerticesSquare, neighborsSquare, squareMatrix, lebMatrixSquare, depth, xySquare, pointFormat
}

function findMSB(n) {
    if (n === 0) return 0
    let msb = 0;

    while (n > 1) {
        ++msb;
        n = n >> 1;
    }

    return msb;
}

function computeVertices(k) {
    let root = new Matrix3().set(
        2, 0, 2,
        0, 0, 2,
        0, 0, 0
    )
    root = root.multiplyMatrices(lebMatrix(k), root)
    return root.transpose().toArray()
}

function computeVerticesSquare(k) {
    // let root = new Matrix3().set(
    //     2, 0, 0,
    //     0, 2, 0,
    //     0, 0, 2
    // )
    // root = root.multiplyMatrices(root, lebMatrixSquare(k))
    // return root.transpose().toArray()

    return lebMatrixSquare(k).transpose().toArray()
}

function path(k) {
    // if (k == 0) return "";
    let length = findMSB(k);
    return k.toString(2)
}

function lebMatrix(k) {
    const m = new Matrix3().identity();
    if (k == 1) return m;
    const p = path(k)
    for (let b of p) {
        m.multiplyMatrices(M[b], m)
    }
    const w = depth(p) & 1;
    winding(m, w)
    return m
}

// tested with k = 0, 1, 2, 3, 4, 5, 6.
function lebMatrixSquare(k) {
    let p = path(k)
    let m = squareMatrix(p)

    for (let b of p.slice(2)) {
        m.multiplyMatrices(M[b], m)
    }
    const w = (depth(p) & 1) ^ 1;
    winding(m, w)
    return m
}

function dotProduct(x, y) {
    let dp = 0.0;

    for (var i = 0; i < x.length; ++i)
        dp += x[i] * y[i];

    return dp;
}

function row(m, i) {
    return [m[0 + i * 3], m[1 + i * 3], m[2 + i * 3]]
}


function pointFormat(m) {
    return [
        m[0], 0, m[3],
        m[1], 0, m[4],
        m[2], 0, m[5],
    ]
}

function xySquare(k) {
    const m = lebMatrixSquare(k).transpose().toArray();

    const attributeVector = [
        [0, 0, 2],
        [2, 0, 0],
    ]

    const xy = []
    for (var i = 0; i < attributeVector.length; i++) {
        xy.push(dotProduct(row(m, 0), attributeVector[i]))
        xy.push(dotProduct(row(m, 1), attributeVector[i]))
        xy.push(dotProduct(row(m, 2), attributeVector[i]))
    }
    return xy;
}

function squareMatrix(path) {
    // console.log(path.length, path[1])
    const bit = parseInt(path[1] || path[0] || 0)
    const b = bit
    const c = 1 - bit;

    return new Matrix3().set(
        c, 0, b,
        b, c, b,
        b, 0, c
    );
}

function depth(path) {
    // if (path === "0") return 0;
    // if (path === "1") return 0;
    // console.log({ path });
    return path.length - 1;
}

// todo winding matrix?
function winding(matrix, bit) {
    // note this is reversed in original
    // probably due to the way the matrix is constructed try row major instead
    // console.log(bit);

    const b = bit
    const c = 1 - bit;

    // const wind = new Matrix3().set(
    //     bit, bit, bit,
    //     bit, bit, bit,
    //     bit, bit, bit,
    // )

    const wind = new Matrix3().set(
        c, 0.0, b,
        0, 1.0, 0,
        b, 0.0, c
    )

    matrix.multiplyMatrices(wind, matrix)
}

function sibling(k) {
    return k ^ 1
}


function neighborsSquare(k) {
    const p = path(k);
    const bitID = depth(p) > 0 ? depth(p) - 1 : 0;
    const bit = parseInt(p[depth(p) - bitID]);
    let n = [0, 0, 3 - bit, 2 + bit];

    for (let b of p.slice(2)) {
        // console.log(b);
        n = leb__SplitNodeIDs(n, b)
    }
    return n;
}


function leb__SplitNodeIDs(nodeIDs, splitBit) {
    const [n1, n2, n3, n4] = nodeIDs;

    const b2 = (n2 == 0) ? 0 : 1;
    const b3 = (n3 == 0) ? 0 : 1;

    if (splitBit == 0) {
        return ([n4 << 1 | 1, n3 << 1 | b3, n2 << 1 | b2, n4 << 1]);
    }
    else {
        return ([n3 << 1, n4 << 1, n1 << 1, n4 << 1 | 1]);
    }
}

function neighbors(k) {
    let n = [0, 0, 0, 1];
    for (let b of path(k)) {
        n = G[b](n);
    }
    return n;
}

let G = [
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
    new Matrix3().set(
        1, 0, 0,
        0.5, 0, 0.5,
        0, 1, 0
    ),
    new Matrix3().set(
        0, 1, 0,
        0.5, 0, 0.5,
        0, 0, 1
    ),

]

