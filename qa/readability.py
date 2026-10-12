"""Rendered text and hover regression check; isolated Chromium profile, no user data.
Run using with_server.py with the production preview on port 5190.
"""
import json
import subprocess
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUT = Path(r'C:\Users\Ishan\AppData\Local\Temp\opencode\atlas-readability')
OUT.mkdir(exist_ok=True)

# Resolve translucent backgrounds through ancestors, including text opacity.
# The decorative canvas gradient is light throughout; use its off-white fallback.
MEASURE = """el => {
  const rgba = value => {
    const numbers = value.match(/[\\d.]+/g)?.map(Number) ?? [0,0,0,0];
    return [...numbers.slice(0,3), numbers[3] ?? 1];
  };
  const over = (fg,bg) => fg.slice(0,3).map((c,i) => c*fg[3]+bg[i]*(1-fg[3]));
  const luminance = rgb => rgb.map(c => c/255).map(c => c<=.04045 ? c/12.92 : ((c+.055)/1.055)**2.4)
    .reduce((total,c,i) => total+c*[.2126,.7152,.0722][i],0);
  const chain = []; let opacity = 1;
  for (let node=el; node; node=node.parentElement) {chain.unshift(node); opacity*=Number(getComputedStyle(node).opacity);}
  let bg = [255,255,255];
  for (const node of chain) bg = over(rgba(getComputedStyle(node).backgroundColor),bg);
  const style = getComputedStyle(el);
  const fg = rgba(style.color); fg[3]*=opacity;
  const a=luminance(over(fg,bg)), b=luminance(bg);
  const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  const large = parseFloat(style.fontSize)>=24 || (parseFloat(style.fontSize)>=18.66 && Number(style.fontWeight)>=700);
  return {text:el.textContent.trim().replace(/\\s+/g,' ').slice(0,100), ratio:Number(ratio.toFixed(2)),
    required:large ? 3 : 4.5, color:style.color, background:bg, font:style.fontSize,
    class:el.className, opacity};
}"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width':1440,'height':1000}, reduced_motion='reduce')
    errors = []
    checked = 0
    hover_checked = 0

    def check(locator, screen, state):
        global checked
        if not locator.is_visible() or locator.evaluate("el => Boolean(el.closest(':disabled, [aria-disabled=true], [aria-hidden=true], svg'))"):
            return
        result = locator.evaluate(MEASURE)
        checked += 1
        if result['ratio'] < result['required']:
            errors.append({'screen':screen, 'state':state, **result})

    def inspect(screen):
        global hover_checked
        page.wait_for_load_state('networkidle')
        page.mouse.move(0,0)
        root = page.locator('dialog[open]') if page.locator('dialog[open]').count() else page.locator('body')
        # Every visible direct text node, rather than an ancestor with mixed colors.
        for item in root.locator('*').element_handles():
            if item.evaluate("el => [...el.childNodes].some(n=>n.nodeType===3 && n.textContent.trim())"):
                check(item,screen,'normal')
        for control in root.locator('button, a, summary').element_handles():
            if not control.is_visible() or control.is_disabled():
                continue
            control.evaluate("el=>el.scrollIntoView({block:'center',behavior:'instant'})")
            control.hover(timeout=3000)
            hover_checked += 1
            check(control,screen,'hover')
            for item in control.query_selector_all('*'):
                if item.evaluate("el => [...el.childNodes].some(n=>n.nodeType===3 && n.textContent.trim())"):
                    check(item,screen,'hover')
        page.mouse.move(0,0)
        page.evaluate('window.scrollTo(0,0)')

    def tab(name):
        page.get_by_role('navigation', name='Main navigation').get_by_role('button', name=name, exact=True).click()

    page.goto('http://127.0.0.1:5190/',wait_until='networkidle')
    if '--baseline' in sys.argv:
        # Reproduce the published token/hover rules without changing working files.
        css = subprocess.check_output(['git','show','HEAD:src/design/tokens.css'],text=True,encoding='utf-8')
        page.add_style_tag(content=css)
    inspect('onboarding')
    page.get_by_label('Display Name (optional)').fill('Test Lifter')
    for _ in range(3):
        page.get_by_role('button', name='Continue', exact=True).click()
    page.get_by_role('button', name='Continue to Equipment').click()
    for _ in range(4):
        page.get_by_role('button', name='Continue', exact=True).click()
    page.get_by_role('button', name='Skip (No Restrictions)').click()
    page.get_by_role('button', name='Generate Plan Preview').click()
    page.get_by_role('button', name='Start Training').click()
    expect(page.get_by_role('heading', name='Today', exact=True)).to_be_visible()
    inspect('today')
    if '--baseline' in sys.argv:
        failures = [e for e in errors if e['screen']=='today' and e['state']=='hover' and 'tab' in str(e['class'])]
        print(json.dumps({'baseline_navigation_hover_failures':failures},indent=2))
        browser.close()
        assert not failures, 'Published navigation text becomes unreadable on hover'
        sys.exit(0)
    for width in [320,390,1440]:
        page.set_viewport_size({'width':width,'height':1000 if width==1440 else 844})
        header = page.locator('.today-header')
        heading = header.get_by_role('heading', name='Today', exact=True)
        settings = header.get_by_role('button', name='Open settings')
        title_box, button_box = heading.bounding_box(), settings.bounding_box()
        assert title_box['x']+title_box['width'] <= button_box['x'], 'Today heading overlaps Settings'
        assert button_box['width'] >= 44 and button_box['height'] >= 44
        page.evaluate('window.scrollTo(0,250)')
        assert abs(header.bounding_box()['y']) < 1, 'Today header scrolls out of position'
        page.evaluate('window.scrollTo(0,0)')
        page.get_by_role('navigation',name='Main navigation').get_by_role('button',name='Plan',exact=True).hover()
        page.screenshot(path=str(OUT/f'today-hover-{width}.png'))
    page.set_viewport_size({'width':1440,'height':1000})
    tab('Plan')
    expect(page.get_by_role('button', name='Saved routines', exact=True)).to_be_visible()
    inspect('plan')
    page.get_by_role('button', name='Saved routines', exact=True).click()
    page.get_by_role('button', name='Create custom workout', exact=True).click()
    inspect('custom workout')
    tab('Library')
    expect(page.get_by_role('searchbox', name='Search exercises')).to_be_visible()
    inspect('library')
    page.locator('.ex-card-main').first.click()
    expect(page.get_by_role('dialog')).to_be_visible()
    inspect('exercise details')
    page.keyboard.press('Escape')
    tab('Progress')
    inspect('progress')
    tab('Today')
    page.get_by_role('button', name='Open settings', exact=True).click()
    inspect('settings')
    tab('Today')
    page.get_by_role('button', name='Start workout', exact=True).click()
    expect(page.locator('.active-title')).to_be_visible()
    inspect('workout')
    name = page.locator('.exercise-header-row h2').inner_text()
    page.get_by_label(f'{name} set 1 load kg',exact=True).fill('10')
    page.get_by_label(f'{name} set 1 reps',exact=True).fill('8')
    page.get_by_role('button',name=f'Complete {name} set 1',exact=True).click()
    page.get_by_role('region',name='Rest timer').get_by_role('button',name='Skip',exact=True).click()
    page.get_by_role('button',name='Finish workout',exact=True).click()
    inspect('finish confirmation')
    page.get_by_role('button',name='Save workout',exact=True).click()
    expect(page.get_by_role('heading',name='Workout saved',exact=True)).to_be_visible()
    inspect('completed workout')
    page.get_by_role('button',name='Save as routine',exact=True).click()
    expect(page.get_by_role('button',name='Routine saved',exact=True)).to_be_visible()
    page.get_by_role('button',name='Back to Today',exact=True).click()
    tab('Progress')
    expect(page.locator('.progress-session-toggle')).to_be_visible()
    inspect('logged history')
    page.get_by_role('button',name='Strength',exact=True).click()
    inspect('logged strength')
    page.get_by_role('button',name='Muscles',exact=True).click()
    inspect('muscles')
    tab('Plan')
    page.get_by_role('button',name='Saved routines (1)',exact=True).click()
    inspect('saved routines')

    unique = list({(e['screen'],e['state'],e['text'],e['color'],str(e['background'])):e for e in errors}.values())
    result = {'text_checks':checked,'hover_checks':hover_checked,'failures':unique}
    (OUT/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps({'text_checks':checked,'hover_checks':hover_checked,'failure_count':len(unique),'failures':unique[:35]},indent=2))
    browser.close()
    assert not unique, f'{len(unique)} rendered text/hover contrast failures; see {OUT / "results.json"}'
