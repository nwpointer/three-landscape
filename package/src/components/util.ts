import { RepeatWrapping, NearestFilter, LinearMipmapNearestFilter } from "three";
import glsl from "glslify";

export function getDimensions(texture) {
    return {
      width: texture.source.data.width,
      height: texture.source.data.height,
    };
  }
  
const map = f => arr => arr.map(f);
const filter = f => arr => arr.filter(f);
const pipe = (...fns) => (x) => fns.reduce((v, f) => f(v), x);

export const pluck = key => map(v=>v[key])
export const defined = filter(v=>typeof v != undefined);
export const standard = defaultValue => map(v=>v||defaultValue);
export const repeatTexture = (t) => {
  t.wrapS = t.wrapT = RepeatWrapping;
  t.needsUpdate = true;
}
export const pixelateTexture = (t) => {
  t.magFilter = NearestFilter;
  t.minFilter = LinearMipmapNearestFilter
  t.needsUpdate = true;
}
  
export const repeatTextures = map(repeatTexture);
export const pixelateTextures = map(pixelateTexture);
export const option = (arr, key, defaultValue?) => pipe(
  pluck(key),
  standard(defaultValue),
  defined,
)(arr)

export const edgeBlend = glsl`
	// operates on a weight
	float edgeBlend(float v, float blur, float amplitude, float wavelength, float accuracy){
		//   float k = texture2D( uNoise, vUv*wavelength*0.0075 ).x; // cheap (cache friendly) lookup
		float k = noise(vUv*wavelength); // slower but may need to do it if at texture limit
		return smoothstep(1.5-blur, 1.5 + blur, v*accuracy + k*amplitude);
	}

	float edgeBlend(float v, float blur){
	float amplitude = 1.0;
	float wavelength = 1024.0*64.0;
	float accuracy  = 2.0;
	return edgeBlend(v, blur, amplitude, wavelength, accuracy);
	}
`

export const luma = glsl`
	float luma(vec3 color) {
		return dot(color, vec3(0.299, 0.587, 0.114));
  	}
  
  	float luma(vec4 color) {
		return dot(color.rgb, vec3(0.299, 0.587, 0.114));
  	}
`

export const normalFunctions = glsl`
	vec4 zeroN = vec4(0.5, 0.5, 1, 1);

	vec4 blend_rnm(vec4 n1, vec4 n2){
		vec3 t = n1.xyz*vec3( 2,  2, 2) + vec3(-1, -1,  0);
		vec3 u = n2.xyz*vec3(-2, -2, 2) + vec3( 1,  1, -1);
		vec3 r = t*dot(t, u) /t.z -u;
		return vec4((r), 1.0) * 0.5 + 0.5;
	}

	vec4 slerp(vec4 p0, vec4 p1, float t)
	{
		float dotp = dot(normalize(p0), normalize(p1));
		if ((dotp > 0.9999) || (dotp<-0.9999))
		{
			if (t<=0.5)
			return p0;
			return p1;
		}
		float theta = acos(dotp);
		vec4 P = ((p0*sin((1.0-t)*theta) + p1*sin(t*theta)) / sin(theta));
		P.w = 1.0;
		return P;
	}
	
`

export const colorFunctions = glsl`
	vec3 HSVtoRGB(in vec3 HSV){
		float H   = HSV.x;
		float R   = abs(H * 6.0 - 3.0) - 1.0;
		float G   = 2.0 - abs(H * 6.0 - 2.0);
		float B   = 2.0 - abs(H * 6.0 - 4.0);
		vec3  RGB = clamp( vec3(R,G,B), 0.0, 1.0 );
		return ((RGB - 1.0) * HSV.y + 1.0) * HSV.z;
	}

	vec3 RGBtoHSV(in vec3 RGB){
		const float Epsilon = 1e-10;
		vec4  P   = (RGB.g < RGB.b) ? vec4(RGB.bg, -1.0, 2.0/3.0) : vec4(RGB.gb, 0.0, -1.0/3.0);
		vec4  Q   = (RGB.r < P.x) ? vec4(P.xyw, RGB.r) : vec4(RGB.r, P.yzx);
		float C   = Q.x - min(Q.w, Q.y);
		float H   = abs((Q.w - Q.y) / (6.0 * C + Epsilon) + Q.z);
		vec3  HCV = vec3(H, C, Q.x);
		float S   = HCV.y / (HCV.z + Epsilon);
		return vec3(HCV.x, S, HCV.z);
	}

	vec4 saturation(vec4 color, float s){
		vec3 col_hsv = RGBtoHSV(color.rgb);
		col_hsv.y *= (s * 2.0);
		vec3 col_rgb = HSVtoRGB(col_hsv.rgb);
		return vec4(col_rgb, color.a);
	}
`


