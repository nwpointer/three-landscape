import { splatIndex, splatChannel } from '../../src/three/SplatMaterial'

test('splat index expects 4 channels', () => {
    expect(splatIndex(0)).toBe(0);
    expect(splatIndex(1)).toBe(0);
    expect(splatIndex(2)).toBe(0);
    expect(splatIndex(3)).toBe(0);
    expect(splatIndex(4)).toBe(1);

    expect(splatChannel(0)).toBe("r");
    expect(splatChannel(1)).toBe("g");
    expect(splatChannel(2)).toBe("b");
    expect(splatChannel(3)).toBe("a");
    expect(splatChannel(4)).toBe("r");
});