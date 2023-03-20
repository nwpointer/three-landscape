import { Scene, Mesh, PlaneGeometry, OrthographicCamera, AmbientLight } from "three";

export function materialScene(mat) {
  const camera = new OrthographicCamera(-0.5, 0.5, -0.5, 0.5, 1, 10);
  const scene = new Scene();
  // ideally we would use a copy of the original geometry here
  // we guess at a reasonable resolution for the plane, it must be similar to the original geometry in order for vertex properties such as Z height to be accurate
  const geo = new PlaneGeometry(1, 1, 1024, 1024); 
  const mesh = new Mesh(geo, mat);
  // const light = new AmbientLight(0xffffff, 1.0);
  mesh.rotation.set(-Math.PI, 0, 0);
  camera.position.set(0, 0, 1);
  scene.add(mesh);
  // scene.add(light);

  return { camera, scene };
}
