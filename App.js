import React, {useEffect,useMemo,useRef,useState} from 'react';
import { ActivityIndicator, Alert, Animated, Image as RNImage, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {Image} from 'expo-image';
import Svg, {Path} from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import {Directory,File,Paths} from 'expo-file-system';
import VideoPane from './src/VideoPane';
import {openVideoCutter, deleteCutOutput} from './src/videoCut';
import CropPane from './src/CropPane';
import {cropPixels} from './src/cropMath';
import {describeUndo,historyAfterTagRename} from './src/undoPreview';
import {normalizeTag,hasTag,toggleTag} from './src/tags';
import {scanDestinationIssues,missingDestinationsMessage} from './src/presetBackup';
import {exportSetup,pickImportedSetup} from './src/presetIO';
import {ROOT, DIRS, COLOR_PALETTE, ICON_PALETTE, cloneTree, nodeAt, nextId, chooseDirection, displayPath, displayFileName, safeName, isVideo, isImage} from './src/model';
import {availableDirectionAt} from './src/gestureMath';
import {pickFolder,listMedia,transfer,softDelete,emptyTrash,clearCropBackups,renameMedia,replaceWithCrop,replaceWithCut,clearVideoCutBackups,listVideoCutBackups,recoverVideoBackup,undoOp,readFile} from './src/storage';

const KEY='imagekeysort-mobile-state-v1';
const demoAssets=[require('./assets/demo1.jpg'),require('./assets/demo2.jpg'),require('./assets/demo3.jpg')];
const defaultCrop={x:0.10,y:0.08,w:0.80,h:0.83};
const theme={bg:'#090f1c',pane:'#101a2a',line:'#27344b',fg:'#f3f5fa',muted:'#90a0b7',blue:'#3b82f6',green:'#34d399'};
function short(s,n=16) { return s?.length>n?s.slice(0,n-1)+'…':(s||''); }
function pressStyle(bg,wide) {return {borderRadius:10,backgroundColor:bg,paddingVertical:11,paddingHorizontal:13,minWidth:wide||0,alignItems:'center',justifyContent:'center'};}
function LabelButton({label,onPress,onLongPress,onPressIn,onPressOut,delayLongPress,bg='#27344b',disabled=false,style,compact=false}) {return <Pressable disabled={disabled} onPress={onPress} onLongPress={onLongPress} onPressIn={onPressIn} onPressOut={onPressOut} delayLongPress={delayLongPress} accessibilityRole="button" accessibilityLabel={label} style={[pressStyle(bg),{opacity:disabled?.35:1},compact&&{paddingHorizontal:4,paddingVertical:11,minWidth:0},style]}><Text numberOfLines={1} adjustsFontSizeToFit style={{color:'white',fontWeight:'700',fontSize:compact?11:13,textAlign:'center'}}>{label}</Text></Pressable>}
function ModalFrame({title,onClose,children}) {return <Modal transparent statusBarTranslucent animationType="fade" visible onRequestClose={onClose}><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={styles.modalCover}><View style={styles.modal}><View style={styles.modalTitle}><Text style={styles.titleText}>{title}</Text><Pressable onPress={onClose}><Text style={styles.muted}>✕</Text></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:13,paddingBottom:12}}>{children}</ScrollView></View></KeyboardAvoidingView></Modal>}
function Field({label,value,onChangeText,keyboardType,placeholder}) {return <View style={{gap:5}}><Text style={styles.fieldLabel}>{label}</Text><TextInput style={styles.input} placeholderTextColor="#64748b" placeholder={placeholder} value={value} onChangeText={onChangeText} keyboardType={keyboardType} autoCorrect={false}/></View>}
function directionPath(cx,cy,r,start,end) {
  const a=(t,rad)=>[cx+Math.sin(t)*rad,cy-Math.cos(t)*rad];
  const p1=a(start,r),p2=a(end,r);
  return `M ${cx} ${cy} L ${p1[0]} ${p1[1]} A ${r} ${r} 0 0 1 ${p2[0]} ${p2[1]} Z`;
}

