import { BufferGeometry, Float32BufferAttribute } from "three";


export default class UnindexedGeometry extends BufferGeometry {
    constructor(n) {

        super();
        this.type = 'UnindexedGeometry';
        this.n = n;
        this.parameters = { n: n };

        const vertices = [];

        for (let i = 0; i < n; i++) {
            vertices.push(
                0, 1, 0,
                0, 0, 0,
                1, 0, 0,
            );
        }

        this.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    }

    static fromJSON(data) {

        return new UnindexedGeometry(data.n);

    }
}