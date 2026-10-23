import {MeshStandardNodeMaterial} from 'three/webgpu';
import {attribute,mix,vec3,positionLocal,uniform} from 'three/tsl';
export function terrainNodeMaterial(){
 const material=new MeshStandardNodeMaterial({roughness:1}),morph=uniform(0),a=attribute('splatA','vec4'),b=attribute('splatB','vec4');
 let color=mix(vec3(.38,.46,.27),vec3(.38,.46,.27),0);
 color=mix(color,vec3(.43,.36,.40),a.y); // Heather
 color=mix(color,vec3(.28,.29,.20),a.z); // Peat
 color=mix(color,vec3(.36,.31,.23),a.w); // Mud
 color=mix(color,vec3(.22,.25,.23),b.x); // Soot
 color=mix(color,vec3(.52,.53,.46),b.y); // Cobble
 color=mix(color,vec3(.51,.52,.47),b.z); // Rock
 color=mix(color,vec3(.88,.91,.88),b.w); // Snow
 material.colorNode=color;
 material.positionNode=vec3(positionLocal.x,mix(positionLocal.y,attribute('parentHeight','float'),morph),positionLocal.z);
 return {material,morph};
}
