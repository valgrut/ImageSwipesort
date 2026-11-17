"""Smoke test for browser-prototype.html. Requires playwright and system Chromium."""
from pathlib import Path
from playwright.sync_api import sync_playwright
html=(Path(__file__).resolve().parent.parent/'browser-prototype.html').read_text()
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':410,'height':850})
    errors=[]
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.set_content(html)
    assert '1 / 3' in page.locator('#count').inner_text()
    page.locator('#modeBtn').click()
    assert page.locator('.node').count()==8
    page.locator('.node').first.click()
    page.locator('#sName').fill('Dance')
    page.locator('#sDest').fill('Pictures/Dance')
    page.locator('#save').click()
    page.locator('#modeBtn').click()
    center=page.locator('#center').bounding_box()
    cx=center['x']+center['width']/2;cy=center['y']+center['height']/2
    page.mouse.move(cx,cy);page.mouse.down();page.mouse.move(cx,cy-120,steps=5);page.mouse.up()
    assert '1 / 2' in page.locator('#count').inner_text()
    page.locator('#undo').click()
    assert '1 / 3' in page.locator('#count').inner_text()
    page.locator('#crop').click()
    page.locator('#cropConfirm').click()
    page.wait_for_timeout(150)
    assert 'Crop applied' in page.locator('#tip').inner_text()
    assert not errors,errors
    browser.close()
print('Browser smoke tests passed')

# Toolbar regression: two rows without horizontal overflow, including nested 'Back'.
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in (280,320,360,410):
        page=browser.new_page(viewport={'width':width,'height':780})
        page.set_content(html)
        assert page.locator('.tool-row').count()==2
        assert page.locator('#modeRow button').count()==2
        assert page.locator('#actionRow button').count()==5
        assert not page.locator('#back').is_visible()
        page.locator('#modeBtn').click()
        page.locator('.node').first.click()
        page.locator('#sName').fill('Dance')
        page.locator('#save').click()
        page.locator('.node').first.click()
        page.locator('#nested').click()
        assert page.locator('#back').is_visible()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert page.evaluate('''[...document.querySelectorAll('#actionRow button')].every(b => b.scrollWidth <= b.clientWidth+1)''')
        page.locator('#setup').click()
        assert page.locator('#choose').is_visible()
        assert page.locator('#savePresets').is_visible()
        assert page.locator('#loadPresets').is_visible()
        page.close()
    browser.close()
print('Two-row toolbar regression tests passed')

# Root Sort hides the fingerprint visually but still accepts a gesture from its center.
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':360,'height':760})
    page.set_content(html)
    center=page.locator('#center')
    assert center.evaluate('(el) => el.style.opacity')=='0'
    assert center.evaluate('(el) => getComputedStyle(el).pointerEvents')!='none'
    box=center.bounding_box()
    cx=box['x']+box['width']/2
    cy=box['y']+box['height']/2
    page.mouse.move(cx,cy)
    page.mouse.down()
    assert center.evaluate('(el) => el.style.opacity')=='1'
    page.mouse.up()
    assert center.evaluate('(el) => el.style.opacity')=='0'
    page.locator('#modeBtn').click()
    assert center.evaluate('(el) => el.style.opacity')=='1'
    page.locator('.node').first.click()
    page.locator('#sName').fill('Nested')
    page.locator('#save').click()
    page.locator('.node').first.click()
    page.locator('#nested').click()
    page.locator('#modeBtn').click()  # reset to root Sort
    assert center.evaluate('(el) => el.style.opacity')=='0'
    browser.close()
print('Hidden center and gesture activation regression tests passed')
