// uses a Binary Heap and a Longest edge subdivision to compute a adaptive mesh on the cpu




//TODO: Test this?
//TODO: Integrate with LEB
//TODO: get working on squares
//TODO: move to GPU?

class BinaryHeap {
    heap;
    bitField;

    constructor(d) {
        // this.bitField = (1).toString(2).padEnd(d, "0");
        this.bitField = new Array(2 ** d).fill(0);
        this.bitField[0] = 1; // initialize root leaf

        // initialize array of size 2^d-1 -1
        this.heap = new Array((2 ** d - 1) - 1).fill(0);
        this.heap[0] = d; // store depth at heap 0
        this.heap[2 ** d] = 1 // initialize the root
        this.init(d);
    }

    // heapIndex(b) {
    //     // requires MSB
    //     return h
    // }

    // bitIndex(h) {
    //     // requires LSB  
    //     return b
    // }

    depth() {
        return this.heap[0];
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

    setBit(b, value) {
        this.bitField[b] = value;
    }

    // Format independent functions:
    // ------------------------------

    init(d) {
        // for all in (2^d, 2^d+1)
        for (let k = 2 ** d + 1; k < 2 ** (d + 1); k++) {
            let heapId = k * (2 ** (this.depth() - d))
            this.setHeap(heapId, 0)
        }
        this.sumReduction();
    }

    // O(D + 2^d/P) where p denotes the number of processors used
    sumReduction() {
        let d = this.depth() - 1;
        while (d >= 0) {
            // for all in [2^d, 2^d+1)
            // parallelize
            for (let k = 2 ** d; k < 2 ** (d + 1); k++) {
                const left = this.getHeap(2 * k)
                const right = this.getHeap(2 * k + 1)
                this.setHeap(k, left + right);
            }
            d = d - 1
        }
    }

    // leaf to heap index using binary search
    // dependent on number of children leaves being stored in heap so init and sumReduction should occur first
    leaf(leafId) {
        let heapId = 1;
        while (this.getHeap(heapId) > 1) {
            if (leafId < this.getHeap(2 * heapId)) heapId = 2 * heapId;
            else {
                leafId = leafId - this.getHeap(heapId)
                heapId = 2 * heapId + 1
            }
        }
        return heapId;
    }

    update(cb) {
        // parallelize
        for (let l = 0; l < this.leafCount(); l++) {
            const k = this.leaf(l);
            cb(k);
        }
        this.sumReduction(); // update sum reduction incase cb made updates to the tree
    }

    split(k) {
        if (k > (2 ** this.depth())) throw new Error('max depth exceeded');
        // this.setBit(k->b, 1)
        this.setHeap(2 * k + 1, 1);
    }

    merge(k) {
        // assumes you are passing in the right child ie k st. 2^d+1
        this.setBit(k, 0);
    }

}


const B = new BinaryHeap(3);
console.log(B)
B.split(4);
B.sumReduction();
console.log(B)