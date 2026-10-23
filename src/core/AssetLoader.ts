import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
/** Optional GLB replacement hook. Procedural buildings remain the default. */
export class AssetLoader {
 private loader=new GLTFLoader(); private cache=new Map<string,Promise<T.Group>>();
 load(name:string):Promise<T.Group> {let entry=this.cache.get(name);if(!entry){entry=this.loader.loadAsync(`/assets/${name}.glb`).then(g=>g.scene);this.cache.set(name,entry);}return entry;}
}
