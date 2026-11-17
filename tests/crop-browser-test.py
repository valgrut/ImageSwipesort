"""Run with python tests/crop-browser-test.py; requires Playwright and Chromium."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
from io import BytesIO
import base64

html=(Path(__file__).resolve().parent.parent/'browser-prototype.html').read_text()

def photo(w,h):
    # Each pixel uniquely identifies its source X,Y position via red/green.
    im=Image.new('RGB',(w,h))
    for y in range(h):
        for x in range(w):
            im.putpixel((x,y),(int(x*255/(w-1)),int(y*255/(h-1)),37))
    buf=BytesIO();im.save(buf,format='PNG');return buf.getvalue()

def drag(page,start,target):
    page.mouse.move(*start);page.mouse.down();page.mouse.move(*target,steps=10);page.mouse.up()

def middle(box):return (box['x']+box['width']/2,box['y']+box['height']/2)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for w,h in ((260,520),(520,260)):
        page=browser.new_page(viewport={'width':360,'height':760})
        errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
        page.set_content(html)
        page.locator('#files').set_input_files(files={'name':'gradient.png','mimeType':'image/png','buffer':photo(w,h)})
        page.locator('#crop').click()
        page.locator('#cropframe').wait_for(state='visible')
        # Wait for measured image and a positioned crop frame.
        page.wait_for_function('''() => document.querySelector('#cropframe').clientWidth>100 && document.querySelector('#cropframe').clientHeight>100''')
        frame=page.locator('#cropframe').bounding_box();canvas=page.locator('#canvas').bounding_box()
        assert abs(frame['width']/frame['height']-w/h)<.025, (w,h,frame)
        assert frame['width']<canvas['width']-30 or frame['height']<canvas['height']-30
        # Resize the top-left independent of bottom-right (and vice versa).
        box=page.locator('#cropbox').bounding_box()
        nw=middle(page.locator('[data-handle="nw"]').bounding_box())
        drag(page,nw,(nw[0]+frame['width']*.16,nw[1]+frame['height']*.16))
        adjusted=page.locator('#cropbox').bounding_box()
        assert adjusted['x']>box['x']+10 and adjusted['y']>box['y']+10,(adjusted,box)
        se=middle(page.locator('[data-handle="se"]').bounding_box())
        drag(page,se,(se[0]-frame['width']*.12,se[1]-frame['height']*.12))
        resized=page.locator('#cropbox').bounding_box()
        assert resized['width']<adjusted['width']-10 and resized['height']<adjusted['height']-10
        # Move box without changing its dimensions.
        start=middle(resized);drag(page,start,(start[0]+frame['width']*.045,start[1]+frame['height']*.04))
        moved=page.locator('#cropbox').bounding_box()
        assert moved['x']>resized['x']+4 and moved['y']>resized['y']+4
        assert abs(moved['width']-resized['width'])<1 and abs(moved['height']-resized['height'])<1
        # The crop result must correspond to the exact origin of the visible box.
        before=page.evaluate('''() => ({x:parseFloat(document.querySelector('#cropbox').style.left)/100,y:parseFloat(document.querySelector('#cropbox').style.top)/100,w:parseFloat(document.querySelector('#cropbox').style.width)/100,h:parseFloat(document.querySelector('#cropbox').style.height)/100})''')
        page.locator('#cropConfirm').click()
        page.wait_for_function("() => !document.querySelector('#cropframe') && document.querySelector('#media').src.startsWith('data:image/')")
        uri=page.locator('#media').get_attribute('src')
        crop=Image.open(BytesIO(base64.b64decode(uri.split(',')[1]))).convert('RGB')
        expectedX=int(w*before['x']);expectedY=int(h*before['y'])
        assert abs(crop.width-int(w*before['w']))<=1 and abs(crop.height-int(h*before['h']))<=1,(crop.size,before)
        pixel=crop.getpixel((3,3))
        expected=(int((expectedX+3)*255/(w-1)),int((expectedY+3)*255/(h-1)))
        assert abs(pixel[0]-expected[0])<12 and abs(pixel[1]-expected[1])<12,(w,h,pixel,expected,before)
        assert not errors,errors
        print(f'PASSED {w}x{h}: 4-corner resizing, moving, crop origin and output pixels')
        page.close()
    browser.close()
