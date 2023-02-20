import { Scene, Mesh, PlaneGeometry, OrthographicCamera } from "three";

export function materialScene(mat) {
  const camera = new OrthographicCamera(-0.5, 0.5, -0.5, 0.5, 1, 10);
  const scene = new Scene();
  const geo = new PlaneGeometry(1, 1);
  const mesh = new Mesh(geo, mat);
  mesh.rotation.set(-Math.PI, 0, 0);
  camera.position.set(0, 0, 1);
  scene.add(mesh);

  return { camera, scene };
}
