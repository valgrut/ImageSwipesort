import React, {useState, useEffect} from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export default function VideoPane({uri, gestureOverlay}) {
  const player=useVideoPlayer(uri, p=>{p.loop=false;p.timeUpdateEventInterval=0.25;});
  const [position,setPosition]=useState(0);
  const [length,setLength]=useState(0);
  const [playing,setPlaying]=useState(false);
  useEffect(()=>{
    const p=player.addListener('timeUpdate',x=>setPosition(x.currentTime));
    const q=player.addListener('statusChange',()=>setLength(player.duration || 0));
    const r=player.addListener('playingChange',x=>setPlaying(x.isPlaying));
    return ()=>{p.remove();q.remove();r.remove();};
  },[player]);
  const seekRatio = length ? Math.min(1,position/length):0;
  function time(t) { return `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`; }
  return <View style={styles.fill}>
    <VideoView player={player} style={styles.video} contentFit="contain" nativeControls={false} surfaceType="textureView" />
    {gestureOverlay}
    <View style={styles.controls}>
      <Pressable onPress={()=>playing?player.pause():player.play()} style={styles.play}><Text style={styles.white}>{playing?'Ⅱ':'▶'}</Text></Pressable>
      <View style={styles.track} onStartShouldSetResponder={()=>true} onMoveShouldSetResponder={()=>true}
        onResponderGrant={e=>{const w=e.nativeEvent.pageX; /* seek via onLayout measured below */}}
        onResponderRelease={e=>{if(trackWidth && length) player.currentTime=Math.max(0,Math.min(length,(e.nativeEvent.locationX/trackWidth)*length));}}
        onLayout={e=>{trackWidth=e.nativeEvent.layout.width;}}>
        <View style={[styles.progress,{width:`${seekRatio*100}%`}]}/>
      </View>
      <Text style={styles.timestamp}>{time(position)}/{time(length)}</Text>
    </View>
  </View>;
}
let trackWidth=0;
const styles=StyleSheet.create({fill:{flex:1},video:{flex:1},controls:{height:46,flexDirection:'row',alignItems:'center',paddingHorizontal:8,backgroundColor:'#0b101ccf',gap:10},play:{paddingHorizontal:4,paddingVertical:6},white:{color:'#fff',fontSize:18},timestamp:{color:'#cad1e0',fontSize:11},track:{flex:1,height:10,borderRadius:9,backgroundColor:'#4b5563',overflow:'hidden'},progress:{height:10,backgroundColor:'#60a5fa'}});
