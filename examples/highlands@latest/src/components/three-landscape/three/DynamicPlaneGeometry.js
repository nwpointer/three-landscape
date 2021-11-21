import { BufferGeometry, Float32BufferAttribute } from "three";
import { ATree } from "./ATree";
import { Matrix3 } from "three";

export default class DynamicPlaneGeometry extends BufferGeometry {

    constructor(width = 1, height = 1) {

        super();
        this.type = 'DynamicPlaneGeometry';

        this.parameters = {
            width: width,
            height: height
        };

        const [w, h] = [width, height];

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

        const root = new ATree([
            2, 0, 2,
            0, 0, 2,
            0, 0, 0,
        ])

        root.conformingSplit()
        root.children[0].conformingSplit()
        root.children[0].children[0].conformingSplit()
        root.children[0].children[0].children[1].conformingSplit();

        for (let index = 0; index < 4; index++) {
            root.find(21 * (2 ** index)).conformingSplit();
        }

        for (let index = 0; index < 6; index++) {
            root.leaves().map(l => { l.conformingSplit() });
        }

        const vertices = root.leafData();
        // const vertices = [...v1, ...v2]
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