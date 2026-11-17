from pathlib import Path
import json

p=Path(__file__).resolve().parents[1]
s=(p/'App.js').read_text()
pkg=json.loads((p/'package.json').read_text())
assert "from 'react-native-safe-area-context'" in s
assert 'return <SafeAreaProvider><ImageKeysortScreen/></SafeAreaProvider>' in s
assert s.count('edges={[\'top\',\'bottom\']}') == 2
assert "paddingTop:10,paddingBottom:10" in s
assert "Platform.OS==='ios'?44:16" not in s
assert 'react-native-safe-area-context' in pkg['dependencies']
h=(p/'browser-prototype.html').read_text()
assert 'env(safe-area-inset-top, 0px)' in h
print('PASS: safe-area + header spacing setup')
