const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const math=fs.readFileSync(path.join(__dirname,'../src/gestureMath.js'),'utf8')
  .replace("import {chooseDirection} from './model';",`const DIRS=['N','NE','E','SE','S','SW','W','NW'];
    function chooseDirection(dx,dy){const angle=(Math.atan2(dx,-dy)*180/Math.PI+360)%360;return DIRS[Math.round(angle/45)%8];}`)
  .replace(/export /g,'');
const c={};vm.createContext(c);
vm.runInContext(math+'\nthis.api={selectedDirectionAt,availableDirectionAt};',c);
const {selectedDirectionAt,availableDirectionAt}=c.api;
const center={x:200,y:350};
function at(dx,dy,children={},mode='sort'){
 return availableDirectionAt(center.x+dx,center.y+dy,center.x,center.y,children,mode,42,180);
}
assert.equal(at(0,-105,{N:{name:'up'}}),'N');
assert.equal(at(100,-100,{NE:{name:'up-right'}}),'NE');
assert.equal(at(110,0,{E:{}}),'E');
assert.equal(at(100,100,{SE:{}}),'SE');
assert.equal(at(0,110,{S:{}}),'S');
assert.equal(at(-100,100,{SW:{}}),'SW');
assert.equal(at(-110,0,{W:{}}),'W');
assert.equal(at(-100,-100,{NW:{}}),'NW');
assert.equal(at(0,0,{N:{}}),null,'returning to center cancels');
assert.equal(at(15,3,{E:{}}),null,'stay in center deadzone cancels');
assert.equal(at(110,0,{N:{}}),null,'unused segment cancels');
assert.equal(at(200,0,{E:{}}),null,'finger outside preview cancels');
assert.equal(at(110,0,{},'edit'),'E','unconfigured directions editable');
assert.equal(selectedDirectionAt(NaN,1,0,0),null,'invalid touch not selected');
// A non-monotonic movement over all segments must track the CURRENT finger,
// not stick to the first direction or the net displacement at the end.
const children={N:{},E:{},S:{},W:{}};
const track=[[0,-100],[100,0],[-100,0],[0,100],[0,0],[0,-100]]
  .map(([x,y])=>at(x,y,children));
assert.deepEqual(track,['N','E','W','S',null,'N']);
const screen=fs.readFileSync(path.join(__dirname,'../App.js'),'utf8');
assert.match(screen,/const radialPanRef=useRef\(null\)/,'responder must persist across re-renders');
assert.match(screen,/onPanResponderMove:[\s\S]*?setActive\(direction\)/);
assert.match(screen,/onPanResponderRelease:[\s\S]*?availableDirectionAt/);
assert.match(screen,/pointerEvents=\{mode==='sort'\?'none':'auto'\}/);
console.log('PASS: 8 directions, continuous selection, cancellation zones, stable responder, release-at-current-position');
