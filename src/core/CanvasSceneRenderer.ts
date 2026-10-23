import * as T from 'three';
import {heightAt,riverX} from '../world/height';
interface Face {xy:number[];depth:number;color:string}
const model=new T.Matrix4(),view=new T.Matrix4(),clip=new T.Matrix4(),position=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3(),instance=new T.Matrix4(),color=new T.Color(),light=new T.Vector3(-.5,1,.4).normalize();
/** Software fallback for WebGL-disabled browsers. Reprojects static geometry only on changes. */
export class CanvasSceneRenderer {
 domElement=document.createElement('canvas');private ctx=this.domElement.getContext('2d')!;private cache=document.createElement('canvas');private cacheCtx=this.cache.getContext('2d')!;private width=1;private height=1;private ratio=1;private signature='';private invalid=true;
 shadowMap={enabled:false,type:T.PCFSoftShadowMap};toneMapping:T.ToneMapping=T.ACESFilmicToneMapping;toneMappingExposure=1;info={render:{calls:0}};
 readonly software=true;
 setPixelRatio(ratio:number){this.ratio=Math.min(1.25,ratio);}
 setSize(w:number,h:number){this.width=w;this.height=h;this.domElement.width=w*this.ratio;this.domElement.height=h*this.ratio;this.domElement.style.width=w+'px';this.domElement.style.height=h+'px';this.cache.width=this.domElement.width;this.cache.height=this.domElement.height;this.invalid=true;}
 invalidate(){this.invalid=true;}
 private project(x:number,y:number,z:number):[number,number,number]{position.set(x,y,z).applyMatrix4(clip);return [(position.x*.5+.5)*this.width,(-position.y*.5+.5)*this.height,position.z];}
 private colorStyle(base:T.Color,n:T.Vector3){const shade=.65+Math.max(0,n.dot(light))*.35;return `rgb(${Math.round(Math.pow(Math.max(0,base.r),1/2.2)*255*shade)},${Math.round(Math.pow(Math.max(0,base.g),1/2.2)*255*shade)},${Math.round(Math.pow(Math.max(0,base.b),1/2.2)*255*shade)})`;}
 private collect(mesh:T.Mesh,faces:Face[],dynamic:boolean){
  if(!mesh.visible||mesh.userData.skipSoftware)return;const g=mesh.geometry,attr=g.getAttribute('position');if(!attr)return;const material=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material) as T.MeshStandardMaterial;
  if(material.opacity===0)return;
  if(mesh.userData.terrain){if(dynamic)return;const step=8;for(let z=-200;z<200;z+=step)for(let x=-200;x<200;x+=step){const cx=x+4,cz=z+4,p=[this.project(x,heightAt(x,z),z),this.project(x,heightAt(x,z+step),z+step),this.project(x+step,heightAt(x+step,z+step),z+step),this.project(x+step,heightAt(x+step,z),z)];if(p.every(v=>v[0]<0)||p.every(v=>v[0]>this.width)||p.every(v=>v[1]<0)||p.every(v=>v[1]>this.height))continue;const d=Math.abs(cx-riverX(cz)),n=Math.sin(cx*.19+cz*.27)*.025+Math.sin(cx*.04)*.025;let r=.48+n,green=.54+n,bl=.33+n;if(d<10){r=.42;green=.46;bl=.32;}faces.push({xy:p.flatMap(p=>[p[0],p[1]]),depth:p.reduce((a,p)=>a+p[2],0)/4,color:`rgb(${r*255},${green*255},${bl*255})`});}return;}
  const count=mesh instanceof T.InstancedMesh?mesh.count:1;
  for(let n=0;n<count;n++){
   if(mesh instanceof T.InstancedMesh){mesh.getMatrixAt(n,instance);model.multiplyMatrices(mesh.matrixWorld,instance);if(mesh.instanceColor)mesh.getColorAt(n,color);else color.copy(material.color??new T.Color(0x7d9789));}else{model.copy(mesh.matrixWorld);color.copy(material.color??new T.Color(0x5f8b80));}
   position.setFromMatrixPosition(model);const center=this.project(position.x,position.y,position.z);if(mesh instanceof T.InstancedMesh&&(center[0]<-70||center[0]>this.width+70||center[1]<-110||center[1]>this.height+110))continue;
   const idx=g.index,triangles=(idx?idx.count:attr.count)/3;
   for(let j=0;j<triangles;j++){
    const ia=idx?idx.getX(j*3):j*3,ib=idx?idx.getX(j*3+1):j*3+1,ic=idx?idx.getX(j*3+2):j*3+2;
    a.fromBufferAttribute(attr,ia).applyMatrix4(model);b.fromBufferAttribute(attr,ib).applyMatrix4(model);c.fromBufferAttribute(attr,ic).applyMatrix4(model);normal.subVectors(b,a);position.subVectors(c,a);normal.cross(position).normalize();
    const pa=this.project(a.x,a.y,a.z),pb=this.project(b.x,b.y,b.z),pc=this.project(c.x,c.y,c.z);if(pa[2]>1&&pb[2]>1&&pc[2]>1)continue;
    const winding=(pb[0]-pa[0])*(pc[1]-pa[1])-(pb[1]-pa[1])*(pc[0]-pa[0]);if(winding>=0&&material.side!==T.DoubleSide)continue;
    faces.push({xy:[pa[0],pa[1],pb[0],pb[1],pc[0],pc[1]],depth:(pa[2]+pb[2]+pc[2])/3,color:this.colorStyle(color,normal)});
   }
  }
 }
 private draw(ctx:CanvasRenderingContext2D,faces:Face[]){faces.sort((a,b)=>b.depth-a.depth);for(const f of faces){const p=f.xy;ctx.beginPath();ctx.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)ctx.lineTo(p[i],p[i+1]);ctx.closePath();ctx.fillStyle=f.color;ctx.strokeStyle=f.color;ctx.lineWidth=.6;ctx.fill();ctx.stroke();}}
 render(scene:T.Scene,camera:T.Camera){scene.updateMatrixWorld();camera.updateMatrixWorld();view.copy(camera.matrixWorldInverse);clip.multiplyMatrices(camera.projectionMatrix,view);const sig=camera.matrixWorld.elements.map(n=>n.toFixed(3)).join(',');
  if(this.invalid||sig!==this.signature){this.signature=sig;this.invalid=false;const faces:Face[]=[],ground:Face[]=[];scene.traverseVisible(o=>{if(!(o instanceof T.Mesh))return;let node:T.Object3D|null=o,dyn=false;while(node){if(node.userData.dynamic)dyn=true;node=node.parent;}if(!dyn)this.collect(o,o.userData.terrain?ground:faces,false);});this.cacheCtx.setTransform(this.ratio,0,0,this.ratio,0,0);this.cacheCtx.fillStyle='#c5ccba';this.cacheCtx.fillRect(0,0,this.width,this.height);this.draw(this.cacheCtx,ground);this.draw(this.cacheCtx,faces);}
  this.ctx.setTransform(1,0,0,1,0,0);this.ctx.drawImage(this.cache,0,0);this.ctx.setTransform(this.ratio,0,0,this.ratio,0,0);const moving:Face[]=[];scene.traverseVisible(o=>{if(!(o instanceof T.Mesh)||o.userData.smoke)return;let node:T.Object3D|null=o,dyn=false;while(node){if(node.userData.dynamic)dyn=true;node=node.parent;}if(dyn)this.collect(o,moving,true);});this.draw(this.ctx,moving);this.info.render.calls=0;
 }
 dispose(){this.cache.width=0;this.cache.height=0;}
}
