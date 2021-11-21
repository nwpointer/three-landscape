// uses a Binary Heap and a Longest edge subdivision to compute a adaptive mesh on the cpu

// class BHeap {
//     data
//     constructor(d) {
//         this.depth = d
//         this.depth = d;
//         this.data = 0;
//     }

//     print() {
//         console.log(this.data.toString(2).padStart(this.depth, "0"));
//     }
// }

// b = new BHeap(4);

// (b.print());


class BinaryHeap {
    heap;
    bitField;
    depth;

    constructor(d) {
        this.bitField = (1).toString(2).padEnd(d, "0");
        // initialize array of size 2^d-1 -1
        this.heap = new Array((2 ** d - 1) - 1)
        // this.depth = d;
        // this.heap = 0;
    }

    split(k) {
        // throw error if max depth exceeded?
    }

    neighbors(k) {
        // returns [k]s of neighboring nodes
    }

    merge(k) {

    }

    leaves() {
        // returns list of 
    }

    get() {
        // returns vertex of k
    }

    vertices() {
        // returns list of vertex positions for every leaf node (9 vert per triangle)
    }

    splitPath(path) {
        // split node at path 0100100110..
    }

}