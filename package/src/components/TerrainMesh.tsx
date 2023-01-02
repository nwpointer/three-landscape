import { createPortal, useFrame, useThree } from "@react-three/fiber";
import React, {
  cloneElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import create from "zustand";
import { v4 as uuid } from "uuid";
import {
  Texture,
  Mesh,
  RGBAFormat,
  Scene,
  WebGLRenderTarget,
  OrthographicCamera,
  FramebufferTexture,
	DataTexture,
	LinearFilter,
  Vector2
} from "three";
import { DeterminantMaterial, TerrainMaterial } from "..";
import VirtualSampleMaterial from "./VirtualSampleMaterial";

interface store {
  cache: Texture;
  pageTable: Texture;
  determinant: Texture;
  meshes: any[];
  setDeterminant: (texture: any) => void;
  setCache: (texture: any) => void;
  setPageTable: (texture: any) => void;
	setTextures: (determinant: any, cache: any, pageTable: any) => void;
  registerMesh: (geo: any) => void;
}

const useStore = create<store>((set) => ({
  cache: null,
  pageTable: null,
  determinant: null,
  meshes: [],
  materials: [],
  setDeterminant: (texture) => set(() => ({ determinant: texture })),
  setCache: (texture) => set(() => ({ cache: texture.clone() })),
  setPageTable: (texture) => set(() => ({ pageTable: texture })),
	setTextures: (determinant, cache, pageTable) => set(() => ({ determinant, cache, pageTable })),
  registerMesh: (mesh) =>
    set((store) => {
      // mesh = mesh.clone();
      // mesh.material = mesh.material.clone();
      // mesh.material.displacementScale = 0;
      return { meshes: [...store.meshes, mesh] };
    }),
}));

export const useVirtualTexture = (id) => {
  const cache = useStore((store) => store.cache);
  const pageTable = useStore((store) => store.pageTable);
  const determinant = useStore((store) => store.determinant);
  const meshes = useStore((store) => store.meshes);
  const registerMesh = useStore((store) => store.registerMesh);
  const setCache = useStore((store) => store.setCache);
  const setPageTable = useStore((store) => store.setPageTable);
  const setDeterminant = useStore((store) => store.setDeterminant);
	const setTextures = useStore((store) => store.setTextures);
  return {
    cache,
    pageTable,
    determinant,
    meshes,
    registerMesh,
    setCache,
    setPageTable,
    setDeterminant,
		setTextures
  };
};

// need to start determinant
// need to create a global context
//

export default function TerrainMesh({
  children,
  name,
  scale = 8,
  frequency = 4,
  ...props
}) {
  const { size, gl, camera } = useThree();
  const [width, height] = [
    Math.round(size.width / scale),
    Math.round(size.height / scale),
  ];
  const [virtualScene] = useState(() => new Scene());
  const [pageScene] = useState(() => new Scene());
  const [sampleCamera] = useState(() => {
    const camera = new OrthographicCamera(-0.5, 0.5, -0.5, 0.5, 1, 10);
    camera.position.set(0, 0, 1);
    return camera;
  });
  const pageMesh = useRef();

  const mesh = useRef() as { current: Mesh | undefined };
  const id = useMemo(() => name || uuid(), [name]);
  const { setTextures } = useVirtualTexture(id);

  const pageSize = 512 * 8;
  const cacheSize = gl.capabilities.maxTextureSize;

  let count = 0;
  let initialized = false;
  var pixels = new Uint8Array(width * height * 4);

  const determinantFrameBuffer = useMemo(() => {
    const target = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      stencilBuffer: false,
    });
    return target;
  }, [width, height]);

  const cache = useMemo(() => {
    const target = new FramebufferTexture(cacheSize, cacheSize, RGBAFormat);
		target.magFilter = LinearFilter;
    target.generateMipmaps = true;
    return target;
  }, [cacheSize]);

  const [pageTable, updatePageTable] = useMemo(() => {
    const width = cacheSize / pageSize;
    const height = cacheSize / pageSize;
		const size = width * height;
    const data = new Uint8Array(width * height * 4);
    const dataTexture = new DataTexture(data, width, height);
		dataTexture.needsUpdate = true;

		// initialize page table to random colors
		for (let i = 0; i < size; i++) {
			const index = i * 4;
			data[index] = Math.floor(Math.random() * 255);
			data[index + 1] = Math.floor(Math.random() * 255);
			data[index + 2] = Math.floor(Math.random() * 255);
			data[index + 3] = 255;
		}

		const updatePageTable = (x,y, [r,g,b,a])=>{
			const index = (y * width + x) * 4;
			dataTexture.image.data[index] = r;
			dataTexture.image.data[index + 1] = g;
			dataTexture.image.data[index + 2] = b;
			dataTexture.image.data[index + 3] = a;
			dataTexture.needsUpdate = true;
		}

		return [dataTexture, updatePageTable];
  }, [cacheSize, pageSize]);

  const pageFrameBuffer = useMemo(() => {
    const target = new WebGLRenderTarget(pageSize, pageSize, {
      format: RGBAFormat,
      stencilBuffer: false,
    });
    return target;
  }, [pageSize]);

  const renderPage = (s, x, y) => {
    if (pageMesh?.current) {
      pageMesh?.current?.scale?.set(s, s, s);
      //top-right origin: index e in range (0..s-1)
      pageMesh?.current?.position?.set((s - 1) / 2 - x, (s - 1) / 2 - y, 0);
      gl.setRenderTarget(pageFrameBuffer);
      gl.clear();
      gl.render(pageScene, sampleCamera);
    }
  };

  useFrame(() => {
    if (count == 0) {
      gl.setRenderTarget(determinantFrameBuffer);
      gl.clear();
      gl.render(virtualScene, camera);
      gl.readRenderTargetPixels(
        determinantFrameBuffer,
        0,
        0,
        width,
        height,
        pixels
      );

      if (!initialized) {
        // initialize cache
        let i = 0;
        let n = gl.capabilities.maxTextureSize / pageSize;

        for (var x = 0; x < n; x++) {
          for (var y = 0; y < n; y++) {
            renderPage(n, x, y);
            const px = x * -pageSize;
            const py = (y + 1 - n) * pageSize;
            gl.copyFramebufferToTexture(new Vector2(px, py), cache, 0);
            i++;
          }
        }

				// test pageTable update
				updatePageTable(1,3, [255,0,0,255]);

        initialized = true;
      }

      cache.needsUpdate = true;

      gl.setRenderTarget(null);
    }
    count = (count + 1) % frequency;
  });

  useEffect(() => {
		setTextures(determinantFrameBuffer.texture, cache, pageTable)
  }, [determinantFrameBuffer]);

  const material = children.find(
    (child) =>
      child.props.attach === "material" || child.type.name.includes("Material")
  );
  const geometry = children.find(
    (child) =>
      child.props.attach === "geometry" || child.type.name.includes("Geometry")
  );
  const sampleMaterial = cloneElement(material, {
    displacementScale: 0,
  });

  return (
    <>
      <mesh
        ref={(mesh) => {
          // r3f did not seem to pickup the texture update, so we do it manually
          if (mesh) {
            mesh.material.map = pageTable;
						mesh.material.uniforms.uPageTable.value = pageTable
            mesh.material.needsUpdate = true;
          }
        }}
        {...props}
      >
        {geometry}
        {/* {material} */}
        <VirtualSampleMaterial {...material.props} />
      </mesh>
      {createPortal(
        <>
          <ambientLight intensity={1.0} />
          <mesh ref={pageMesh} rotation={[-Math.PI, 0, 0]}>
            <planeBufferGeometry args={[1, 1]} />
            {sampleMaterial}
          </mesh>
        </>,
        pageScene
      )}
      {createPortal(
        <>
          <ambientLight intensity={0.5} />
          <mesh {...props}>
            {geometry}
            <DeterminantMaterial
              displacementMap={material.props.displacementMap}
              normalMap={material.props.normalMap}
              displacementScale={material.props.displacementScale}
            />
          </mesh>
          {/* {meshes.map((mesh, i) => (
            <mesh key={i} rotation={props.rotation} position={props.position}>
              <primitive key={i} object={mesh.geometry} attach="geometry" />
              <DeterminantMaterial
                color="red"
                displacementMap={mesh.material.displacementMap}
                normalMap={mesh.material.normalMap}
                displacementScale={mesh.material.displacementScale}
              />
            </mesh>
          ))} */}
        </>,
        virtualScene
      )}
    </>
  );
}
