import { squareMatrix, lebMatrixSquare, depth, neighborsSquare, xySquare, pointFormat } from '../../src/three/LEB'
import { Matrix3 } from 'three'

const a = new Matrix3().set(
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
)

const b = new Matrix3().set(
    0, 0, 1,
    1, 0, 1,
    1, 0, 0,
)

// prints in row major
function printMatrix(rs) {
    rs = rs.transpose().toArray();
    printArray(rs)
}

function printArray(rs) {
    let s = ""
    for (let r in rs) {
        s += rs[r] + ", "
        if (r % 3 == 2) s += '\n'
    }
    console.log(s)
}

test('squareMatrix', () => {
    expect(squareMatrix("0").equals(a)).toBeTruthy();
    expect(squareMatrix("1").equals(b)).toBeTruthy();
    expect(squareMatrix("10").equals(a)).toBeTruthy();
    expect(squareMatrix("11").equals(b)).toBeTruthy();
    expect(squareMatrix("100").equals(a)).toBeTruthy();
    expect(squareMatrix("101").equals(a)).toBeTruthy();
    expect(squareMatrix("110").equals(b)).toBeTruthy();
    expect(squareMatrix("111").equals(b)).toBeTruthy();
    expect(squareMatrix("1000").equals(a)).toBeTruthy();
})


test("depth", () => {
    expect(depth("0")).toBe(0);
    expect(depth("1")).toBe(0);
    expect(depth("10")).toBe(1);
    expect(depth("10")).toBe(1);
    expect(depth("101")).toBe(2);
});

// test('lebMatrixSquare', () => {
//     printMatrix(lebMatrixSquare(5))
// })

test('lebMatrixSquare', () => {
    const k = 2;
    // printArray(xySquare(k))
    printArray(pointFormat(xySquare(k)))
    // printMatrix(lebMatrixSquare(k))
})


// test("neighbors", () => {
//     console.log(neighborsSquare(9))
// })

