import React, {useRef, useState} from 'react';
import {View, StyleSheet, Text} from 'react-native';
import {clampRect, imageFrame} from './cropMath';
import {beginCropDrag, updateCropDrag} from './cropGesture';

// v19: Selection-only overlay. The actual preview image is the normal gallery
// <Image> that remains mounted underneath this component in App.js.
// Do not instantiate another native Image in this component.
const CORNERS=['nw','ne','sw','se'];
const EDGES=['n','e','s','w'];
export default function CropPane({imageSize,rect,setRect}) {
  const [viewer,setViewer]=useState({w:0,h:0});
  const safe=clampRect(rect);
  const frame=imageSize?imageFrame(viewer.w,viewer.h,imageSize.w,imageSize.h):{x:0,y:0,w:0,h:0};
  const latest=useRef(null);
  latest.current={frame,rect:safe};
  const drag=useRef(null);

  const grant=e=>{
    const {frame:f,rect:r}=latest.current;
    const n=e.nativeEvent;
    // The overlay covers the entire square preview. Hit-testing must be
    // relative to the letterboxed image, not to the square container.
    drag.current=beginCropDrag(r,f,{
      locationX:n.locationX-f.x,locationY:n.locationY-f.y,
      pageX:n.pageX,pageY:n.pageY
    });
  };
  const move=e=>{
    const next=updateCropDrag(drag.current,e.nativeEvent);
    if(next)setRect(next);
  };
  const stop=()=>{drag.current=null;};

  return <View
    style={StyleSheet.absoluteFillObject}
    collapsable={false}
    onLayout={e=>{
      const {width,height}=e.nativeEvent.layout;
      setViewer(old=>old.w===width&&old.h===height?old:{w:width,h:height});
    }}
    onStartShouldSetResponder={()=>true}
    onMoveShouldSetResponder={()=>true}
    onResponderTerminationRequest={()=>false}
    onResponderGrant={grant}
    onResponderMove={move}
    onResponderRelease={stop}
    onResponderTerminate={stop}
  >
    {frame.w>0&&frame.h>0 ? <View pointerEvents="none" style={{position:'absolute',left:frame.x,top:frame.y,width:frame.w,height:frame.h}}>
      <View style={[styles.selection,{
        left:safe.x*frame.w,top:safe.y*frame.h,
        width:safe.w*frame.w,height:safe.h*frame.h
      }]}>
        {CORNERS.map(handle=><View key={handle} style={[styles.corner,{
          left:handle.includes('w')?-12:undefined,right:handle.includes('e')?-12:undefined,
          top:handle.includes('n')?-12:undefined,bottom:handle.includes('s')?-12:undefined
        }]}/>)}
        {EDGES.map(handle=><View key={handle} style={[styles.edge,
          handle==='n'&&{top:-5,left:'50%',marginLeft:-11,width:22,height:10},
          handle==='s'&&{bottom:-5,left:'50%',marginLeft:-11,width:22,height:10},
          handle==='w'&&{left:-5,top:'50%',marginTop:-11,width:10,height:22},
          handle==='e'&&{right:-5,top:'50%',marginTop:-11,width:10,height:22}
        ]}/>)}
      </View>
    </View> : <Text style={styles.info}>Preparing crop controls…</Text>}
  </View>;
}
const styles=StyleSheet.create({
  selection:{position:'absolute',borderWidth:2,borderColor:'#2ff7b9',backgroundColor:'#2ff7b929'},
  corner:{position:'absolute',width:24,height:24,borderWidth:2.5,borderColor:'white',backgroundColor:'#0fbe91',borderRadius:5},
  edge:{position:'absolute',borderRadius:4,backgroundColor:'#d9fff6'},
  info:{color:'#fbbf24',fontWeight:'600',fontSize:12,margin:12}
});
