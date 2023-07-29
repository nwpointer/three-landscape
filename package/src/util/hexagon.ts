import glsl from "glslify";
import sort from "./sort";

// hexagon are bestagon.
const rotate = glsl`
	vec2 rotate(vec2 uv, vec2 center, float angle) {
		float c = cos(angle);
		float s = sin(angle);
		uv -= center;
		float a = c * uv.r;
		float b = s * uv.g;
		float e = c * uv.g;
		float f = s * uv.r;
		vec2 rotated = vec2(a + b, e - f);
		rotated += center;

		return rotated;
	}

	vec2 rotate(vec2 uv, float angle) {
		return rotate(uv, vec2(0.5, 0.5), angle);
	}

	vec4 rotate(vec4 v, float angle) {
		v.xy = rotate(v.xy, vec2(0.5, 0.5), angle);
		return v;
	}

	vec4 unrotate(vec4 v, float angle) {
		float tau = 6.283185307179586476925286766559;
		v.xy = rotate(v.xy, vec2(0.5, 0.5),  tau*4.0 - angle);
		return v;
	}
`;

const hexagon = glsl`
	vec2[6] hexagon(vec2 uvi, float sharpness,  vec2 vert) {
		float hexSize = 0.5;
		vec2 uv = uvi.xy * vert;

		vec2 muv = uv + 0.5;
		float h = 1.73 / 2.0;
		float rh = 1.0 / h;      
		float m_1 = muv.g * (0.5/h);
		float s = muv.r - m_1;
		float m_2 = muv.g * rh;

		// slanted uv that correct for the hexagon shape
		vec2 huv = vec2(s, m_2) / hexSize;

		vec3[3]colors = vec3[3](vec3(1,0,0),vec3(0,1,0),vec3(0,0,1));
		vec2 floored = floor(huv.xy);
		vec3 modGrid = colors[int(mod(floored.y - floored.x, 3.0))];

		// creates a alternating rgb grid
		vec2 uvGrid = mod(huv, 1.0);
		vec2[2] topBottom = vec2[2](
			mod(huv, 1.0), // bottom
			1.0-mod(huv, 1.0).yx // top
		);
		float isTop = round((uvGrid.x + uvGrid.y) / 2.0);
		vec2 mirrorUv = topBottom[int(isTop)];
		float ghostMirror = topBottom[0].x + topBottom[0].y - 1.0;
		vec3 maskComponents = vec3(ghostMirror, mirrorUv.r, mirrorUv.g);
		vec3 hexMask =  vec3(
			dot(modGrid.zxy, maskComponents),
			dot(modGrid.yzx, maskComponents),
			dot(modGrid.xyz, maskComponents)
		);
		vec3 starHex = pow(hexMask, vec3(sharpness));
		
		// weights
		vec3 hexWeights = starHex / dot(starHex, vec3(1));
		vec2[3] w = vec2[3](vec2(0.0, hexWeights.r), vec2(1.0, hexWeights.b), vec2(2.0, hexWeights.g));
		${sort("w")}

		// generate grid uvs
		vec3 trimask = modGrid.xyz * (isTop);
		vec2[3] hexGrid = vec2[3](
			floored + trimask.b + modGrid.xy, 
			floored + trimask.r + modGrid.yz,
			floored + trimask.g + modGrid.zx 
		);

		return vec2[6](
			w[0],
			w[1],
			w[2],
			hexGrid[0],
			hexGrid[1],
			hexGrid[2]
		);
	}
`
const hexSample = ["Linear", "Normal"].map((mixer)=>glsl`
vec4 hexagon${mixer}Sample(sampler2DArray map, vec3 uvi, float sharpness, vec2 vert) {
	float hexSize = 0.5;
	vec2 uv = uvi.xy * vert;
	float t = uvi.z;

	vec2 muv = uv + 0.5;
	float h = 1.73 / 2.0;
	float rh = 1.0 / h;      
	float m_1 = muv.g * (0.5/h);
	float s = muv.r - m_1;
	float m_2 = muv.g * rh;

	// slanted uv that correct for the hexagon shape
	vec2 huv = vec2(s, m_2) / hexSize;

	vec3[3]colors = vec3[3](vec3(1,0,0),vec3(0,1,0),vec3(0,0,1));
	vec2 floored = floor(huv.xy);
	vec3 modGrid = colors[int(mod(floored.y - floored.x, 3.0))];

	// creates a alternating rgb grid
	vec2 uvGrid = mod(huv, 1.0);
	vec2[2] topBottom = vec2[2](
		mod(huv, 1.0), // bottom
		1.0-mod(huv, 1.0).yx // top
	);
	float isTop = round((uvGrid.x + uvGrid.y) / 2.0);
	vec2 mirrorUv = topBottom[int(isTop)];
	float ghostMirror = topBottom[0].x + topBottom[0].y - 1.0;
	vec3 maskComponents = vec3(ghostMirror, mirrorUv.r, mirrorUv.g);
	vec3 hexMask =  vec3(
		dot(modGrid.zxy, maskComponents),
		dot(modGrid.yzx, maskComponents),
		dot(modGrid.xyz, maskComponents)
	);
	vec3 starHex = pow(hexMask, vec3(sharpness));
	
	// weights
	vec3 hexWeights = starHex / dot(starHex, vec3(1));
	vec2[3] w = vec2[3](vec2(0.0, hexWeights.r), vec2(1.0, hexWeights.b), vec2(2.0, hexWeights.g));
	${sort("w")}

	// generate grid uvs
	vec3 trimask = modGrid.xyz * (isTop);
	vec2[3] hexGrid = vec2[3](
		floored + trimask.b + modGrid.xy, 
		floored + trimask.r + modGrid.yz,
		floored + trimask.g + modGrid.zx 
	);

	// use the change in uv to help determine avoid 1px seams
	vec2 dx = dFdx(uv.xy), dy = dFdy(uv.xy);

	float r_0 = noise(hexGrid[int(w[0].x)]) / 2.0;
	float r_1 = noise(hexGrid[int(w[1].x)]) / 2.0;
	float r_2 = noise(hexGrid[int(w[1].x)]) / 2.0;
	// only rotate if normal map
	float ur_0 = ${mixer =='Normal' ? 'r_0' : '0.0' };
	float ur_1 = ${mixer =='Normal' ? 'r_1' : '0.0' };
	float ur_2 = ${mixer =='Normal' ? 'r_2' : '0.0' };

	vec4 value = unrotate(textureGrad(map, vec3(rotate(uv, r_0)+r_0, t), dx ,dy), ur_0);
	// float depth = gl_FragCoord.z / gl_FragCoord.w;
	// float d = min(max(1.-depth / 60.0, 0.0), 0.575);

	// return value;
	if(w[0].y > 0.95) return value;
	// return un-blended value if one color is dominant or if texel is far away
	// if(w[0].y > 0.4 + d) return value;

	// return 3 way blend
	// todo - figure out why normal mix creates seams
	vec3 color = LinearMix(
		value.rgb,
		unrotate(textureGrad(map, vec3(rotate(uv, r_1)+r_1, t), dx ,dy), ur_1).rgb,
		unrotate(textureGrad(map, vec3(rotate(uv, r_2)+r_1, t), dx ,dy), ur_2).rgb,
		vec3(w[0].y, w[1].y, w[2].y)
	);

	return vec4(color, 1.0);

}`).join("\n");

