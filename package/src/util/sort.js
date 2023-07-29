import glsl from "glslify";

/*
    performs a inline sort on a vec2 array [[index, weight], ...] of length n in descending order eg 8,3,1...
    usage: 
        vec2[2] weights = vec2[2](vec2(0,0.5), vec2(1,0.3));
        ${sort("weights")} 
*/
export default function sort(arr = "A") {
    return glsl`
        for(int i=1; i<${arr}.length(); i++){
          int j = i;
          // sorts vec2 by weight value [1]
          while(j > 0 && ${arr}[j-1][1] < ${arr}[j][1]){
            vec2 a = ${arr}[j]; 
            ${arr}[j] = ${arr}[j-1];
            ${arr}[j-1] = a; 
            j = j-1;
          }
        }
      `;
}