"""
Applies the three Marketing.js edits. Run it in your repo root:
    python marketing-patch.py
It edits src/Marketing.js in place and tells you what it changed.
"""
import pathlib, sys

p = pathlib.Path('src/Marketing.js')
if not p.exists():
    sys.exit('src/Marketing.js not found. Run this from the repo root.')
s = p.read_text(encoding='utf-8')
done = []

# 1. Footer: privacy, data and contact links.
old_footer = """          <div className="footer-bottom">
            <span>&copy; 2026 Insova. All rights reserved.</span>
            <span>Cork, Ireland</span>
          </div>"""
new_footer = """          <div className="footer-links">
            <a href="/privacy.html">Privacy</a>
            <a href="/data.html">The data</a>
            <a href="mailto:contact@insova.ie">contact@insova.ie</a>
          </div>
          <div className="footer-bottom">
            <span>&copy; 2026 Insova. All rights reserved.</span>
            <span>Cork, Ireland</span>
          </div>"""
if old_footer in s:
    s = s.replace(old_footer, new_footer); done.append('footer links added')
elif 'footer-links' in s:
    done.append('footer links already present, skipped')
else:
    done.append('!! footer block not found, add the links by hand')

# 2. Typo, and a tense that matches the app's own What's next page.
old_ew = """              <p>
                We believe our model could be capable of predicitons one
                month before the actual shortage hits 
              </p>"""
new_ew = """              <p>
                We are building towards flagging a shortage roughly a month before it
                reaches the counter. The archive that makes that possible is being
                collected now.
              </p>"""
if old_ew in s:
    s = s.replace(old_ew, new_ew); done.append('early warning copy fixed (typo + tense)')
elif 'predicitons' in s:
    s = s.replace('predicitons', 'predictions'); done.append('typo fixed only')
else:
    done.append('early warning card already edited, skipped')

p.write_text(s, encoding='utf-8')
print('\n'.join('  - ' + d for d in done))