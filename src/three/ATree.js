import { Matrix3 } from "three";

const midpoint = ([x1, y1, z1], [x2, y2, z2]) => [(x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2];

const chunk = (arr, n = 3) => arr.reduce((all, one, i) => {
    const ch = Math.floor(i / n);
    all[ch] = [].concat((all[ch] || []), one);
    return all
}, [])

// longest edge subdivision
function LEB(v) {
    const [a, b, c] = chunk(v);
    const d = midpoint(a, c)

    return ([
        [...c, ...d, ...b],
        [...b, ...d, ...a]
    ])
}

// longest edge subdivision matrix
function mLEB(points) {
    const t = new Matrix3().set(...points)
    const m0 = new Matrix3().set(1, 0, 0, 0.5, 0, 0.5, 0, 1, 0)
    const m1 = new Matrix3().set(0, 1, 0, 0.5, 0, 0.5, 0, 0, 1)

    return [
        m1.multiply(t).transpose().toArray(),
        m0.multiply(t).transpose().toArray(),
    ]
}

// todo: find path to root from this?



// BTree is a special binary tree that enforces Conforming-Adaptive Tessellations
export class ATree {
    data = [];
    children = [];
    isLeaf = true;
    index;
    k;
    path = [];
    parent;
    constructor(data, i, parent) {
        if (parent) this.parent = parent;
        if (parent) this.path = [...parent.path, i];
        this.index = i || 0;
        this.k = parent ? parent.k * 2 + i : 1
        this.data = data;
    }

    conformingSplit() {
        if (!this.isLeaf) return
        this.split();

        let heapId = this.neighbors()[2] // longest edge
        // console.log(heapId);
        while (heapId > 1) {
            let a = this.find(Math.floor(heapId / 2))
            if (a) a.split();
            let b = this.find(heapId)
            if (b) b.split();

            if (a && a.neighbors) heapId = a.neighbors()[2];
            else {
                // short circuit
                heapId = 0;
            }

            // short circuit 
            // heapId = 0;
        }
    }

    find(k) {
        let root = this.parent || this;
        while (root.parent) root = root.parent
        let res = root.leaves().filter(n => k == n.k)[0]
        // if (!res) console.log('not found', k)
        return res
    }

    split() {
        this.isLeaf = false;
        this.children = mLEB(this.data).map((d, i) => new ATree(d, i, this))
    }

    neighbors() {
        let v = [0, 0, 0, 1]

        let g = [
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

        return this.path.reduce((v, x) => g[x](v), v)
    }

    sibling() {
        if (this.parent) {
            if (this.index === 0) return this.parent.children[1]
            if (this.index === 1) return this.parent.children[0]
        }
    }

    merge() {
        if (this.children[0].isLeaf && this.children[1].isLeaf) {
            // do merge
        }
    }

    leaves() {
        // return a flat array of leaf nodes
        if (!this.isLeaf) {
            return [...this.children[0].leaves(), ...this.children[1].leaves()]
        }
        return [this];
    }

    leafData() {
        // return a flat array of leaf nodes
        if (!this.isLeaf) {
            return [...this.children[0].leafData(), ...this.children[1].leafData()]
        }
        // if (this.k == 5) return [];
        return this.data;
    }

}

// const root = new ATree([
//     2, 0, 2,
//     0, 0, 2,
//     0, 0, 0,
// ])

// root.split()
// root.children[0].split()
// root.children[1].split()


// console.log(chunk(root.leaves(), 9));