export const glslNoise = glsl`
  // Precision-adjusted variations of https://www.shadertoy.com/view/4djSRW
  float hash(float p) { p = fract(p * 0.011); p *= p + 7.5; p *= p + p; return fract(p); }
  float hash(vec2 p) {vec3 p3 = fract(vec3(p.xyx) * 0.13); p3 += dot(p3, p3.yzx + 3.333); return fract((p3.x + p3.y) * p3.z); }

  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    float u = f * f * (3.0 - 2.0 * f);
    return mix(hash(i), hash(i + 1.0), u);
  }

  float noise(vec2 x) {
    vec2 i = floor(x);
    vec2 f = fract(x);

    // Four corners in 2D of a tile
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    // Simple 2D lerp using smoothstep envelope between the values.
    // return vec3(mix(mix(a, b, smoothstep(0.0, 1.0, f.x)),
    //			mix(c, d, smoothstep(0.0, 1.0, f.x)),
    //			smoothstep(0.0, 1.0, f.y)));

    // Same code, with the clamps in smoothstep and common subexpressions
    // optimized away.
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float noise(vec3 x) {
    const vec3 step = vec3(110, 241, 171);

    vec3 i = floor(x);
    vec3 f = fract(x);
 
    // For performance, compute the base input to a 1D hash from the integer part of the argument and the 
    // incremental change to the 1D based on the 3D -> 1D wrapping
    float n = dot(i, step);

    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix( hash(n + dot(step, vec3(0, 0, 0))), hash(n + dot(step, vec3(1, 0, 0))), u.x),
                   mix( hash(n + dot(step, vec3(0, 1, 0))), hash(n + dot(step, vec3(1, 1, 0))), u.x), u.y),
               mix(mix( hash(n + dot(step, vec3(0, 0, 1))), hash(n + dot(step, vec3(1, 0, 1))), u.x),
                   mix( hash(n + dot(step, vec3(0, 1, 1))), hash(n + dot(step, vec3(1, 1, 1))), u.x), u.y), u.z);
  }
`

export const paralax = glsl`
vec3 viewAngle( vec3 surfPosition, vec3 surfNormal, vec3 viewPosition, vec2 uv ) {
	vec2 texDx = dFdx( uv );
	vec2 texDy = dFdy( uv );

	vec3 vSigmaX = dFdx( surfPosition );
	vec3 vSigmaY = dFdy( surfPosition );
	vec3 vR1 = cross( vSigmaY, surfNormal );
	vec3 vR2 = cross( surfNormal, vSigmaX );
	float fDet = dot( vSigmaX, vR1 );

	vec2 vProjVscr = ( 1.0 / fDet ) * vec2( dot( vR1, viewPosition ), dot( vR2, viewPosition ) );
	vec3 vProjVtex;
	vProjVtex.xy = texDx * vProjVscr.x + texDy * vProjVscr.y;
	vProjVtex.z = dot( surfNormal, viewPosition );

	return vProjVtex;
}

vec2 parallaxMap(in vec3 V, float parallaxScale, float parallaxMinLayers, float parallaxMaxLayers, sampler2D bumpMap, vec2 uv) {
	// Determine number of layers from angle between V and N
	float numLayers = mix(parallaxMaxLayers, parallaxMinLayers, abs(dot(vec3(0.0, 0.0, 1.0), V)));

	float layerHeight = 1.0 / numLayers;
	float currentLayerHeight = 0.0;
	// Shift of texture coordinates for each iteration
	vec2 dtex = parallaxScale * V.xy / V.z / numLayers;

	vec2 currentTextureCoords = uv;

	float heightFromTexture =  1.0-texture2D(bumpMap, currentTextureCoords).r;
	float heightFromDisplacement = texture2D(displacementMap, uv).r * displacementScale;

	// while ( heightFromTexture > currentLayerHeight )
	// Infinite loops are not well supported. Do a large finite
	// loop, but not too large, as it slows down some compilers.
	for (int i = 0; i < 32; i += 1 ) {
		if (heightFromTexture <= currentLayerHeight) {
			break;
		} 
		currentLayerHeight += layerHeight;
		// Shift texture coordinates along vector V
		currentTextureCoords -= dtex;
		heightFromTexture = 1.0-texture2D(bumpMap, currentTextureCoords).r;
	}

	vec2 deltaTexCoord = dtex / 2.0;
	float deltaHeight = layerHeight / 2.0;

	// Return to the mid point of previous layer
	currentTextureCoords += deltaTexCoord;
	currentLayerHeight -= deltaHeight;

	// Binary search to increase precision of Steep Parallax Mapping
	const int numSearches = 5;
	for (int i = 0; i < numSearches; i += 1 ) {
		deltaTexCoord /= 2.0;
		deltaHeight /= 2.0;
		heightFromTexture = 1.0-texture2D(bumpMap, currentTextureCoords).r;
		// Shift along or against vector V
		if (heightFromTexture > currentLayerHeight) { // Below the surface

			currentTextureCoords -= deltaTexCoord;
			currentLayerHeight += deltaHeight;

		} else { // above the surface

			currentTextureCoords += deltaTexCoord;
			currentLayerHeight -= deltaHeight;

		}

	}
	return currentTextureCoords;
}
`