"""Theme/UI regression check: Today header, nav hover contrast, onboarding Back,
equipment 'Sultan pai', dark-token simulation, overflow + pageerror guard.
Run using with_server.py with the production preview on port 5191.
"""
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:5191/'
OUT = Path(r'C:\Users\Ishan\AppData\Local\Temp\opencode\atlas-theme')
OUT.mkdir(parents=True, exist_ok=True)

# Same ancestor-resolving contrast measurement as qa/readability.py.
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
  return {text:el.textContent.trim().replace(/\\s+/g,' ').slice(0,60), ratio:Number(ratio.toFixed(2)),
    color:style.color, background:bg.map(Math.round), font:style.fontSize};
}"""

# Probe: body text token over card surface token.
PROBE = """() => {
  const rgba = v => { const n = v.match(/[\\d.]+/g)?.map(Number) ?? [0,0,0,0]; return [...n.slice(0,3), n[3] ?? 1]; };
  const lum = rgb => rgb.map(c => c/255).map(c => c<=.04045 ? c/12.92 : ((c+.055)/1.055)**2.4)
    .reduce((t,c,i) => t+c*[.2126,.7152,.0722][i],0);
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:-9999px;top:0;color:var(--text);background:var(--surface);font-size:16px;';
  probe.textContent = 'probe';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const fg = rgba(cs.color), bg = rgba(cs.backgroundColor);
  const a = lum(fg.slice(0,3)), b = lum(bg.slice(0,3));
  const out = {text_color: cs.color, surface_color: cs.backgroundColor,
    ratio: Number(((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toFixed(2))};
  probe.remove();
  return out;
}"""

LABEL_SPAN = "el => [...el.querySelectorAll('span')].find(n => [...n.childNodes].some(c => c.nodeType===3 && c.textContent.trim())) || el"

results = {'checks': [], 'measurements': {}, 'pageerrors': []}


def record(name, passed, detail=''):
    results['checks'].append({'check': name, 'status': 'PASS' if passed else 'FAIL', 'detail': detail})
    print(('PASS' if passed else 'FAIL'), '-', name, ('| ' + str(detail)) if detail else '')


def check(name, condition, detail=''):
    assert condition, f'{name}: {detail}'
    record(name, True, detail)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
    page.on('pageerror', lambda err: results['pageerrors'].append(str(err)))

    nav = page.get_by_role('navigation', name='Main navigation')

    def tab_label(name):
        button = nav.get_by_role('button', name=name, exact=True)
        button.hover()
        page.wait_for_timeout(60)
        handle = button.evaluate_handle(LABEL_SPAN)
        return handle.as_element().evaluate(MEASURE)

    # ---------- Onboarding: Back button (c) ----------
    page.goto(BASE, wait_until='networkidle')
    expect(page.get_by_role('heading', name='Welcome to Atlas Fit')).to_be_visible()
    page.get_by_label('Display Name (optional)').fill('Test Lifter')
    page.get_by_role('button', name='Continue', exact=True).click()
    # Step 2
    back_bottom = page.get_by_role('button', name='Go back one step')
    back_header = page.get_by_role('button', name='Back to previous step')
    check('onboarding step 2 has bottom Back button (aria-label "Go back one step")', back_bottom.is_visible())
    check('onboarding step 2 has header Back button (aria-label "Back to previous step")', back_header.is_visible())
    page.screenshot(path=str(OUT / 'onboarding-back.png'), full_page=True)

    # Overflow on step 2
    for width in [320, 390, 1440]:
        page.set_viewport_size({'width': width, 'height': 844 if width != 1440 else 1000})
        page.wait_for_timeout(80)
        overflow = page.evaluate('document.documentElement.scrollWidth - innerWidth')
        check(f'onboarding step 2 no horizontal overflow at {width}', overflow <= 0, f'excess={overflow}px')
    page.set_viewport_size({'width': 390, 'height': 844})

    back_bottom.click()
    name_input = page.get_by_label('Display Name (optional)')
    expect(name_input).to_be_visible()
    value = name_input.input_value()
    check('Back returns to step 1 preserving typed name', value == 'Test Lifter', f'value={value!r}')

    # ---------- Equipment step (d) ----------
    page.get_by_role('button', name='Continue', exact=True).click()  # -> 2
    page.get_by_role('button', name='Continue', exact=True).click()  # -> 3
    page.get_by_role('button', name='Continue', exact=True).click()  # -> 4
    page.get_by_role('button', name='Continue to Equipment').click()  # -> 5
    search = page.get_by_placeholder('Search equipment', exact=False)
    search.fill('Sultan pai')
    sultan = page.get_by_role('button', name=re.compile('Sultan pai'))
    check('equipment search "Sultan pai" shows a selectable button', sultan.count() >= 1 and sultan.first.is_visible(),
          f'count={sultan.count()}')
    pressed_before = sultan.first.get_attribute('aria-pressed')
    sultan.first.click()
    page.wait_for_timeout(60)
    pressed_after = sultan.first.get_attribute('aria-pressed')
    check('clicking "Sultan pai" sets aria-pressed=true', pressed_after == 'true',
          f'before={pressed_before} after={pressed_after}')
    search.fill('')
    page.get_by_role('button', name='Custom', exact=True).click()
    page.wait_for_timeout(60)
    check('"Custom" category filter shows "Sultan pai"', sultan.first.is_visible())
    check('"Sultan pai" stays selected under Custom filter', sultan.first.get_attribute('aria-pressed') == 'true')
    page.screenshot(path=str(OUT / 'equipment-custom.png'), full_page=True)

    for width in [320, 390, 1440]:
        page.set_viewport_size({'width': width, 'height': 844 if width != 1440 else 1000})
        page.wait_for_timeout(80)
        overflow = page.evaluate('document.documentElement.scrollWidth - innerWidth')
        check(f'equipment step no horizontal overflow at {width}', overflow <= 0, f'excess={overflow}px')
    page.set_viewport_size({'width': 390, 'height': 844})

    # ---------- Finish onboarding ----------
    page.get_by_role('button', name='Continue', exact=True).click()
    for _ in range(3):
        page.get_by_role('button', name='Continue', exact=True).click()
    page.get_by_role('button', name='Skip (No Restrictions)').click()
    page.get_by_role('button', name='Generate Plan Preview').click()
    page.get_by_role('button', name='Start Training').click()
    expect(page.get_by_role('heading', name='Today', exact=True)).to_be_visible()

    # ---------- Today header (a) ----------
    for width in [320, 390, 1440]:
        page.set_viewport_size({'width': width, 'height': 844 if width != 1440 else 1000})
        page.wait_for_timeout(80)
        header = page.locator('.today-header')
        h1 = header.get_by_role('heading', name='Today', exact=True)
        check(f'h1 exact text "Today" at {width}', h1.inner_text().strip() == 'Today', h1.inner_text())
        check(f'h1 does not contain "Hey," at {width}', 'Hey,' not in h1.inner_text())
        settings = header.get_by_role('button', name='Open settings')
        check(f'Settings button visible at {width}', settings.is_visible())
        check(f'Settings button accessible name "Open settings" at {width}',
              settings.evaluate("el => el.getAttribute('aria-label')") == 'Open settings')
        hb, sb = h1.bounding_box(), settings.bounding_box()
        check(f'h1 does not overlap Settings at {width}',
              hb['x'] + hb['width'] <= sb['x'] and hb['y'] < sb['y'] + sb['height'] and sb['y'] < hb['y'] + hb['height'],
              f'h1={hb} settings={sb}')
        check(f'Settings button >= 44x44 at {width}', sb['width'] >= 44 and sb['height'] >= 44,
              f"{sb['width']}x{sb['height']}")
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(80)
    page.screenshot(path=str(OUT / 'today-light-mobile.png'), full_page=True)
    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.wait_for_timeout(80)
    page.screenshot(path=str(OUT / 'today-light-desktop.png'))
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(80)

    # ---------- Hover contrast (b) ----------
    for tab_name in ['Plan', 'Library']:
        m = tab_label(tab_name)
        results['measurements'][f'hover_{tab_name}'] = m
        check(f'hovered "{tab_name}" tab label >= 4.5:1', m['ratio'] >= 4.5, f"{m['ratio']}:1 {m['color']} on {m['background']}")
    active = tab_label('Today')
    results['measurements']['hover_active_Today'] = active
    check('hovered active "Today" tab label >= 3:1', active['ratio'] >= 3.0, f"{active['ratio']}:1 {active['color']} on {active['background']}")

    # ---------- Overflow on Today (f) ----------
    for width in [320, 390, 1440]:
        page.set_viewport_size({'width': width, 'height': 844 if width != 1440 else 1000})
        page.wait_for_timeout(80)
        overflow = page.evaluate('document.documentElement.scrollWidth - innerWidth')
        check(f'Today no horizontal overflow at {width}', overflow <= 0, f'excess={overflow}px')

    # ---------- Dark simulation (e) ----------
    body_bg_before = page.evaluate("getComputedStyle(document.body).backgroundColor")
    page.evaluate("document.documentElement.setAttribute('data-theme','dark')")
    page.wait_for_timeout(150)
    body_bg_after = page.evaluate("getComputedStyle(document.body).backgroundColor")
    check('data-theme=dark changes body background', body_bg_before != body_bg_after,
          f'{body_bg_before} -> {body_bg_after}')
    probe = page.evaluate(PROBE)
    results['measurements']['dark_text_on_surface'] = probe
    check('dark: body text (--text) on card surface (--surface) >= 4.5:1', probe['ratio'] >= 4.5,
          f"{probe['ratio']}:1 {probe['text_color']} on {probe['surface_color']}")
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(80)
    for tab_name in ['Today', 'Plan']:
        m = tab_label(tab_name)
        results['measurements'][f'dark_tab_{tab_name}'] = m
        check(f'dark: tab label "{tab_name}" >= 4.5:1', m['ratio'] >= 4.5, f"{m['ratio']}:1 {m['color']} on {m['background']}")
    page.screenshot(path=str(OUT / 'today-dark-mobile.png'), full_page=True)
    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.wait_for_timeout(80)
    page.screenshot(path=str(OUT / 'today-dark-desktop.png'))
    page.evaluate("document.documentElement.removeAttribute('data-theme')")

    # ---------- pageerror guard (f) ----------
    check('no pageerror events during the run', not results['pageerrors'], results['pageerrors'])

    (OUT / 'theme-results.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    print(json.dumps(results['measurements'], indent=2))
    print('screenshots:', OUT)
    browser.close()
    print('ALL CHECKS PASSED')
