import { split } from '../../src/three/DynamicPlaneGeometry'

test('splat index expects 4 channels', () => {
    const res = split([
        0, 0, 1,
        0, 0, 0,
        1, 0, 0
    ])

    expect(res).toEqual([
        1, 0, 0, 0.5, 0, 0.5, 0,
        0, 0, 0, 0, 0, 0.5, 0,
        0.5, 0, 0, 1
    ])

    console.log(res);
});