import {fromArrayBuffer} from 'geotiff';
import type {RasterLayer} from './RegionalHeight';
/** North-up EPSG:27700 rasters only. No silent reprojection or invented georeferencing. */
export async function readGeoTIFF(file:File,kind:RasterLayer['kind']):Promise<RasterLayer>{
 if(file.size>160*1024*1024)throw new Error('Use a GeoTIFF tile smaller than 160 MB.');
 const tiff=await fromArrayBuffer(await file.arrayBuffer()),image=await tiff.getImage(),keys=image.getGeoKeys();
 if(Number(keys?.ProjectedCSTypeGeoKey)!==27700)throw new Error('Import a north-up EPSG:27700 (British National Grid) GeoTIFF. Reproject other coordinate systems first.');
 if(image.fileDirectory.getValue('ModelTransformation'))throw new Error('Rotated rasters must be resampled to a north-up GeoTIFF.');
 const [minE,minN,maxE,maxN]=image.getBoundingBox();if(!Number.isFinite(minE)||maxE<=minE||maxN<=minN)throw new Error('The raster has no usable georeferencing.');
 const w=image.getWidth(),h=image.getHeight(),scale=Math.min(1,1025/Math.max(w,h)),width=Math.max(2,Math.round(w*scale)),height=Math.max(2,Math.round(h*scale));
 const data=await image.readRasters({samples:[0],width,height,interleave:true,resampleMethod:image.getGDALNoData()===null?'bilinear':'nearest'});
 const values=Float32Array.from(data as ArrayLike<number>);return {data:values,width,height,minE:minE+(Number(keys?.GTRasterTypeGeoKey)===2?0:(maxE-minE)/width/2),maxN:maxN-(Number(keys?.GTRasterTypeGeoKey)===2?0:(maxN-minN)/height/2),stepE:(maxE-minE)/width,stepN:(maxN-minN)/height,name:file.name,kind,noData:image.getGDALNoData()};
}
