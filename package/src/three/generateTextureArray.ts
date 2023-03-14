import { DataArrayTexture, RGBAFormat, UnsignedByteType, LinearMipMapLinearFilter, LinearFilter, NearestFilter, RepeatWrapping, sRGBEncoding } from "three";
import { getImageData } from "./getImageData";

// assumes textures are loaded and ready to go.
// would be better to generate as the textures load
export function generateTextureArray(textures) {
  console.log('generating texture array...')
  const { width, height } = textures[0].image; // assume all textures are the same size
  const texturesData = new Uint8Array(width * height * 4 * textures.length);

  // for each texture in the textures array
  textures.forEach((texture, i) => {
    const data = getImageData(texture.image).data;
    // if(typeof alphaTexture != 'undefined') {
    //   // const alpha = getImageData(alphaTexture?.image);
    //   console.log(texture.image, alphaTexture?);
    // }
    
    const offset = i * width * height * 4;
    texturesData.set(data, offset);
  });

  const textureArray = new DataArrayTexture(
    texturesData,
    width,
    height,
    textures.length
  );

  // set the mips and such
  textureArray.needsUpdate = true;
  textureArray.format = RGBAFormat;
  textureArray.encoding = sRGBEncoding;
  textureArray.type = UnsignedByteType;
  textureArray.minFilter = LinearMipMapLinearFilter;
  textureArray.magFilter = NearestFilter;
  textureArray.wrapS = RepeatWrapping;
  textureArray.wrapT = RepeatWrapping;
  textureArray.generateMipmaps = true;

  return textureArray;
}

const TextureIds = textures => textures.map((d) => d.uuid).join('-');

const memory = (function TexMem(){
  let cache = {};
  return {
    get: (textures) => cache[TextureIds(textures)],
    set: (textures, value) => cache[TextureIds(textures)] = value,
    clear: () => cache = {},
    "delete": (textures) => delete cache[TextureIds(textures)]
  }
})();

export function memGenerateTextureArray(textures){
  if(memory.get(textures)) return memory.get(textures);
  const textureArray = generateTextureArray(textures);
  memory.set(textures, textureArray);
  return textureArray;
};