import test from 'node:test';import assert from 'node:assert/strict';
import geometry from '../desktop/windows/geometry.cjs';
test('floating window stays reachable after display disconnect and supports negative coordinates',()=>{
 assert.deepEqual(geometry.clampBounds({x:2500,y:1100,width:480,height:560},{x:0,y:0,width:1920,height:1040}),{x:1440,y:480,width:480,height:560});
 assert.deepEqual(geometry.clampBounds({x:-1900,y:-100,width:480,height:112},{x:-1920,y:-200,width:1920,height:1080}),{x:-1900,y:-100,width:480,height:112});
 assert.deepEqual(geometry.clampBounds({x:0,y:0,width:480,height:720},{x:0,y:0,width:400,height:600}),{x:0,y:0,width:400,height:600});
});