const preHexSample = ["Linear", "Normal"].map((mixer)=>glsl`
vec4 preHexagon${mixer}Sample(sampler2DArray map, vec3 uvi, float sharpness, vec2 vert, vec2[6] hexData) {
	vec2 uv = uvi.xy * vert;
	float t = uvi.z;

	vec2[3] w = vec2[3](hexData[0], hexData[1], hexData[2]);	
	vec2[3] hexGrid = vec2[3](hexData[3], hexData[4], hexData[5]);

	// use the change in uv to help determine avoid 1px seams
	vec2 dx = dFdx(uv.xy), dy = dFdy(uv.xy);

	float r_0 = noise(hexGrid[int(w[0].x)]) / 4.0;
	float ur_0 = ${mixer =='Normal' ? 'r_0' : '0.0' };
	vec4 value = unrotate(textureGrad(map, vec3(rotate(uv, r_0)+r_0, t), dx ,dy), ur_0);
	// float depth = gl_FragCoord.z / gl_FragCoord.w;
	// float d = min(max(1.-depth / 60.0, 0.0), 0.575);

	// return value;
	if(w[0].y > 0.95) return value;
	// return un-blended value if one color is dominant or if texel is far away
	// if(w[0].y > 0.4 + d) return value;

	float r_1 = noise(hexGrid[int(w[1].x)]) / 4.0;
	float r_2 = noise(hexGrid[int(w[1].x)]) / 4.0;
	float ur_1 = ${mixer =='Normal' ? 'r_1' : '0.0' };
	float ur_2 = ${mixer =='Normal' ? 'r_2' : '0.0' };

	// return 3 way blend
	// todo - figure out why normal mix creates seams
	vec3 color = LinearMix(
		value.rgb,
		unrotate(textureGrad(map, vec3(rotate(uv, r_1)+r_1, t), dx ,dy), ur_1).rgb,
		unrotate(textureGrad(map, vec3(rotate(uv, r_2)+r_1, t), dx ,dy), ur_2).rgb,
		vec3(w[0].y, w[1].y, w[2].y)
	);

	return vec4(color, 1.0);

}`).join("\n");


// hexagon are bestagon.
export default glsl`
	${rotate}
	${hexagon}
	${hexSample}
	${preHexSample}
`;