function ImageKeysortScreen() {
  const {width:screenW}=useWindowDimensions();
  const square=Math.min(screenW-20,470);
  const radius=square*0.325;
  const [tree,setTree]=useState(cloneTree(ROOT));
  const [sourceUri,setSourceUri]=useState(null);
  const [files,setFiles]=useState([]);
  const [index,setIndex]=useState(0);
  const [mode,setMode]=useState('sort');
  const [path,setPath]=useState([]);
  const [opened,setOpened]=useState(false);
  const [active,setActive]=useState(null);
  const [copyOnly,setCopyOnly]=useState(false);
  const [editor,setEditor]=useState(null);
  const [form,setForm]=useState(null);
  const [rename,setRename]=useState(false);
  const [renameText,setRenameText]=useState('');
  const [tags,setTags]=useState([]);
  const [tagPanel,setTagPanel]=useState(false);
  const [newTagDialog,setNewTagDialog]=useState(false);
  const [newTagText,setNewTagText]=useState('');
  const [jump,setJump]=useState(false);
  const [jumpText,setJumpText]=useState('');
  const [settings,setSettings]=useState(false);
  const [cropMode,setCropMode]=useState(false);
  const [cropPreview,setCropPreview]=useState(null);
  const [cropRect,setCropRect]=useState(defaultCrop);
  const [presets,setPresets]=useState({});
  const [destinationIssues,setDestinationIssues]=useState([]);
  const [recoveryPanel,setRecoveryPanel]=useState(false);
  const [videoBackups,setVideoBackups]=useState([]);
  const [presetName,setPresetName]=useState(null);
  const [presetAction,setPresetAction]=useState('save');
  const [history,setHistory]=useState([]);
  const [showUndoPreview,setShowUndoPreview]=useState(false);
  const suppressUndoTap=useRef(false);
  const [busy,setBusy]=useState(false);
  const [mediaRevision,setMediaRevision]=useState(0);
  const [zoom,setZoom]=useState(1);
  const [pan,setPan]=useState({x:0,y:0});
  const pinchStart=useRef(null);
  const canvasTop=useRef(80);
  const panStart=useRef({x:0,y:0});
  // Persistent state across touch events. A new PanResponder every render lost
  // the gesture when a highlight update re-rendered the screen.
  const radialLatest=useRef(null);
  const radialOrigin=useRef({x:0,y:0});
  const radialSelected=useRef(null);
  const [loaded,setLoaded]=useState(false);
  const [notice,setNotice]=useState('');
  const anim=useRef(new Animated.Value(0)).current;
  const loadedRef=useRef(false);
  const busyRef=useRef(false);
  const originRef=useRef({x:0,y:0});
  const current=files[index] || null;
  const currentNode=nodeAt(tree,path) || tree;
  const children=currentNode.children || {};
  const demo=!sourceUri;
  const badIds=useMemo(()=>new Set(destinationIssues.map(x=>x.id)),[destinationIssues]);
  const undoPreview=useMemo(()=>describeUndo(history[history.length-1],sourceUri),[history,sourceUri]);
  function destinationAccessible(uri) {
    try {
      const dir=new Directory(uri);
      return dir.exists && Array.isArray(dir.list());
    } catch { return false; }
  }
  function checkDestinations(nextTree,showWarning=false) {
    const issues=scanDestinationIssues(nextTree,destinationAccessible);
    setDestinationIssues(issues);
    if(showWarning&&issues.length)Alert.alert('⚠ Unavailable swipe destinations',missingDestinationsMessage(issues));
    return issues;
  }
  useEffect(()=>{checkDestinations(tree,false);},[tree]);

  const localDemo=useMemo(()=>demoAssets.map((a,i)=>({uri:RNImage.resolveAssetSource(a).uri,name:['Travel_001.jpg','IG_screenshot_002.jpg','Saved_picture_003.jpg'][i],size:[242102,184322,321245][i],demo:true})),[]);
  useEffect(()=>{(async()=>{try{
    const raw=await AsyncStorage.getItem(KEY);
    if(raw){const s=JSON.parse(raw);setTree(s.tree||cloneTree(ROOT));setMode(s.mode||'sort');setSourceUri(s.sourceUri||null);setPresets(s.presets||{});setTags(Array.isArray(s.tags)?s.tags:[]);setHistory(s.history||[]);setCopyOnly(!!s.copyOnly);setCropRect(s.cropRect||defaultCrop);
      if(s.sourceUri){try{setFiles(listMedia(s.sourceUri));}catch(e){setSourceUri(null);setNotice('Please select your source folder again.');}}else setFiles(localDemo);
    }else setFiles(localDemo);
    }catch(e){setFiles(localDemo);}finally{loadedRef.current=true;setLoaded(true);}})();},[]);
  useEffect(()=>{if(!loadedRef.current)return;AsyncStorage.setItem(KEY,JSON.stringify({tree,sourceUri,mode,copyOnly,presets,tags,history,cropRect})).catch(()=>{});},[tree,sourceUri,mode,copyOnly,presets,tags,history,cropRect]);
  useEffect(()=>{Animated.timing(anim,{toValue:opened||path.length>0||mode==='edit'?1:0,duration:140,useNativeDriver:false}).start();},[opened,path.length,mode]);
  useEffect(()=>{setZoom(1);setPan({x:0,y:0});},[index,sourceUri]);
  function error(e) {Alert.alert('Operation failed',String(e?.message||e));}
  async function working(task){ if(busyRef.current)return;busyRef.current=true;setBusy(true);try{await task();}catch(e){error(e);}finally{busyRef.current=false;setBusy(false);} }
  function refresh(uri=sourceUri,preferred=index) { if(!uri){setFiles(localDemo);setIndex(Math.min(preferred,localDemo.length-1));return;} const list=listMedia(uri);setFiles(list);setIndex(Math.min(Math.max(0,preferred),Math.max(0,list.length-1))); }
  async function chooseSource() { await working(async()=>{const uri=await pickFolder();if(!uri)return;const entries=listMedia(uri);setSourceUri(uri);setFiles(entries);setIndex(0);setPath([]);setOpened(false);setHistory([]);setNotice(`${entries.length} media files loaded`);}); }
  async function chooseDestination(){ try{const uri=await pickFolder();if(uri)setForm(f=>({...f,destination:uri}));}catch(e){error(e);} }
  function navigate(delta) { if(!files.length)return;setIndex(i=>Math.min(files.length-1,Math.max(0,i+delta))); }
  function openEditor(dir) {
    const node=children[dir];
    setEditor(dir);
    setForm(node?{...node,children:node.children||{},direction:dir}:{id:nextId(),name:'',icon:'📁',color:COLOR_PALETTE[0],destination:null,locked:false,children:{},direction:dir});
  }
  function saveEditor() {
    if(!form?.name.trim()){Alert.alert('Enter a label','Give this swipe a short name.');return;}
    const dir=form.direction;
    const old=children[editor];
    if(old?.locked && dir!==editor){Alert.alert('Locked','Unlock this swipe before moving it.');return;}
    if(dir!==editor && children[dir]){Alert.alert('Position occupied','Choose an empty direction.');return;}
    const next=cloneTree(tree);const parent=nodeAt(next,path);
    const {direction,...updated}=form;
    if(editor!==dir)delete parent.children[editor];
    parent.children[dir]={...updated,name:form.name.trim()};
    setTree(next);setEditor(null);setForm(null);
  }
  function askDeleteDirection(dir){ const item=children[dir];Alert.alert('Delete swipe',`Delete “${item?.name}” and all nested swipes?`,[{text:'Cancel',style:'cancel'},{text:'Delete tree',style:'destructive',onPress:()=>{const next=cloneTree(tree);delete nodeAt(next,path).children[dir];setTree(next);}}]); }
  function enterLevel(dir){setOpened(false);setActive(null);Animated.sequence([Animated.timing(anim,{toValue:0,duration:110,useNativeDriver:false})]).start(()=>{setPath(p=>[...p,dir]);Animated.timing(anim,{toValue:1,duration:160,useNativeDriver:false}).start();});}
  function goBack(){if(path.length){Animated.timing(anim,{toValue:0,duration:90,useNativeDriver:false}).start(()=>{setPath(p=>p.slice(0,-1));setOpened(false);Animated.timing(anim,{toValue:1,duration:160,useNativeDriver:false}).start();});}}
  function nodeAction(dir){
    const node=children[dir];
    if(mode==='edit') {if(node){Alert.alert(node.name,'Choose an action',[{text:'Modify',onPress:()=>openEditor(dir)},{text:'Add sub-swipes',onPress:()=>enterLevel(dir)},{text:'Delete',style:'destructive',onPress:()=>askDeleteDirection(dir)},{text:'Cancel',style:'cancel'}]);}else openEditor(dir);return;}
    if(!node)return;
    if(Object.keys(node.children||{}).length)enterLevel(dir);
    else if(node.destination){
      if(badIds.has(node.id)||!destinationAccessible(node.destination)) {
        checkDestinations(tree,false);
        Alert.alert('⚠ Unavailable destination',`“${node.name}” points to a missing or inaccessible folder. Open Edit mode → Modify and choose a new destination.`);
      } else sortCurrent(node.destination);
    }
    else setNotice('This swipe is a container without destination or children.');
  }
  async function sortCurrent(target){if(!current||!target)return;await working(async()=>{
    if(!demo&&!destinationAccessible(target))throw new Error('Destination folder is missing or inaccessible. Use Edit mode → Modify to select a valid directory.');
    if(demo){if(!copyOnly){setFiles(arr=>arr.filter((_,i)=>i!==index));setIndex(i=>Math.max(0,Math.min(i,files.length-2)));}else navigate(1);setHistory(h=>[...h,{type:'demo',file:current,at:index,copy:copyOnly,toDirUri:target,sourceUri}]);setPath([]);setOpened(false);setNotice(`File ${copyOnly?'copied':'moved'} to ${displayPath(target)} (demo)`);return;}
    const op=await transfer(current,target,copyOnly);setHistory(h=>[...h,{...op,sourceUri}]);
    if(op.warning)Alert.alert('Partial move',op.warning);
    if(op.type==='copy')navigate(1);else refresh(sourceUri,index);
    setPath([]);setOpened(false);setNotice(`File ${op.type==='copy'?'copied':'moved'} to ${displayPath(target)}`);
  });}
  async function deleteCurrent(){if(!current)return;Alert.alert('Delete file','Move this file to the app recycle bin? You can undo it.',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>working(async()=>{if(demo){setHistory(h=>[...h,{type:'demo',file:current,at:index,copy:false}]);setFiles(a=>a.filter((_,i)=>i!==index));setIndex(i=>Math.max(0,Math.min(i,files.length-2)));return;}const op=await softDelete(current);setHistory(h=>[...h,{...op,sourceUri}]);refresh(sourceUri,index);})}]);}
  async function undo(){if(busyRef.current)return;const op=history[history.length-1];if(!op)return;setShowUndoPreview(false);await working(async()=>{
    if(op.type==='demo'){if(!op.copy){const copy=[...files];copy.splice(op.at,0,op.file);setFiles(copy);setIndex(op.at);}}
    else if(op.type==='demoRename'){setFiles(a=>a.map((f,i)=>i===op.at?{...f,name:op.oldName}:f));}
    else await undoOp(op,op.sourceUri);
    setHistory(h=>h.slice(0,-1));if(!demo){refresh(sourceUri,Math.max(0,index));setMediaRevision(v=>v+1);}setNotice('Last operation undone');
  });}
  function renameFile(){if(!current)return;const s=safeName(renameText);if(!s){Alert.alert('Invalid name');return;}if(s===current.name||s===displayFileName(current.name)){setRename(false);return;}
    if(!demo && files.some(f=>f.uri!==current.uri&&f.name.toLowerCase()===s.toLowerCase())){Alert.alert('Name already exists');return;}
    working(async()=>{if(demo){setFiles(a=>a.map((f,i)=>i===index?{...f,name:s}:f));setHistory(h=>[...h,{type:'demoRename',oldName:current.name,at:index}]);}else{
      const op=await renameMedia(current,s,sourceUri);
      if(op){setHistory(h=>[...h,op]);const updated=listMedia(sourceUri);setFiles(updated);const position=updated.findIndex(f=>f.uri===op.afterUri || f.name===s);setIndex(position>=0?position:Math.min(index,updated.length-1));}
    }setRename(false);});}
  function addTag() {
    let value;
    try { value=normalizeTag(newTagText); }
    catch(e){Alert.alert('Invalid tag',e.message);return;}
    if(tags.includes(value)){Alert.alert('Tag already exists', 'This tag is already in your list.');return;}
    setTags(old=>[...old,value]);
    setNewTagDialog(false);
    setTagPanel(true);
    setNewTagText('');
  }
  function deleteSavedTag(tag) {
    // Removing a saved shortcut never renames any media file.
    setTags(old=>old.filter(t=>t!==tag));
  }
  function toggleFileTag(tag) {
    if(!current || busyRef.current)return;
    const oldName=displayFileName(current.name);
    const newName=toggleTag(oldName,tag);
    if(newName===oldName)return;
    if(!newName.trim() || newName.startsWith('.')){Alert.alert('Cannot rename', 'Removing this tag would leave an invalid filename.');return;}
    if(!demo && files.some(f=>f.uri!==current.uri && f.name.toLowerCase()===newName.toLowerCase())){
      Alert.alert('Name already exists',`A file named “${newName}” already exists in the source directory.`);return;
    }
    working(async()=>{
      if(demo){
        setFiles(a=>a.map((f,i)=>i===index?{...f,name:newName}:f));
        setHistory(h=>historyAfterTagRename(h,{...current,at:index}, {...current,name:newName},tag));
      }else{
        const op=await renameMedia(current,newName,sourceUri);
        if(!op)return;
        // Tagging is deliberately NOT a new Undo action. Reconcile older
        // Undo entries pointing to this file so they remain usable.
        setHistory(h=>historyAfterTagRename(h,current,{...current,uri:op.afterUri,name:newName},tag,sourceUri));
        // Stay on the renamed item even if alphabetical sorting changes its position.
        const nextFiles=listMedia(sourceUri);
        const nextIndex=nextFiles.findIndex(f=>f.uri===op.afterUri || f.name===newName);
        setFiles(nextFiles);
        setIndex(nextIndex<0?Math.min(index,nextFiles.length-1):nextIndex);
      }
    });
  }
  function closeCrop() {
    setCropMode(false);
    // The editor owns only temporary cached images, never the original photo.
    if(!demo && cropPreview) {
      for(const uri of [cropPreview.uri,cropPreview.inputUri]) {
        if(!uri) continue;
        try { new File(uri).delete(); } catch {}
      }
    }
    setCropPreview(null);
  }
  async function openCrop() {
    if(!current || current.video) return;
    if(demo) {
      setCropPreview({uri:current.uri,width:0,height:0});
      setCropMode(true);
      return;
    }
    if(!/\.(jpg|jpeg|png)$/i.test(current.name)) {
      Alert.alert('Unsupported image format','Cropping currently supports JPG and PNG only.');
      return;
    }
    await working(async()=>{
      // SAF content URIs are copied to private temporary storage. Normalize
      // orientation once and then show EXACTLY the pixels used for cropping.
      // Do not release the input or preview while the crop editor is mounted.
      const id=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const input=new File(Paths.cache,`iks-crop-${id}-input-${safeName(current.name)}`);
      const preview=new File(Paths.cache,`iks-crop-${id}-preview.png`);
      try {
        await new File(current.uri).copy(input);
        if(!input.exists || !(input.size>0)) throw new Error('Could not copy image into temporary storage.');
        // This documented SDK 58 API returns a new, orientation-normalized
        // bitmap even with no cropping yet. The new contextual API previously
        // produced a black/empty preview for some Android devices.
        const normalized=await ImageManipulator.manipulateAsync(input.uri,[],{
          format:ImageManipulator.SaveFormat.PNG
        });
        if(!(normalized.width>0&&normalized.height>0))throw new Error('Crop preview dimensions are unavailable.');
        await new File(normalized.uri).copy(preview);
        if(!preview.exists || !(preview.size>0))throw new Error('Crop preview file was not created.');
        setCropPreview({uri:preview.uri,inputUri:input.uri,width:normalized.width,height:normalized.height});
        setCropMode(true);
      } catch(e) {
        try{if(preview.exists)preview.delete();}catch{}
        try{if(input.exists)input.delete();}catch{}
        throw e;
      }
    });
  }
  function applyCrop(){if(!current || !cropPreview)return;
    working(async()=>{
      if(demo){closeCrop();setNotice('Crop preview completed in demo mode');return;}
      const crop=cropPixels(cropRect,cropPreview.width,cropPreview.height);
      // cropPreview.uri is a PNG without EXIF orientation. Both the user-visible
      // editor and the crop decoder now operate on these exact pixels.
      const result=await ImageManipulator.ImageManipulator.manipulate(cropPreview.uri).crop(crop).renderAsync();
      const processed=await result.saveAsync({
        format:/\.png$/i.test(current.name)?ImageManipulator.SaveFormat.PNG:ImageManipulator.SaveFormat.JPEG,
        compress:1
      });
      const op=await replaceWithCrop(current,processed.uri);
      setHistory(h=>[...h,{...op,sourceDirUri:sourceUri}]);
      refresh(sourceUri,index);
      setMediaRevision(v=>v+1);
      closeCrop();
      setNotice('Cropped (original saved for undo)');
    });
  }
  async function openCut(){
    if (!current || !current.video) return;
    if (demo) {
      Alert.alert('Demo mode', 'Choose a real source folder containing MP4 screen recordings to cut a video.');
      return;
    }
    if (!/\.mp4$/i.test(current.name)) {
      Alert.alert('Unsupported video container', 'Cut currently supports MP4 files. Non-MP4 videos are still playable and sortable, but are not overwritten with a differently encoded format.');
      return;
    }
    await working(async()=>{
      let outputUri=null;
      try {
        outputUri=await openVideoCutter(current);
        if(!outputUri){setNotice('Cut canceled — original video unchanged');return;}
        const op=await replaceWithCut(current, outputUri, sourceUri);
        setHistory(h=>[...h,{...op,sourceDirUri:sourceUri}]);
        refresh(sourceUri,index);
        setMediaRevision(v=>v+1);
        setNotice(op.warning || 'Video cut applied (original saved for Undo)');
        if(op.warning) Alert.alert('Cut completed with a cleanup warning',op.warning);
      } finally {
        deleteCutOutput(outputUri);
      }
    });
  }
  function manageRoot(){setPath([]);setOpened(true);setMode('edit');}
  function applyPreset(name){Alert.alert('Load preset',`Replace the current swipe tree with “${name}”?`,[{text:'Cancel',style:'cancel'},{text:'Load',onPress:()=>{
    const loaded=cloneTree(presets[name]);
    setTree(loaded);setPath([]);setOpened(false);setSettings(false);
    checkDestinations(loaded,true);
  }}]);}
  async function saveSetupToFile() {
    setSettings(false);
    await working(async()=>{
      const result=await exportSetup({tree,presets,tags,cropRect});
      if(result)Alert.alert('Setup exported',`Saved ${result.name} to your chosen folder. The backup includes the active tree, saved presets, filename tags and crop rectangle. It does not include media files or undo history.`);
    });
  }
  async function importSetupFromFile() {
    setSettings(false);
    await working(async()=>{
      const imported=await pickImportedSetup();
      if(!imported)return;
      Alert.alert('Import saved setup?',`This will replace your current swipe tree, ${Object.keys(presets).length} saved presets, and filename tags with the backup contents. Existing media files are not modified.`,[
        {text:'Cancel',style:'cancel'},
        {text:'Import',onPress:()=>{
          setTree(imported.tree);setPresets(imported.presets);setTags(imported.tags);
          if(imported.cropRect)setCropRect(imported.cropRect);
          setPath([]);setOpened(false);
          checkDestinations(imported.tree,true);
        }}
      ]);
    });
  }
  function showRecovery() {
    setSettings(false);
    try{setVideoBackups(listVideoCutBackups());setRecoveryPanel(true);}catch(e){error(e)}
  }
  async function exportOriginalVideo(item) {
    setRecoveryPanel(false);
    await working(async()=>{
      const target=await pickFolder();
      if(!target){showRecovery();return;}
      const out=await recoverVideoBackup(item.uri,target);
      Alert.alert('Original video recovered',`A copy named “${out.name}” was saved to your chosen folder. The app-private backup was NOT deleted. Verify the video plays before clearing any backups.`);
      showRecovery();
    });
  }
  function selectDir(dir){setActive(dir);nodeAction(dir);}
  // RN's gestureState coordinates are screen-relative; derive the true center
  // from the START touch inside the 66x66 center view. This remains valid even
  // on phones with status-bar / safe-area insets and letterboxed media.
  // The responder itself is created ONCE so state updates cannot interrupt it.
  radialLatest.current = {mode, opened, path, children, currentNode, square, badIds, nodeAction,
    openEditor, destinationAccessible, sortCurrent};
  const radialPanRef=useRef(null);
  if (!radialPanRef.current) radialPanRef.current=PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:()=>true,
    onPanResponderTerminationRequest:()=>false,
    onPanResponderGrant:(event,g)=>{
      const touch=event.nativeEvent;
      // Text elements are pointerEvents='none'; locationX/Y is relative to
      // the fixed center target, NOT the transformed image/video content.
      const localX=Number.isFinite(touch.locationX)?touch.locationX:33;
      const localY=Number.isFinite(touch.locationY)?touch.locationY:33;
      radialOrigin.current={x:g.x0+33-localX,y:g.y0+33-localY};
      radialSelected.current=null;
      setActive(null);
      if(radialLatest.current.mode==='sort')setOpened(true);
    },
    onPanResponderMove:(event,g)=>{
      const state=radialLatest.current;
      if(g.numberActiveTouches!==1){radialSelected.current=null;setActive(null);return;}
      const x=Number.isFinite(g.moveX)?g.moveX:event.nativeEvent.pageX;
      const y=Number.isFinite(g.moveY)?g.moveY:event.nativeEvent.pageY;
      const direction=availableDirectionAt(x,y,radialOrigin.current.x,radialOrigin.current.y,state.children,state.mode,42,state.square/2);
      if(radialSelected.current!==direction){
        radialSelected.current=direction;
        setActive(direction);
      }
      if(state.mode==='edit')setOpened(true);
    },
    onPanResponderRelease:(event,g)=>{
      const state=radialLatest.current;
      // Use the LAST pointer position, not a swipe's overall net displacement
      // or a stale React state update. A paused finger remains selected.
      const x=Number.isFinite(g.moveX)&&g.moveX!==0?g.moveX:event.nativeEvent.pageX;
      const y=Number.isFinite(g.moveY)&&g.moveY!==0?g.moveY:event.nativeEvent.pageY;
      const selected=availableDirectionAt(x,y,radialOrigin.current.x,radialOrigin.current.y,state.children,state.mode,42,state.square/2);
      radialSelected.current=null;
      setActive(null);
      if(state.mode==='sort'&&state.path.length===0)setOpened(false);
      if(selected){
        if(state.children[selected])state.nodeAction(selected);
        else if(state.mode==='edit')state.openEditor(selected);
      } else if(state.mode==='sort' && state.currentNode.destination && state.path.length &&
        Math.hypot(x-radialOrigin.current.x,y-radialOrigin.current.y)<42){
        if(state.badIds.has(state.currentNode.id)||!state.destinationAccessible(state.currentNode.destination))
          Alert.alert('⚠ Unavailable destination','Reassign this swipe destination in Edit mode.');
        else state.sortCurrent(state.currentNode.destination);
      } else if(state.mode==='edit'&&
        Math.hypot(x-radialOrigin.current.x,y-radialOrigin.current.y)<42){
        setOpened(v=>!v);
      }
    },
    onPanResponderTerminate:()=>{
      radialSelected.current=null;
      setActive(null);
      if(radialLatest.current.mode==='sort'&&radialLatest.current.path.length===0)setOpened(false);
    }
  });
  const radialPan=radialPanRef.current;
  const imagePan=PanResponder.create({
    onMoveShouldSetPanResponder:(e,g)=>g.numberActiveTouches===1&&(Math.abs(g.dx)>18||Math.abs(g.dy)>18),
    onPanResponderGrant:()=>{panStart.current={...pan};},
    onPanResponderMove:(e,g)=>{if(zoom>1){setPan({x:Math.max(-square*(zoom-1)/2,Math.min(square*(zoom-1)/2,panStart.current.x+g.dx)),y:Math.max(-square*(zoom-1)/2,Math.min(square*(zoom-1)/2,panStart.current.y+g.dy))});}},
    onPanResponderRelease:(e,g)=>{
      if(zoom>1)return;
      if(mode==='edit'&&path.length&&g.dx < -60){goBack();return;}
      if(mode==='sort'&&path.length && g.dy < -75 && g.y0>canvasTop.current+square*.6){goBack();return;}
      if(Math.abs(g.dx)>65&&Math.abs(g.dx)>Math.abs(g.dy)*1.2)navigate(g.dx<0?1:-1);
    }
  });
  const showRadial= mode==='edit' || opened || path.length>0;
  const displayRadial= mode==='edit'?opened :showRadial;

  if(!loaded)return <SafeAreaView edges={['top','bottom']} style={[styles.root,{alignItems:'center',justifyContent:'center'}]}><ActivityIndicator color="#34d399"/><Text style={styles.muted}>Loading…</Text></SafeAreaView>;
  return <SafeAreaView edges={['top','bottom']} style={styles.root}>
    <StatusBar barStyle="light-content" backgroundColor={theme.bg}/>
    <View style={styles.header}>
      <View style={{flex:1,gap:4}}>
        <View style={styles.nameRow}>
          <Text style={[styles.fileName,{flex:1}]} numberOfLines={1}>{current?displayFileName(current.name):'No media in this directory'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Rename file" style={styles.nameAction} disabled={!current} onPress={()=>{if(current){setRenameText(displayFileName(current.name));setRename(true);}}}>
            <Text style={styles.nameActionText}>✎</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Manage tags" style={styles.nameAction} disabled={!current} onPress={()=>setTagPanel(true)}>
            <Text style={styles.nameActionText}>🏷</Text>
          </Pressable>
        </View>
        <Text style={styles.fileMeta} numberOfLines={2}>{current?(current.size/1024/1024).toFixed(2)+' MB':'—'}   ·   {demo?'DEMO — no files changed':displayPath(sourceUri)}</Text>
      </View>

    </View>

    {cropMode&&current&&cropPreview?<CropPane uri={cropPreview.uri} imageSize={cropPreview.width&&cropPreview.height?{w:cropPreview.width,h:cropPreview.height}:null} rect={cropRect} setRect={setCropRect} onApply={applyCrop} onCancel={closeCrop}/>:
    <>
    <View style={[styles.canvas,{width:square,height:square,alignSelf:'center'},(mode==='edit'||copyOnly)&&{borderWidth:2,borderColor:'#34d399'}]} onLayout={e=>{canvasTop.current=e.nativeEvent.layout.y;}}>
      {current && (current.video ? <VideoPane key={current.uri+':'+mediaRevision} uri={current.uri} gestureOverlay={<View {...imagePan.panHandlers} style={StyleSheet.absoluteFillObject}/>} />:
       <View style={{flex:1,overflow:'hidden'}} {...imagePan.panHandlers}
         onTouchStart={e=>{const t=e.nativeEvent.touches;if(t.length===2){const d=Math.hypot(t[0].pageX-t[1].pageX,t[0].pageY-t[1].pageY);pinchStart.current={d,zoom};}}}
         onTouchMove={e=>{const t=e.nativeEvent.touches;if(t.length===2&&pinchStart.current){const d=Math.hypot(t[0].pageX-t[1].pageX,t[0].pageY-t[1].pageY);setZoom(Math.min(5,Math.max(1,pinchStart.current.zoom*d/Math.max(1,pinchStart.current.d))));}}}
         onTouchEnd={e=>{if(e.nativeEvent.touches.length<2)pinchStart.current=null;}}>
        <Image key={current.uri+':'+mediaRevision} source={{uri:current.uri}} contentFit="contain" style={[StyleSheet.absoluteFill,{transform:[{translateX:pan.x},{translateY:pan.y},{scale:zoom}]}]} cachePolicy="memory-disk"/>
       </View>)}
      {!current && <View style={styles.noFiles}><Text style={{fontSize:43}}>🖼️</Text><Text style={styles.muted}>No media. Select a folder or undo.</Text></View>}
      {displayRadial && <>
        {mode==='sort' && <Svg width={square} height={square} pointerEvents="none" style={StyleSheet.absoluteFill}>
          {DIRS.map((dir,i)=>children[dir]?<Path key={dir} d={directionPath(square/2,square/2,square*.72,(i-.5)*Math.PI/4,(i+.5)*Math.PI/4)} fill={badIds.has(children[dir].id)?'#64748b':children[dir].color} fillOpacity={badIds.has(children[dir].id)?0.13:(active===dir?0.65:0.24)} stroke={active===dir?'#ffffff':'none'} strokeWidth={active===dir?2:0}/>:null)}
        </Svg>}
        {DIRS.map((dir,i)=>{
          const n=children[dir];if(mode==='sort'&&!n)return null;
          const rad=i*Math.PI/4,dx=Math.sin(rad)*radius,dy=-Math.cos(rad)*radius;
          return <Animated.View key={dir} pointerEvents={mode==='sort'?'none':'auto'} style={[styles.radialNode,{left:square/2-27,top:square/2-27,opacity:anim,transform:[{translateX:Animated.multiply(anim,dx)},{translateY:Animated.multiply(anim,dy)}]}]}>
            <Pressable onPress={()=>selectDir(dir)} style={[styles.nodeButton,{backgroundColor:n?(badIds.has(n.id)?'#4b5563dd':n.color+'dc'):'#203148e8',borderColor:badIds.has(n?.id)?'#9ca3af':active===dir?'white':n?(n.color+'ff'):'#526078',borderStyle:n?'solid':'dashed'}]}>
              <Text style={{fontSize:23,color:badIds.has(n?.id)?'#d1d5db':'#e2e8f0'}}>{badIds.has(n?.id)?'⚠':n?.icon||'+'}</Text>
            </Pressable>
            <Text style={styles.nodeCaption} numberOfLines={1}>{short(n?.name||'',10)}{badIds.has(n?.id)?' !':''}</Text>
          </Animated.View>;
        })}
      </>}
      {/* Keep the invisible center gesture target active in root Sort mode.
          The fingerprint only fades in while the radial menu is open. */}
      {(current || mode==='edit') && <Animated.View {...radialPan.panHandlers} style={[styles.centerNode,{left:square/2-33,top:square/2-33,backgroundColor:badIds.has(currentNode.id)?'#64748b':currentNode.color||'#34d399',opacity:mode==='sort' && path.length===0 ? anim : 1}]}>
        <Text pointerEvents="none" style={{fontSize:27}}>{currentNode.icon||'☝️'}</Text>
        {path.length>0 && <Text pointerEvents="none" numberOfLines={1} style={{fontSize:8,color:'#071524',fontWeight:'900'}}>{short(currentNode.name,9)}</Text>}
      </Animated.View>}
    </View>
    <View style={styles.navRow}>
      <Pressable style={styles.previewThumb} onPress={()=>navigate(-1)}>{index>0&&files[index-1]&&!files[index-1].video?<Image style={{width:'100%',height:'100%',borderRadius:8}} source={{uri:files[index-1].uri}} contentFit="cover"/>:<Text style={styles.muted}>◀</Text>}</Pressable>
      <Pressable onPress={()=>{setJumpText(String(index+1));setJump(true);}} style={styles.counter}><Text style={styles.counterText}>{files.length?index+1:0} / {files.length}</Text><Text style={styles.smallText}>tap to jump</Text></Pressable>
      <Pressable style={styles.previewThumb} onPress={()=>navigate(1)}>{index<files.length-1&&!files[index+1]?.video?<Image style={{width:'100%',height:'100%',borderRadius:8}} source={{uri:files[index+1].uri}} contentFit="cover"/>:<Text style={styles.muted}>▶</Text>}</Pressable>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Show full last operation message" disabled={!notice} onPress={()=>Alert.alert('Last operation',notice)} style={styles.hintBar}><Text style={styles.hint} numberOfLines={3}>{(mode==='sort' && active && children[active])
      ? `${badIds.has(children[active].id)?'⚠ Unavailable: ':'Selected: '}${children[active].name} — ${Object.keys(children[active].children||{}).length?'release to open submenu':children[active].destination?'release to sort':'no destination assigned'}`
      : notice || (mode==='edit'?'EDIT: tap + to configure; tap a node to modify or nest; swipe right to go back.':path.length?'SORT: drag from center; swipe up from bottom to go back.':'SORT: hold center and drag toward a destination. Swipe photo left/right to browse.')}</Text></Pressable>
    <View style={styles.toolbar}>
      <View style={styles.toolbarRow}>
        <LabelButton label={mode==='sort'?'✏️ Edit mode':'✓ Sort mode'} bg={mode==='edit'?'#175b47':'#263c66'} style={styles.toolbarButton} onPress={()=>{setMode(m=>m==='sort'?'edit':'sort');setPath([]);setOpened(mode==='sort');setNotice('');}}/>
        <LabelButton label={copyOnly?'📑 Copy ON':'📑 Copy OFF'} bg={copyOnly?'#146c54':'#27344b'} style={styles.toolbarButton} onPress={()=>setCopyOnly(v=>!v)}/>
      </View>
      <View style={styles.toolbarRow}>
        {path.length>0&&<LabelButton label="↰ Back" compact style={styles.toolbarButton} onPress={goBack}/>}
        <LabelButton label="↶ Undo" compact style={styles.toolbarButton} disabled={!history.length||busy}
          onPressIn={()=>{suppressUndoTap.current=false;}}
          onLongPress={()=>{suppressUndoTap.current=true;setShowUndoPreview(true);}}
          delayLongPress={450}
          onPressOut={()=>setShowUndoPreview(false)}
          onPress={()=>{if(suppressUndoTap.current){suppressUndoTap.current=false;return;}undo();}}/>
        <LabelButton label="🗑 Delete" compact style={styles.toolbarButton} onPress={deleteCurrent} disabled={!current}/>
        <LabelButton label={current?.video?"✂ Cut":"✂ Crop"} compact style={styles.toolbarButton} onPress={current?.video?openCut:openCrop} disabled={!current}/>
        <LabelButton label="⚙ Setup" compact style={styles.toolbarButton} onPress={()=>setSettings(true)}/>
      </View>
    </View>
    </>}
    {showUndoPreview&&undoPreview&&<View pointerEvents="none" style={styles.undoPreviewOverlay}>
      <View style={styles.undoPreviewCard}>
        <View style={styles.undoPreviewTop}>
          {undoPreview.thumbnailUri && undoPreview.isImage
            ? <Image source={typeof undoPreview.thumbnailUri==='number'?undoPreview.thumbnailUri:{uri:undoPreview.thumbnailUri}} contentFit="cover" style={styles.undoPreviewImage}/>
            : <View style={[styles.undoPreviewImage,{alignItems:'center',justifyContent:'center',backgroundColor:'#26364f'}]}>
                <Text style={{fontSize:27}}>{undoPreview.isVideo?'🎬':'↶'}</Text>
              </View>}
          <View style={{flex:1,gap:3}}>
            <Text style={styles.undoPreviewTitle}>{undoPreview.title}</Text>
            <Text style={styles.undoPreviewName} numberOfLines={2}>{undoPreview.name}</Text>
          </View>
        </View>
        <Text style={styles.undoPreviewDescription}>{undoPreview.description}</Text>
        <Text style={styles.undoPreviewHelp}>Release to dismiss · Tap Undo briefly to perform it</Text>
      </View>
    </View>}
    {busy&&<View style={styles.busy}><ActivityIndicator color="#34d399" size="large"/><Text style={{color:'#f8fafc',marginTop:12}}>Processing file…</Text></View>}

    {editor!==null && form && <ModalFrame title={children[editor]?'Modify swipe':'Create swipe'} onClose={()=>{setEditor(null);setForm(null);}}>
      <Field label="Short label" value={form.name} onChangeText={v=>setForm(f=>({...f,name:v}))} placeholder="e.g. Pole tricks"/>
      <Text style={styles.fieldLabel}>Icon</Text>
      <View style={styles.choices}>{ICON_PALETTE.map(x=><Pressable key={x} onPress={()=>setForm(f=>({...f,icon:x}))} style={[styles.choice,{borderColor:form.icon===x?'#34d399':'#344156'}]}><Text style={{fontSize:22}}>{x}</Text></Pressable>)}</View>
      <Text style={styles.fieldLabel}>Color</Text>
      <View style={styles.choices}>{COLOR_PALETTE.map(x=><Pressable key={x} onPress={()=>setForm(f=>({...f,color:x}))} style={[styles.swatch,{backgroundColor:x,borderWidth:form.color===x?3:0,borderColor:'#fff'}]}/>)}</View>
      <Text style={styles.fieldLabel}>Destination directory (optional for containers)</Text>
      <LabelButton label="📁 Choose destination folder" onPress={chooseDestination}/>
      <Text selectable style={styles.muted}>{form.destination?displayPath(form.destination):'No destination selected — container only'}</Text>
      {form.destination&&!destinationAccessible(form.destination)&&<Text style={{color:'#fbbf24'}}>⚠ This destination is missing or inaccessible. Select another folder.</Text>}
      {form.destination && <LabelButton label="Remove destination (container only)" onPress={()=>setForm(f=>({...f,destination:null}))}/>}
      <Pressable onPress={()=>setForm(f=>({...f,locked:!f.locked}))}><Text style={styles.muted}>{form.locked?'🔒 Locked direction':'🔓 Unlocked direction'} — tap to toggle</Text></Pressable>
      <Text style={styles.fieldLabel}>Swipe position</Text>
      <View style={styles.choices}>{DIRS.map(dir=><LabelButton key={dir} label={dir} bg={form.direction===dir?'#155c45':'#26364e'} onPress={()=>setForm(f=>({...f,direction:dir}))} disabled={!!children[editor]?.locked && dir!==editor}/>)}</View>
      <View style={styles.modalActions}><LabelButton label="Cancel" onPress={()=>{setForm(null);setEditor(null);}} style={{flex:1}}/><LabelButton label="Confirm" bg="#07866d" onPress={saveEditor} style={{flex:1}}/></View>
    </ModalFrame>}

    {tagPanel&&<ModalFrame title="Filename tags" onClose={()=>setTagPanel(false)}>
      <Text style={styles.muted} numberOfLines={2}>{current?displayFileName(current.name):'No file selected'}</Text>
      <LabelButton label="＋ Add tag" bg="#145a48" onPress={()=>{setNewTagText('');setTagPanel(false);setNewTagDialog(true);}}/>
      {tags.length===0 && <Text style={styles.muted}>No saved tags yet. Add one to start.</Text>}
      {tags.map(tag=>{
        const selected=!!current&&hasTag(displayFileName(current.name),tag);
        return <View key={tag} style={styles.tagRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${selected?'Remove':'Apply'} tag ${tag}`} disabled={busy||!current} onPress={()=>toggleFileTag(tag)} style={[styles.tagButton,selected&&styles.tagButtonSelected]}>
            <Text style={[styles.tagLabel,selected&&{color:'#d1fae5'}]} numberOfLines={3}>{selected?'✓  ':''}{tag}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Delete saved tag ${tag}`} onPress={()=>deleteSavedTag(tag)} style={styles.tagDelete}>
            <Text style={{fontSize:20,color:'#fecaca'}}>🗑</Text>
          </Pressable>
        </View>;
      })}
      <Text style={styles.muted}>Tap a tag to add/remove it from this filename. The bin only removes the saved tag button, not the filename text. Only manual pencil renaming is Undoable; tapping a tag is reversible by tapping it again.</Text>
      <LabelButton label="Close" onPress={()=>setTagPanel(false)}/>
    </ModalFrame>}
    {newTagDialog&&<ModalFrame title="Add new tag" onClose={()=>{setNewTagDialog(false);setTagPanel(true);}}>
      <Field label="Exact text to append to filenames" value={newTagText} onChangeText={setNewTagText} placeholder="e.g. [Pole] or X and Y"/>
      <View style={styles.modalActions}>
        <LabelButton label="Cancel" onPress={()=>{setNewTagDialog(false);setTagPanel(true);}} style={{flex:1}}/>
        <LabelButton label="Confirm" bg="#07866d" onPress={addTag} style={{flex:1}}/>
      </View>
    </ModalFrame>}
    {rename&&<ModalFrame title="Rename file" onClose={()=>setRename(false)}><Field label="Filename (including extension)" value={renameText} onChangeText={setRenameText}/><View style={styles.modalActions}><LabelButton label="Cancel" onPress={()=>setRename(false)} style={{flex:1}}/><LabelButton label="Rename" bg="#07866d" onPress={renameFile} style={{flex:1}}/></View></ModalFrame>}
    {jump&&<ModalFrame title="Jump to image" onClose={()=>setJump(false)}><Field label={`Index (1–${files.length})`} value={jumpText} keyboardType="number-pad" onChangeText={setJumpText}/><View style={styles.modalActions}><LabelButton label="Cancel" onPress={()=>setJump(false)} style={{flex:1}}/><LabelButton label="Go" bg="#07866d" onPress={()=>{const number=Number(jumpText);if(number>=1&&number<=files.length){setIndex(number-1);setJump(false);}else Alert.alert('Invalid index');}} style={{flex:1}}/></View></ModalFrame>}
    {presetName!==null&&<ModalFrame title={presetAction==='save'?'Save swipe preset':'Load swipe preset'} onClose={()=>setPresetName(null)}>
      {presetAction==='save'?<>
        <Field label="Snapshot name" placeholder="e.g. General sorting" value={presetName} onChangeText={setPresetName}/>
        <LabelButton label="💾 Save current swipe tree" bg="#07866d" onPress={()=>{if(!presetName.trim())return Alert.alert('Enter a name');setPresets(p=>({...p,[presetName.trim()]:cloneTree(tree)}));setPresetName(null);}}/>
      </>:<>
        {Object.keys(presets).length===0&&<Text style={styles.muted}>No saved snapshots.</Text>}
        {Object.keys(presets).map(name=><View key={name} style={styles.presetRow}><Text style={{color:'white',flex:1}}>{name}</Text><LabelButton label="Load" onPress={()=>{setPresetName(null);applyPreset(name);}}/><LabelButton label="✕" onPress={()=>Alert.alert('Delete snapshot?',name,[{text:'Cancel'},{text:'Delete',style:'destructive',onPress:()=>setPresets(p=>{const n={...p};delete n[name];return n;})}])}/></View>)}
      </>}
    </ModalFrame>}
    {recoveryPanel&&<ModalFrame title="Recover original videos" onClose={()=>setRecoveryPanel(false)}>
      <Text style={styles.muted}>These are backups saved in the app's private storage, including backups from failed video cuts. Export one to a folder you choose; the private backup stays untouched. Do not uninstall or clear app storage before recovering.</Text>
      {videoBackups.length===0&&<Text style={styles.muted}>No original-video backups found in this installation.</Text>}
      {videoBackups.map(b=><View key={b.uri} style={{gap:6,paddingVertical:7,borderBottomColor:'#41506a',borderBottomWidth:1}}>
        <Text selectable style={{color:'white'}}>{b.name} ({(b.size/1024/1024).toFixed(1)} MB)</Text>
        <LabelButton label="📤 Copy original to a folder…" bg="#175b47" onPress={()=>exportOriginalVideo(b)}/>
      </View>)}
      <LabelButton label="Close" onPress={()=>setRecoveryPanel(false)}/>
    </ModalFrame>}
    {settings&&<ModalFrame title="Setup" onClose={()=>setSettings(false)}>
      <Text style={styles.muted}>Source: {sourceUri?displayPath(sourceUri):'Demo mode'}</Text>
      <LabelButton label="📂 Open source directory" onPress={()=>{setSettings(false);chooseSource();}}/>
      <LabelButton label="🔄 Refresh source directory" onPress={()=>{setSettings(false);try{refresh();}catch(e){error(e);}}}/>
      <LabelButton label="🧭 Edit swipe tree" onPress={()=>{setSettings(false);manageRoot();}}/>
      <LabelButton label="💾 Save swipe preset" onPress={()=>{setSettings(false);setPresetAction('save');setPresetName('');}}/>
      <LabelButton label="📥 Load swipe preset" onPress={()=>{setSettings(false);setPresetAction('load');setPresetName('');}}/>
      <LabelButton label="📤 Export setup / preset backup (.json)" onPress={saveSetupToFile}/>
      <LabelButton label="📥 Import setup / preset backup (.json)" onPress={importSetupFromFile}/>
      <LabelButton label="🛟 Recover original videos from failed cuts" bg="#6b4a23" onPress={showRecovery}/>
      <LabelButton label={copyOnly?'Disable copy mode':'Enable copy mode'} onPress={()=>setCopyOnly(v=>!v)}/>
      <LabelButton label="↩ Back one swipe level" onPress={()=>{setSettings(false);goBack();}} disabled={!path.length}/>
      <LabelButton label="🗑 Empty app recycle bin PERMANENTLY" bg="#6b2435" onPress={()=>Alert.alert('Permanently empty recycle bin?','Files moved to the app recycle bin will be deleted. Undo for those files will no longer work.',[{text:'Cancel',style:'cancel'},{text:'Empty',style:'destructive',onPress:()=>{try{const n=emptyTrash();Alert.alert('Emptied',`${n} files deleted.`);}catch(e){error(e)}}}])}/>
      <Text style={styles.muted}>You have {history.length} undoable session actions. Crop and video-cut backups are kept in app storage until manually cleared or the app is uninstalled. Large video transfers still depend on the device/provider and should be tested on copies first.</Text>
      <LabelButton label="🧽 Clear crop undo backups" bg="#6b2435" onPress={()=>Alert.alert('Delete crop backups?','This permanently removes the original images held for crop undo. Older crop operations will no longer be undoable.',[{text:'Cancel',style:'cancel'},{text:'Clear',style:'destructive',onPress:()=>{try{const n=clearCropBackups();setHistory(h=>h.filter(o=>o.type!=='crop'));Alert.alert('Cleared',`${n} backups deleted.`);}catch(e){error(e)}}}])}/>
      <LabelButton label="🧽 Clear video-cut undo backups" bg="#6b2435" onPress={()=>Alert.alert('Delete original-video backups?','This permanently removes videos held for Cut undo. Older cut operations will no longer be undoable.',[{text:'Cancel',style:'cancel'},{text:'Clear',style:'destructive',onPress:()=>{try{const n=clearVideoCutBackups();setHistory(h=>h.filter(o=>o.type!=='cut'));Alert.alert('Cleared',`${n} backups deleted.`);}catch(e){error(e)}}}])}/>
      <LabelButton label="➕ Back to demo" onPress={()=>{setSourceUri(null);setFiles(localDemo);setIndex(0);setSettings(false);setHistory([]);setNotice('Demo: no real files will change.');}}/>
    </ModalFrame>}
  </SafeAreaView>;
}

