import React, {useEffect, useRef, useState} from 'react';
import {Image as NativeImage, View, Text, Pressable, StyleSheet} from 'react-native';
import {clampRect, imageFrame} from './cropMath';
import {beginCropDrag,updateCropDrag} from './cropGesture';

const CORNERS = ['nw', 'ne', 'sw', 'se'];
const EDGES = ['n', 'e', 's', 'w'];

// The gesture surface and the displayed bitmap are the same native View.
// The previous full-screen transparent sibling PanResponder sometimes failed
// to receive touches on Android, even though its crop handles were drawn.
export default function CropPane({uri,imageSize,rect,setRect,onApply,onCancel}) {
  const [viewer,setViewer] = useState({w:0,h:0});
  const [source,setSource] = useState(imageSize || null);
  const [previewError,setPreviewError] = useState(null);
  const [previewLoaded,setPreviewLoaded] = useState(false);
  const dragRef = useRef(null);
  const latestRef = useRef({rect:clampRect(rect),frame:{w:0,h:0}});

  useEffect(()=>{
    setSource(imageSize||null);
    setPreviewError(null);
    setPreviewLoaded(false);
    dragRef.current=null;
  },[uri,imageSize?.w,imageSize?.h]);

  const frame = source ? imageFrame(viewer.w,viewer.h,source.w,source.h) : {x:0,y:0,w:0,h:0};
  const safe = clampRect(rect);
  latestRef.current = {rect:safe,frame};

  // React Native responder events use pageX/pageY for the drag delta.
  // locationX/locationY are relative to the exact image-sized touch surface
  // (rather than the letterboxed preview), allowing reliable hit tests.
  const onGrant = e => {
    const {rect:r,frame:f} = latestRef.current;
    dragRef.current = beginCropDrag(r,f,e.nativeEvent);
  };
  const onMove = e => {
    const next=updateCropDrag(dragRef.current,e.nativeEvent);
    if(next)setRect(next);
  };
  const stopDrag = () => {dragRef.current=null;};
  const onImageLoaded = e => {
    setPreviewLoaded(true);
    setPreviewError(null);
    if(!imageSize){
      const {width,height}=e.nativeEvent?.source||{};
      if(width>0 && height>0)
        setSource(old=>old?.w===width&&old?.h===height?old:{w:width,h:height});
    }
  };
  const onImageError = e => {
    setPreviewLoaded(false);
    setPreviewError(e.nativeEvent?.error||'The crop image could not be loaded.');
  };

  return <View style={styles.root}>
    <Text style={styles.title}>CROP · 4 draggable corners</Text>
    <View style={styles.viewer} onLayout={e=>{
      const {width,height}=e.nativeEvent.layout;
      if(width!==viewer.w||height!==viewer.h)setViewer({w:width,h:height});
    }}>
      {frame.w>0 && frame.h>0 ? <View
        collapsable={false}
        style={{position:'absolute',left:frame.x,top:frame.y,width:frame.w,height:frame.h,backgroundColor:'transparent'}}
        onStartShouldSetResponderCapture={()=>true}
        onMoveShouldSetResponderCapture={()=>true}
        onStartShouldSetResponder={()=>true}
        onMoveShouldSetResponder={()=>true}
        onResponderTerminationRequest={()=>false}
        onResponderGrant={onGrant}
        onResponderMove={onMove}
        onResponderRelease={stopDrag}
        onResponderTerminate={stopDrag}
      >
        <NativeImage
          key={uri}
          source={{uri}}
          resizeMode="stretch"
          style={StyleSheet.absoluteFillObject}
          onLoad={onImageLoaded}
          onError={onImageError}
        />
        <View pointerEvents="none" style={[styles.selection,{
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
      </View> : <NativeImage
        key={uri}
        source={{uri}}
        resizeMode="contain"
        style={StyleSheet.absoluteFillObject}
        onLoad={onImageLoaded}
        onError={onImageError}
      />}
      {previewError && <View style={styles.error} pointerEvents="none">
        <Text style={styles.errorTitle}>Cannot load the crop preview</Text>
        <Text style={styles.errorDetail}>{String(previewError)}</Text>
        <Text style={styles.errorDetail}>The original image has not been modified. Press Cancel and try again.</Text>
      </View>}
    </View>
    <Text style={styles.hint}>Drag any corner or edge to resize, or drag inside the rectangle to move it. Selection stays aligned to the image, not the letterboxed preview. The rectangle is reused on the next image.</Text>
    <View style={styles.row}>
      <Pressable onPress={onCancel} style={styles.secondary}><Text style={styles.buttonText}>Cancel</Text></Pressable>
      <Pressable disabled={!source||!previewLoaded||!!previewError} onPress={()=>onApply(source)} style={[styles.primary,(!source||!previewLoaded||!!previewError)&&{opacity:.5}]}><Text style={styles.buttonText}>Apply crop</Text></Pressable>
    </View>
  </View>;
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#070b14',padding:12,minHeight:0},
  title:{color:'#e5e7eb',fontWeight:'700',fontSize:15,marginBottom:12},
  viewer:{flex:1,position:'relative',overflow:'hidden',minHeight:0},
  selection:{position:'absolute',borderWidth:2,borderColor:'#2ff7b9',backgroundColor:'#2ff7b929'},
  corner:{position:'absolute',width:24,height:24,borderWidth:2.5,borderColor:'white',backgroundColor:'#0fbe91',borderRadius:5},
  edge:{position:'absolute',borderRadius:4,backgroundColor:'#d9fff6'},
  error:{position:'absolute',top:16,left:12,right:12,backgroundColor:'#461a2cee',borderRadius:10,padding:12,gap:6},
  errorTitle:{color:'#fff',fontWeight:'800'},
  errorDetail:{color:'#fdd',fontSize:12},
  hint:{color:'#9ca3af',marginVertical:12,fontSize:12,lineHeight:17},
  row:{flexDirection:'row',gap:12},
  secondary:{flex:1,backgroundColor:'#293142',padding:14,borderRadius:12,alignItems:'center'},
  primary:{flex:1,backgroundColor:'#087d65',padding:14,borderRadius:12,alignItems:'center'},
  buttonText:{color:'white',fontWeight:'700'}
});
