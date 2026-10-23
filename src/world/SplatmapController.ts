import * as T from 'three';
export class SplatmapController {
 readonly size=256; readonly a=new Uint8Array(256*256*4); readonly b=new Uint8Array(256*256*4);
 readonly textureA=new T.DataTexture(this.a,256,256); readonly textureB=new T.DataTexture(this.b,256,256);
 winter={value:0};
 constructor(){for(let i=0;i<this.a.length;i+=4)this.a[i]=255;for(const t of [this.textureA,this.textureB]){t.magFilter=T.LinearFilter;t.minFilter=T.LinearFilter;t.needsUpdate=true;}}
 paint(x:number,z:number,radius:number,channel:number,strength=1) {
  const cx=(x/400+.5)*256,cy=(z/400+.5)*256,rr=radius/400*256,buf=channel<4?this.a:this.b,c=channel%4;
  for(let j=Math.max(0,Math.floor(cy-rr));j<Math.min(256,cy+rr);j++)for(let i=Math.max(0,Math.floor(cx-rr));i<Math.min(256,cx+rr);i++){
   const weight=Math.max(0,1-Math.hypot(i-cx,j-cy)/rr)*strength,k=(j*256+i)*4;buf[k+c]=Math.max(buf[k+c],Math.round(weight*255));}
  (channel<4?this.textureA:this.textureB).needsUpdate=true;
 }
 material() {
  const mat=new T.MeshStandardMaterial({color:0xffffff,roughness:1});
  mat.onBeforeCompile=shader=>{
   shader.uniforms.uSplatA={value:this.textureA};shader.uniforms.uSplatB={value:this.textureB};shader.uniforms.uWinter=this.winter;
   shader.vertexShader='varying vec3 vGround;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGround = position;');
   shader.fragmentShader=`uniform sampler2D uSplatA;uniform sampler2D uSplatB;uniform float uWinter;varying vec3 vGround;
float hashGround(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noiseGround(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hashGround(i),hashGround(i+vec2(1.,0.)),f.x),mix(hashGround(i+vec2(0.,1.)),hashGround(i+1.),f.x),f.y);}
`+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec2 groundUV=vGround.xz/400.+.5;
 vec4 s=texture2D(uSplatA,groundUV);vec4 t=texture2D(uSplatB,groundUV);
 float n=noiseGround(vGround.xz*.14),fine=noiseGround(vGround.xz*2.7);
 vec3 grass=mix(vec3(.28,.36,.19),vec3(.51,.56,.29),n);
 vec3 col=mix(grass,vec3(.40,.31,.19),s.g);
 col=mix(col,vec3(.35,.32,.24),s.b);col=mix(col,vec3(.48,.46,.38),s.a);
 col=mix(col,vec3(.23,.24,.20),t.r*.75);
 col=mix(col,vec3(.85,.86,.79),max(t.g,uWinter*(.6+.4*n)));
 diffuseColor.rgb=col*(.90+.15*fine);
`);
  };return mat;
 }
}