export default function App() {
  return <SafeAreaProvider><ImageKeysortScreen/></SafeAreaProvider>;
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:theme.bg,paddingTop:10,paddingBottom:10},
  nameRow:{flexDirection:'row',alignItems:'center',gap:7},nameAction:{width:36,height:36,borderRadius:9,alignItems:'center',justifyContent:'center',backgroundColor:'#27344b'},nameActionText:{color:'#e2e8f0',fontSize:21},tagRow:{flexDirection:'row',alignItems:'stretch',gap:8},tagButton:{flex:1,backgroundColor:'#101a2c',borderColor:'#41506a',borderWidth:1,borderRadius:10,justifyContent:'center',paddingVertical:11,paddingHorizontal:13},tagButtonSelected:{backgroundColor:'#145a48',borderColor:'#34d399',borderWidth:2},tagLabel:{fontSize:15,color:'white',fontWeight:'600'},tagDelete:{width:48,alignItems:'center',justifyContent:'center',backgroundColor:'#442333',borderRadius:10},
  header:{flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingBottom:13,gap:8},fileName:{color:theme.fg,fontSize:17,fontWeight:'750'},fileMeta:{color:theme.muted,fontSize:12},topGear:{width:36,height:36,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:'#172236'},
  canvas:{backgroundColor:'#0f172a',borderRadius:16,overflow:'hidden',borderWidth:1,borderColor:'#263147',position:'relative'},noFiles:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',gap:7},
  radialNode:{position:'absolute',width:54,height:69,alignItems:'center',justifyContent:'flex-start'},nodeButton:{width:54,height:54,borderRadius:30,borderWidth:2,justifyContent:'center',alignItems:'center'},nodeCaption:{fontSize:10,color:'white',fontWeight:'800',textShadowColor:'#020617',textShadowRadius:4,maxWidth:73,textAlign:'center'},centerNode:{position:'absolute',width:66,height:66,borderRadius:40,alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:'#d1fae5ee',elevation:6},
  navRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',marginTop:12,gap:10},previewThumb:{width:70,height:57,borderRadius:10,backgroundColor:'#1a273a',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#2d3c55'},counter:{minWidth:120,height:57,borderRadius:11,backgroundColor:'#17283d',alignItems:'center',justifyContent:'center'},counterText:{color:'white',fontSize:19,fontWeight:'800'},smallText:{color:theme.muted,fontSize:10},hintBar:{minHeight:48,paddingHorizontal:13,paddingVertical:7,justifyContent:'center'},hint:{color:'#a5b4ca',fontSize:12,textAlign:'center'},toolbar:{gap:7,paddingHorizontal:10,paddingVertical:10,width:'100%'},toolbarRow:{flexDirection:'row',gap:6,width:'100%'},toolbarButton:{flex:1,minWidth:0},
  undoPreviewOverlay:{position:'absolute',bottom:108,left:12,right:12,zIndex:60,elevation:20},undoPreviewCard:{backgroundColor:'#1b2b42',borderWidth:1,borderColor:'#65d9ab',borderRadius:16,padding:13,gap:11,shadowColor:'#000',shadowOpacity:0.45,shadowRadius:14,shadowOffset:{width:0,height:7}},undoPreviewTop:{flexDirection:'row',gap:12,alignItems:'center'},undoPreviewImage:{width:78,height:78,borderRadius:10},undoPreviewTitle:{color:'#a7f3d0',fontSize:15,fontWeight:'800'},undoPreviewName:{color:'white',fontSize:13,fontWeight:'600'},undoPreviewDescription:{color:'#e2e8f0',fontSize:13,lineHeight:19},undoPreviewHelp:{color:'#91a7ba',fontSize:11},
  modalCover:{flex:1,backgroundColor:'#000000bb',alignItems:'center',justifyContent:'center',padding:20},modal:{width:'100%',maxWidth:470,maxHeight:'86%',backgroundColor:'#172338',padding:18,borderRadius:19,borderWidth:1,borderColor:'#34445e'},modalTitle:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:16},titleText:{color:'white',fontSize:19,fontWeight:'800'},muted:{color:theme.muted,fontSize:13},fieldLabel:{color:'#d3deea',fontSize:12,fontWeight:'700'},input:{backgroundColor:'#101a2c',color:'white',borderWidth:1,borderColor:'#41506a',borderRadius:10,padding:12,fontSize:15},choices:{flexDirection:'row',flexWrap:'wrap',gap:7},choice:{width:45,height:43,borderRadius:9,borderWidth:2,alignItems:'center',justifyContent:'center',backgroundColor:'#0e1727'},swatch:{height:31,width:31,borderRadius:18},modalActions:{flexDirection:'row',gap:12,marginTop:8},presetRow:{flexDirection:'row',gap:9,alignItems:'center'},busy:{...StyleSheet.absoluteFillObject,backgroundColor:'#050c17e5',alignItems:'center',justifyContent:'center',zIndex:99}
});
