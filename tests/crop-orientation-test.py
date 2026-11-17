"""Compare crop pixels to the exact visible crop preview, including EXIF rotations."""
from pathlib import Path
from io import BytesIO
import base64
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

html=(Path(__file__).resolve().parent.parent/'browser-prototype.html').read_text()

def example(w,h,exif_orientation):
    im=Image.new('RGB',(w,h),(25,35,50))
    draw=ImageDraw.Draw(im)
    for y in range(h):
        c=(int(255*y/(h-1)),int(180*y/(h-1)),int(255*(1-y/(h-1))))
        draw.line((0,y,w,y),fill=c)
    for x in range(0,w,10):
        draw.line((x,0,x,h),fill=(int(255*x/(w-1)),70,170),width=2)
    draw.rectangle((5,5,w//4,h//4), fill=(250,0,0))
    draw.rectangle((w*3//4,5,w-5,h//4), fill=(0,250,0))
    draw.rectangle((5,h*3//4,w//4,h-5),fill=(0,0,250))
    draw.rectangle((w*3//4,h*3//4,w-5,h-5),fill=(250,220,0))
    exif=Image.Exif();exif[274]=exif_orientation
    data=BytesIO();im.save(data,format='JPEG',quality=98,exif=exif)
    return data.getvalue()

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for orientation in [1,3,6,8]:
        page=browser.new_page(viewport={'width':375,'height':800})
        page.set_content(html)
        page.locator('#files').set_input_files(files={'name':'orientation.jpg','mimeType':'image/jpeg','buffer':example(240,390,orientation)})
        page.locator('#crop').click()
        page.wait_for_function('''() => document.querySelector('#cropSource')?.width>100 && document.querySelector('#cropSource')?.height>100''')
        # Set a crop box deliberately well away from the top-left origin.
        # Compare the decoded output pixels against the pixels ACTUALLY VISIBLE
        # in the editor, not against separately interpreted EXIF data.
        before=page.evaluate('''() => {
          const canvas=document.querySelector('#cropSource');
          const r={x:.36,y:.24,w:.34,h:.29};
          const x0=Math.round(r.x*canvas.width), y0=Math.round(r.y*canvas.height);
          const sample=canvas.getContext('2d').getImageData(x0+6,y0+6,1,1).data;
          // The selection is normally moved via gestures; the same normalized
          // rectangle is assigned here to isolate the image encoding pipeline.
          return {w:canvas.width,h:canvas.height,x0,y0,sample:[...sample].slice(0,3)};
        }''')
        # Drag top-left corner from current default .1/.08 to .36/.24
        box=page.locator('#cropframe').bounding_box()
        handle=page.locator('[data-handle=nw]').bounding_box()
        start=(handle['x']+handle['width']/2,handle['y']+handle['height']/2)
        new=(start[0]+box['width']*.26,start[1]+box['height']*.16)
        page.mouse.move(*start);page.mouse.down();page.mouse.move(*new,steps=14);page.mouse.up()
        # Move bottom-right corner back to .70/.53 (bottom-right default .9/.9)
        handle=page.locator('[data-handle=se]').bounding_box()
        start=(handle['x']+handle['width']/2,handle['y']+handle['height']/2)
        new=(start[0]-box['width']*.20,start[1]-box['height']*.37)
        page.mouse.move(*start);page.mouse.down();page.mouse.move(*new,steps=14);page.mouse.up()
        prior=page.evaluate('''() => {
          const c=document.querySelector('#cropSource'),b=document.querySelector('#cropbox');
          const f=document.querySelector('#cropframe').getBoundingClientRect();
          const r=b.getBoundingClientRect();
          const x=Math.round((r.left-f.left)/f.width*c.width);
          const y=Math.round((r.top-f.top)/f.height*c.height);
          const image=c.getContext('2d').getImageData(x+6,y+6,1,1).data;
          return {x,y,w:c.width,h:c.height,sample:[...image].slice(0,3)};
        }''')
        page.locator('#cropConfirm').click()
        page.wait_for_function("() => !document.querySelector('#cropframe') && document.querySelector('#media').src.startsWith('data:image/jpeg')")
        crop=Image.open(BytesIO(base64.b64decode(page.locator('#media').get_attribute('src').split(',')[1]))).convert('RGB')
        actual=crop.getpixel((6,6)); expected=prior['sample']
        assert all(abs(a-b)<16 for a,b in zip(actual,expected)),(orientation,actual,expected,prior)
        print('EXIF',orientation,'cropped from pixel',prior['x'],prior['y'],'and matched preview RGB',actual)
        page.close()
    page=browser.new_page(viewport={'width':320,'height':680})
    page.set_content(html)
    canvas=page.locator('#canvas')
    assert canvas.evaluate('(e)=>getComputedStyle(e).borderTopColor') == 'rgb(43, 60, 84)'
    page.locator('#modeBtn').click()
    assert canvas.evaluate('(e)=>getComputedStyle(e).borderTopColor') == 'rgb(52, 211, 153)'
    assert canvas.evaluate('(e)=>getComputedStyle(e).borderTopWidth') == '2px'
    page.locator('#modeBtn').click()
    assert canvas.evaluate('(e)=>getComputedStyle(e).borderTopColor') == 'rgb(43, 60, 84)'
    assert canvas.evaluate('(e)=>getComputedStyle(e).borderTopWidth') == '1px'
    print('Green border verified: Edit = 2 px, Sort = standard 1 px')
    browser.close()
