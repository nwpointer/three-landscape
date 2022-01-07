import glsl from 'glslify';
const utils = glsl`

  uniform sampler2D cbt;

  // encodes a 32bit value into a 4x8bit array of rgba values
  vec4 encode( float value ){
    value /= 4294967040.0;
    value *= (256.0*256.0*256.0 - 1.0) / (256.0*256.0*256.0);
    vec4 encode = fract( value * vec4(1.0, 256.0, 256.0*256.0, 256.0*256.0*256.0) );
    return vec4( encode.xyz - encode.yzw / 256.0, encode.w ) + 1.0/512.0;
  }

  // returns a 32 bit integer value encoded in a vec4
  float decode (vec4 col) {
    // ivec4 bytes = ivec4(col * 255.0);
    return ceil(
      col.r * 255.0 * 256.0 * 256.0 * 256.0 +
      col.g * 255.0 * 256.0 * 256.0 +
      col.b * 255.0 * 256.0 +
      col.a * 255.0
    );
    // return ((bytes.r << 24) | (bytes.g << 16) | (bytes.b << 8) | (bytes.a));
  }

  float findMSB(float k){
    return floor(log2(k));
  }

  float mergeBit(float k, float depth){
    int b = int(depth - findMSB(k));
    return float((int(k)|1) << b);
  }

  float splitBit(float k, float depth){
    int b = int(depth - findMSB(k));
    return float((int(2.0*k) | 1) << (b -1));
  }

  float primaryBit(float k, float depth){
    float b = depth - findMSB(k);
    return k * pow(2.0, b);
    // int b = int(depth - findMSB(k));
    // return float((int(2.0*k) | 1) << (b -1));
  }

  float getDepth(float k) {
    float i = 1.0;
    while (k >=  pow(2.0,i)) i++;
    return i;
  }

  float getMaxDepth() {
    float i = 1.0;
    while (width*height > pow(2.0,i)) i++;
    return i;
  }

  uint xor(uint a, uint b) {
    return (a | b) & ~(a & b);
  }

  float getBitValue(float v, float i) {
    return step(0.5, mod( v / pow(2.0, i), 1.0));
  }

  uvec4 neighborSplit(uvec4 idArray, uint splitBit){
    uint b = uint(splitBit);
    uint c = b ^ 1u;
    bool cb = bool(c);

    return uvec4(
      (idArray[2u + b] << 1u) | uint(cb && bool(idArray[2u + b])),
      (idArray[2u + c] << 1u) | uint(cb && bool(idArray[2u + c])),
      (idArray[b] << 1u) | uint(cb && bool(idArray[b])),
      (idArray[3] << 1u | b)
    );
  }

  uvec4 neighbors(float k){

    float bitDepth = max(0.0, getDepth(k));
    float bit = getBitValue(k, bitDepth-1.0);

    // left, right, edge, node:
    uvec4 nid = uvec4(0u, 0u, 3u - uint(bit), 2u + uint(bit));
    for (float b = bitDepth - 2.0; b > 0.0; --b) {
      bit = getBitValue(k, b);
      nid = neighborSplit(nid, uint(bit));
    }

    return nid;
  }

  float edge(float node){
    return float(neighbors(node)[2]);
  }

  float parent(float node){
    return floor(node / 2.0);
  }

  bool isEven(float node){
    return mod(node, 2.0) == 0.0;
  }

  float sibling(float node){
    if(isEven(node)){
      return node + 1.0;
    } else {
      return node - 1.0;
    }
  }

  float left(float node){
    return node * 2.0;
  }

  float right(float node){
    return node * 2.0 + 1.0;
  }

  float EP(float node){
    return edge(parent(node));
  }

  float ES(float node){
    return edge(sibling(node));
  }

  float EL(float node){
    return edge(left(node));
  }

  float ER(float node){
    return edge(right(node));
  }

  vec2 getXY(float k){
    return vec2(mod(k, width), floor(k / width));
  }

  // assumes cbt is a 2d texture with values 0..size
  vec4 sampleCBT(float k){
    vec2 uv = getXY(k) / vec2(width, height);
    return texture2D(cbt, uv);
  }

  // return the kth integer from a cbt of the specified size
  float getHeap(float k){
    return decode(sampleCBT(k));
  }

  // get the heap index(ie k) of the lth leaf
  float leaf(float l) {
    float k = 1.0;
    while(getHeap(k) > 1.0) {
      if(l < getHeap(2.0 * k)) {
        k = 2.0 * k;
      }
      else {
        l = l - getHeap(2.0 * k);
        k = 2.0 * k + 1.0;
      }
    }
    return k;
  }

  mat3x3 square(int bit){
    int b = bit;
    int c = 1 - bit;

    return transpose(mat3x3(
      c, 0, b,
      b, c, b,
      b, 0, c
    ));
  }

  mat3x3 split(int bit){
    int b = bit;
    int c = 1 - bit;

    return transpose(mat3x3(
      c,   b,  0,
      0.5, 0,  0.5,
      0,   c,  b
    ));
  }

  mat3x3 winding(int bit){
    int b = bit;
    int c = 1 - bit;

    return mat3x3(
      c, 0, b,
      0, 1, 0,
      b, 0, c
    );
  }

  uint getBitValue(const uint bitField, int bitID){
    return ((bitField >> bitID) & 1u);
  }

  // walks tree and computes the matrix at the same time. Complicates things but no need to index into a bit-field. 
  mat3x3 computeMatrix(float l) {
    int depth = 1;
    float k = 1.0;

    // initialize the matrix
    mat3x3 matrix;
    if(l < getHeap(2.0)) {
      k = 2.0;
      matrix = (square(0));
    }
    else {
      l = l - getHeap(2.0);
      k = 3.0;
      matrix = square(1);
    }

    // traverse the tree
    while(getHeap(k) > 1.0) {
      if(l < getHeap(2.0 * k)) {
        k = 2.0 * k;
        matrix = split(0) * matrix;
      }
      else {
        l = l - getHeap(2.0 * k);
        k = 2.0 * k + 1.0;
        matrix = split(1) * matrix;
      }
      depth++;
    }
    matrix = winding((depth ^ 1) & 1) * matrix;
    return matrix;
  }

  mat3x3 computeMatrixForNode(float node) {
    float depth = getDepth(node);
    float b = max(0.0, depth - 1.0);
    int bit = int(getBitValue(node, b));
    mat3x3 matrix = square(bit);

    for(b = depth - 2.0; b >= 0.0; b--) {
      bit = int(getBitValue(node, b));
      matrix = split(bit) * matrix;
    }

    return matrix;
  }

  mat3x3 subdivideTriangle(mat3x3 matrix, float i, float subdivision) {
    float depth = subdivision;
    // ith node on last level of subdivision
    float node = pow(2.0, depth) + i;

    float b = max(0.0, depth - 1.0);
    int bit = int(getBitValue(node, b));

    for(b = depth - 2.0; b >= 0.0; b--) {
      bit = int(getBitValue(node, b));
      matrix = split(bit) * matrix;
    }

    return matrix;
  }

  vec2 center(mat2x3 triangle) {
    float x = triangle[0][0] + triangle[0][1] + triangle[0][2];
    float y = triangle[1][0] + triangle[1][1] + triangle[1][2];
    return vec2(x, y) / 3.0;
  }

  float nodeDistance(float node){
    // calculate triangle
    mat3x3 matrix = computeMatrixForNode(node);
    mat2x3 faceVertices = mat2x3(vec3(0, 0, 1), vec3(1, 0, 0));
    mat2x3 triangle = matrix * faceVertices;
    
    // average the points: x1+x2+x3/3, y1+y2+y3/3
    vec2 c = center(triangle);

    // calculate the distance
    float d = distance(c, vec2(0.5, 0.5));

    return d;
  }

  bool shouldSplit(float node){
    // return true;
    return 
      nodeDistance(node) <= 0.2
      && nodeDistance(node) - 0.01 <= 0.0075 * (getMaxDepth() - getDepth(node));
  }

  bool shouldMerge(float node){
    // if(node < 1024.0) return false;
    // return nodeDistance(node) > 0.85;
    // return nodeDistance(node) > 0.25;
    return false;
    // return node == 13.0;
  }

  bool isSplit(float k){
    // we don't trust children as they won't be updated yet so we ask grandchildren.
    float g1 = getHeap(left(left(k)));
    float g2 = getHeap(right(left(k)));
    float g3 = getHeap(left(right(k)));
    float g4 = getHeap(right(right(k)));

    float l = g1+g2;
    float r = g3+g4;

    // float l = getHeap(left(k));
    // float r = getHeap(right(k));
    return l > 0.0 && r > 0.0;
  }

  // goes from 2d uv to a 1d float
  float getIndex(vec2 uv){
    float x = floor(vUv.x * width);
    float y = floor(vUv.y * height);
    return y * width + x;
  }
`;

export default utils;

/*
0,1,2
3,4,5
6,7,8
*/

/*
0:0,0
1:1,0
2:2,0
3:0,1
4:1,1
5:2,1
6:0,2
7:1,2
8:2,2


// x = i / width
// y = i % height
// i = y*width + x

*/