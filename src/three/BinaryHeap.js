// import { neighbors, findMSB, EDGE, computeVertices } from "./LEB";
const { neighbors, findMSB, EDGE, computeVertices, computeVerticesSquare, neighborsSquare, xySquare, pointFormat } = require("./LEB");


// NEXT
/*
need to get it working on squares...

get merging working or just recompute?

do a demo with animated vertices

do a demo with shaped vertices

get it running on the gpu?

optimization and backface bug


*/

// uses a Binary Heap and a Longest edge subdivision to compute a adaptive mesh on the cpu
export class BinaryHeap {
    heap;

    constructor(d) {
        this.heap = new Int32Array(2 ** (d + 1)).fill(0);
        this.heap[0] = d; // store depth at heap 0
        this.heap[2 ** d] = 1 // initialize the root in the bit field 
        this.sumReduction();
    }

    depth() {
        return this.heap[0];
    }

    count() {
        return this.heap.length
    }

    leafCount() {
        return this.heap[1];
    }

    getHeap(k) {
        return this.heap[k];
    }

    setHeap(k, value) {
        this.heap[k] = value;
    }

    invalidIndex(k) {
        return k == 0 || !(k in this.heap)
    }

    bitIndex(h) {
        const D = this.depth();
        const d = findMSB(h);
        return h * (2 ** (D - d))
        // return D - findMSB(h);
    }


    // Heap Format independent functions:
    // ------------------------------

    // uses bottom up sum reduction to compute the number of leaves under a given heap index.
    // this is used latter to iterate though all the leaves efficiently
    // and must be updated when the tree is modified
    sumReduction() {
        // for all depth levels
        for (var d = this.depth() - 1; d >= 0; d--) {
            // for all nodes on a level ie [2^d, 2^d+1)
            for (let k = 2 ** d; k < 2 ** (d + 1); k++) {
                const left = this.getHeap(2 * k)
                const right = this.getHeap(2 * k + 1)
                this.setHeap(k, left + right);
            }
        }
    }

    lebSplit(k) {
        this.split(k);
        const n = neighbors(k);
        let heapId = n[EDGE];

        while (heapId > 1) {
            this.split(heapId)
            heapId = Math.floor(heapId / 2)
            this.split(heapId)
            heapId = neighbors(heapId)[EDGE];
        }
    }

    lebSplitSquare(k) {
        this.split(k);
        const n = neighborsSquare(k);
        let heapId = n[EDGE];

        while (heapId > 1) {
            this.split(heapId)
            heapId = Math.floor(heapId / 2)
            if (heapId > 1) {
                this.split(heapId)
                heapId = neighborsSquare(heapId)[EDGE];
            }
        }
    }

    split(k) {
        const rightChild = 2 * k + 1;
        // if (this.invalidIndex(rightChild)) return;
        const bitIndex = this.bitIndex(rightChild);
        this.setHeap(bitIndex, 1)
    }

    leaves() {
        const leaves = []
        for (let l = 0; l < this.leafCount(); l++) {
            leaves.push(this.leaf(l))
        }
        return leaves
    }

    verticesOf(k) {
        return computeVertices(k);
    }

    vertices() {
        return this.leaves().flatMap(computeVertices)
    }

    verticesSquareOf(k) {
        // return computeVerticesSquare(k);
        return pointFormat(xySquare(k));
    }

    verticesSquare() {
        // return this.leaves().flatMap(computeVerticesSquare)
        return this.leaves().flatMap(k => pointFormat(xySquare(k)))
    }

    update(cb) {
        // parallelize
        for (let l = 0; l < this.leafCount(); l++) {
            const k = this.leaf(l);
            cb(k);
        }
        this.sumReduction(); // update sum reduction incase cb made updates to the tree
    }

    // leaf to heap index using binary search
    // dependent on number of children leaves being stored in heap so init and sumReduction should occur first
    leaf(leafId) {
        let heapId = 1;
        while (this.getHeap(heapId) > 1) {
            if (leafId < this.getHeap(2 * heapId)) {
                heapId = 2 * heapId;
            }
            else {
                leafId = leafId - this.getHeap(heapId * 2)
                heapId = 2 * heapId + 1
            }
        }
        return heapId;
    }

}

// module.export = BinaryHeap


// const heap = new BinaryHeap(10);
// heap.split(1);
// heap.split(2);
// heap.sumReduction();
// heap.lebSplit(4);
// // heap.lebSplit(9);
// heap.sumReduction();
// const vertices = heap.vertices();

// console.log(vertices)