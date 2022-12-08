import { useLoader, useThree } from "@react-three/fiber";
import { useEffect, useState, useRef, useMemo } from "react";
import { TextureLoader } from "three";
import { BasisTextureLoader, TGALoader } from "three-stdlib";

export default function useProgressiveTextures(resources) {
  const { gl } = useThree();
  const [batch, setBatch] = useState(0);
  const loader = useMemo(() => new PolymorphicLoader(gl), [gl]);
  const initialTextures = useLoader(PolymorphicLoader, resources[0])
  const progressiveTextures = useRef([]);

  useEffect(() => {
    (async () => {
      let resourceSet = resources[batch + 1]
      if (!resourceSet) return

      const textures = await Promise.all(resourceSet.map(resource => {
        return loader.loadAsync(resource)
      }))

      progressiveTextures.current[batch] = textures
      if (batch < resources.length - 1) setBatch(batch + 1);

    })()
  }, [batch, loader, resources])

  // return progressiveTextures.current[0]
  return [batch, [initialTextures, ...(progressiveTextures.current)]]
}

export function useProgressiveTexture(resources) {
  const { gl } = useThree();
  const [batch, setBatch] = useState(0);
  const loader = useMemo(() => new PolymorphicLoader(gl), [gl]);
  const initialTexture = useLoader(PolymorphicLoader, resources[0]);
  const [progressiveTexture, setProgressiveTexture] = useState(initialTexture);

  useEffect(() => {
    loader.load(resources[batch], (texture) => {
      setProgressiveTexture(texture);
      if (batch < resources.length - 1) setBatch(batch + 1);
    });
  }, [batch, loader, resources]);

  return batch === 0 ? initialTexture : progressiveTexture
}

class PolymorphicLoader extends TextureLoader {

  loaders = {
    'png': TextureLoader,
    'jpg': TextureLoader,
    'tga': TGALoader,
    'basis': BasisTextureLoader
  }

  constructor(gl, ...args) {
    super(...args)
    if (gl) PolymorphicLoader.prototype.gl = gl
  }

  fileType(f) {
    return f.split('.').pop().toLowerCase();
  }

  load(input, ...rest) {
    const type = this.fileType(input)
    const loader = new this.loaders[type]()

    // note, basis textures requires gl and a transcoder to be setup beforehand
    if (type === "basis") {
      loader.setTranscoderPath("/");
      loader.detectSupport(this.gl);
    }
    return loader.load(input, ...rest);
  }

  loadAsync(input, onload, ...rest) {
    return new Promise((resolve) => {
      this.load(input, (texture) => {
        // this.gl.initTexture(texture)
        if (onload) onload(texture)
        resolve(texture)
      }, ...rest)
    })
  }
}
