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


// BTree is a special binary tree that enforces Conforming-Adaptive Tessellations
class ATree {
    data = [];
    children = [];
    isLeaf = true;
    parent;
    constructor(data, parent) {
        if (parent) this.parent = parent;
        this.data = data;
    }

    split() {
        this.isLeaf = false;

        this.children = LEB(this.data).map(d => new ATree(d, this))

        // TODO: split up the parent chain

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
        return this.data;
    }

}

const root = new ATree([
    2, 0, 2,
    0, 0, 2,
    0, 0, 0,
])

root.split()
root.children[0].split()
root.children[1].split()


console.log(chunk(root.leaves(), 9));