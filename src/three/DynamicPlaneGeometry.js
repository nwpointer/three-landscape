import { BufferGeometry, Float32BufferAttribute } from "three";
import { BinaryHeap } from './BinaryHeap';

const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);


// if I got merging working I could avoid creating a new array everytime
// and just merge nodes that fail the test

// would be really cool if I could actually run each leaf in its own thread
// looks like sum reduction is taking a long time, would also be good to multi-thread

// would be even cooler to get it running on the gpu



export function update(px = 0.5, py = 1.25) {
    const heap = new BinaryHeap(24);
    heap.lebSplitSquare(1);
    heap.lebSplitSquare(2);
    heap.lebSplitSquare(3);
    heap.sumReduction();

    // 18 = ~1million triangles
    for (var i in new Array(10).fill(0)) {
        for (var k of heap.leaves()) {
            heap.lebSplitSquare(k)
        }
        heap.sumReduction();
    }

    // with 10 & 8 and r of 0.05, we get ~ 14k
    for (var i in new Array(8).fill(0)) {
        for (var k of heap.leaves()) {
            const [x, z, y] = heap.verticesSquareOf(k)
            const d = distance(px, py, x, y)
            if (d < 0.05 * i) heap.lebSplitSquare(k)
        }
        heap.sumReduction();
    }

    return heap;
}

export default class DynamicPlaneGeometry extends BufferGeometry {

    constructor(width = 1, height = 1, px, py) {

        super();
        this.type = 'DynamicPlaneGeometry';

        this.parameters = {
            width: width,
            height: height,
            px, py
        };

        this.width = width;
        this.height = height;
        this.px = px;
        this.py = py;

        this.update(px, py);

    }

    update(px = 1, py = 1) {
        const [w, h] = [this.width, this.height];

        const toUV = (verts) => {
            return verts.map((vert, i) => {
                if (i % 3 === 0) return vert / w
                if (i % 3 === 1) return null
                if (i % 3 === 2) return vert / h
            })
                // filter nulls
                .filter(a => a || a == 0)
        }

        const toNormal = (verts) => {
            return verts.map((vert, i) => {
                if (i % 3 === 0) return 0
                if (i % 3 === 1) return 1
                if (i % 3 === 2) return 0
            })
        }

        const heap = update(px, py);

        const vertices = heap.verticesSquare();
        const normals = toNormal(vertices)
        const uvs = toUV(vertices)

        this.setAttribute('position', new Float32BufferAttribute(vertices, 3));
        this.setAttribute('normal', new Float32BufferAttribute(normals, 3));
        this.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    }

    static fromJSON(data) {

        return new DynamicPlaneGeometry(data.width, data.height);

    }

}


// const vertices = [
//     w, 0, -h,
//     -w, 0, -h,
//     w, 0, h,

//     // 1,  1,  1
//     // -1,  1, -1
//     // -1,  1,  1

//     w, 0, h,
//     0, 0, 0,
//     -w, 0, h,

//     0, 0, 0,
//     -w, 0, -h,
//     -w, 0, h,

// ];
// const normals = [
//     0, 1, 0,
//     0, 1, 0,
//     0, 1, 0,
//     0, 1, 0,
//     0, 1, 0,
//     0, 1, 0,
//     0, 1, 0,
//     0, 1, 0,
//     0, 1, 0,
// ];
// const uvs = [
//     0, 0,
//     1, 0,
//     0, 1,

//     // 0, 1
//     // 1, 0
//     // 1, 1

//     0, 1,
//     1 / 2, 1 / 2,
//     1, 1,

//     1 / 2, 1 / 2,
//     1, 0,
//     1, 1,
// ];