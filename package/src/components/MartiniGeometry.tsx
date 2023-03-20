import { useMemo, useRef } from "react";
import Martini from "@mapbox/martini";
import { useDetectGPU } from "@react-three/drei";

function parseRGBHeightField(image, format = GRAYSCALE) {
  const tileSize = image.width;
  const gridSize = tileSize + 1;
  var canvas = document.createElement("canvas");
  canvas.setAttribute("width", tileSize);
  canvas.setAttribute("height", tileSize);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, tileSize, tileSize).data;
  const terrain = new Float32Array(gridSize * gridSize);

  // decode terrain values
  for (let y = 0; y < tileSize; y++) {
    for (let x = 0; x < tileSize; x++) {
      const k = (y * tileSize + x) * 4;
      const r = data[k + 0];
      const g = data[k + 1];
      const b = data[k + 2];
      terrain[y * gridSize + x] = format(r, g, b);
    }
  }
  // backfill right and bottom borders
  for (let x = 0; x < gridSize - 1; x++) {
    terrain[gridSize * (gridSize - 1) + x] =
      terrain[gridSize * (gridSize - 2) + x];
  }
  for (let y = 0; y < gridSize; y++) {
    terrain[gridSize * y + gridSize - 1] = terrain[gridSize * y + gridSize - 2];
  }
  return terrain;
}

function RGBA(r, g, b) {
  return (r * 256 * 256 + g * 256.0 + b) / 10.0 - 10000.0;
}

function GRAYSCALE(r, g, b) {
  return r * 256;
}

export default function MartiniGeometry({ displacementMap, error, mobileError, args=undefined }) {
  let computedNormals = useRef(false);
  const GPUTier = useDetectGPU();

  const {tileSize, gridSize, tile, data} = useMemo(()=>{
    const tileSize = displacementMap.image.width;
    const gridSize = tileSize + 1;
    const data = parseRGBHeightField(displacementMap.image);
  
    const martini = new Martini(gridSize);
    const tile = martini.createTile(data);

    return {
      tileSize, gridSize, tile, data
    }
  }, [displacementMap])

  // this does block the main thread potentially causing jank
  let { vertices, uv, indices, v } = useMemo(() => {
    let size = args || [tileSize, tileSize];
    // @ts-expect-error
    const slowGPU = (GPUTier.tier === "0" || GPUTier.isMobile);
    var mesh = tile.getMesh(slowGPU ? mobileError: error);
    var v = mesh.vertices.length;
    var mv = tile.getMesh(0).vertices.length;
  
    const vertices = new Float32Array((mv / 2) * 3);
    const uv = new Float32Array(mv);

    for (var i = 0; i < mesh.vertices.length / 2; i++) {
      let x = mesh.vertices[i * 2],
        y = mesh.vertices[i * 2 + 1];
      vertices[3 * i + 0] = (x- tileSize/2) / tileSize * size[0];
      vertices[3 * i + 1] = (y - tileSize/2) / tileSize * size[1];
      // vertices[3 * i + 2] = data[y * gridSize + x] / tileSize;
      vertices[3 * i + 2] = 0;

      uv[2 * i + 0] = x / tileSize;
      uv[2 * i + 1] = y / tileSize;
    }

    return {
      vertices,
      uv,
      v,
      indices: mesh.triangles.reverse(),
    };
  }, [tile, data, error, mobileError, args]);

  return (
    <bufferGeometry
      ref={(geo) => {
        if (geo) {
          geo.attributes.position.needsUpdate = true;
          geo.attributes.uv.needsUpdate = true;
          geo.attributes.uv2 = geo.attributes.uv.clone();
          geo.index.needsUpdate = true;
          if(computedNormals.current) return;
          geo.computeVertexNormals();
          computedNormals.current = true;
        }
      }}
    >
      <bufferAttribute
        attach="attributes-position"
        array={vertices}
        count={vertices.length / 3}
        itemSize={3}
      />
      <bufferAttribute
        // attach="attributes-color"
        attach="attributes-uv"
        array={uv}
        count={uv.length / 2}
        itemSize={2}
      />
      <bufferAttribute
        attach="index"
        array={indices}
        count={indices.length}
        itemSize={1}
      />
    </bufferGeometry>
  );
}


