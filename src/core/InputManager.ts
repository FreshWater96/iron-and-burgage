import * as T from 'three';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const ndc=new T.Vector2();
export class InputManager {
 ray=new T.Raycaster();point=new T.Vector3();hasPoint=false;keys=new Set<string>();downX=0;downY=0;
 onClick:(point:T.Vector3)=>void=()=>{};onMove:(point:T.Vector3)=>void=()=>{};onKey:(key:string)=>void=()=>{};
 constructor(private canvas:HTMLCanvasElement,private camera:T.Camera,private terrain:T.Mesh,private controls:OrbitControls){
  this.ray.firstHitOnly=true;canvas.addEventListener('pointerdown',this.down);canvas.addEventListener('pointerup',this.up);canvas.addEventListener('pointermove',this.move);window.addEventListener('keydown',this.keydown);window.addEventListener('keyup',this.keyup);window.addEventListener('blur',this.blur);
 }
 private down=(e:PointerEvent)=>{this.downX=e.clientX;this.downY=e.clientY;};
 private up=(e:PointerEvent)=>{if(e.button!==0||Math.hypot(this.downX-e.clientX,this.downY-e.clientY)>5)return;if(this.project(e))this.onClick(this.point);};
 private move=(e:PointerEvent)=>{if(this.project(e))this.onMove(this.point);};
 private project(e:PointerEvent){const r=this.canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(ndc,this.camera);const hits=this.ray.intersectObject(this.terrain,false);this.hasPoint=!!hits.length;if(hits[0])this.point.copy(hits[0].point);return this.hasPoint;}
 private keydown=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.matches('input,textarea,select'))return;this.keys.add(e.key.toLowerCase());if([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault();if(!e.repeat)this.onKey(e.key.toLowerCase());};
 private keyup=(e:KeyboardEvent)=>this.keys.delete(e.key.toLowerCase());private blur=()=>this.keys.clear();
 update(dt:number){let dx=0,dz=0;const s=dt*65;if(this.keys.has('w')||this.keys.has('arrowup'))dz-=s;if(this.keys.has('s')||this.keys.has('arrowdown'))dz+=s;if(this.keys.has('a')||this.keys.has('arrowleft'))dx-=s;if(this.keys.has('d')||this.keys.has('arrowright'))dx+=s;if(dx||dz){this.camera.position.x+=dx;this.camera.position.z+=dz;this.controls.target.x+=dx;this.controls.target.z+=dz;}}
 dispose(){this.canvas.removeEventListener('pointerdown',this.down);this.canvas.removeEventListener('pointerup',this.up);this.canvas.removeEventListener('pointermove',this.move);window.removeEventListener('keydown',this.keydown);window.removeEventListener('keyup',this.keyup);window.removeEventListener('blur',this.blur);}
}
