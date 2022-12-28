import React, { useMemo } from "react";
import { Texture } from "three";
import Martini from "@mapbox/martini";

function parseRGBHeightField(image, format = GRAYSCALE) {
  const tileSize = image.width;
  const gridSize = tileSize + 1;
  var canvas = document.createElement("canvas");
  canvas.setAttribute("width", tileSize);
  canvas.setAttribute("height", tileSize);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(image, 0, 0);
  const heightData = ctx.getImageData(0, 0, tileSize, tileSize).data;
  const terrain = new Float32Array(gridSize * gridSize);

  // decode terrain values
  for (let y = 0; y < tileSize; y++) {
    for (let x = 0; x < tileSize; x++) {
      const k = (y * tileSize + x) * 4;
      const r = heightData[k + 0];
      const g = heightData[k + 1];
      const b = heightData[k + 2];
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



export default function MartiniGeometry(props : {
  displacementMap: Texture,
  error?: Number
  args?: [Number, Number]
}) {
  const {tileSize, gridSize, tile, heightData} = useMemo(()=>{
    const tileSize = props.displacementMap.image.width;
    const gridSize = tileSize + 1;
    const heightData = parseRGBHeightField(props.displacementMap.image);

    const martini = new Martini(gridSize);
    const tile = martini.createTile(heightData);

    return {
      tileSize, gridSize, tile, heightData
    }
  }, [props.displacementMap])

  // this does block the main thread potentially causing jank
  let { vertices, uv, indices, v } = useMemo(() => {
    let size = props.args || [tileSize, tileSize];

    console.time('gen')
    var mesh = tile.getMesh(props.error || 0);
    var v = mesh.vertices.length;
    var mv = tile.getMesh(0).vertices.length;
  
    const vertices = new Float32Array((mv / 2) * 3);
    const uv = new Float32Array(mv);

    for (var i = 0; i < mesh.vertices.length / 2; i++) {
      let x = mesh.vertices[i * 2],
        y = mesh.vertices[i * 2 + 1];
      vertices[3 * i + 0] = (x- tileSize/2) / tileSize * size[0];
      vertices[3 * i + 1] = (y - tileSize/2) / tileSize * size[1];
      // vertices[3 * i + 2] = heightData[y * gridSize + x] / tileSize;
      vertices[3 * i + 2] = 0;

      uv[2 * i + 0] = x / tileSize;
      uv[2 * i + 1] = y / tileSize;
    }

    console.timeEnd('gen')

    return {
      vertices,
      uv,
      v,
      indices: mesh.triangles.reverse(),
    };
  }, [tile, heightData, props.error, props.args]);

  return (
    <bufferGeometry
      ref={(geo) => {
        if (geo) {
          geo.attributes.position.needsUpdate = true;
          geo.attributes.uv.needsUpdate = true;
          geo.attributes.uv2 = geo.attributes.uv.clone();
          geo.index.needsUpdate = true;
          geo.computeVertexNormals();
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


