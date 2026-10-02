# -*- coding: utf-8 -*-
# 从 Edge localStorage leveldb 二进制数据中抢救英语词汇通存档(一次性工具)
import os, glob, json, time, datetime

d = r"C:\Users\红衣\AppData\Local\Microsoft\Edge\User Data\Default\Local Storage\leveldb"
files = sorted(glob.glob(os.path.join(d, '*')))
cands = []

def extract_jsons(data, marker):
    """在二进制数据里找 marker,从其后的第一个 { 做括号配对提取完整 JSON"""
    out = []
    pos = 0
    BS = b'\\'
    while True:
        i = data.find(marker, pos)
        if i < 0:
            break
        pos = i + len(marker)
        j = data.find(b'{', pos, pos + 300)
        if j < 0:
            continue
        depth = 0
        in_str = False
        esc = False
        end = -1
        k = j
        while k < len(data) and k - j < 2_000_000:
            b = data[k:k+1]
            if in_str:
                if esc:
                    esc = False
                elif b == BS:
                    esc = True
                elif b == b'"':
                    in_str = False
            else:
                if b == b'"':
                    in_str = True
                elif b == b'{':
                    depth += 1
                elif b == b'}':
                    depth -= 1
                    if depth == 0:
                        end = k + 1
                        break
            k += 1
        if end > 0:
            try:
                obj = json.loads(data[j:end].decode('utf-8', errors='strict'))
                out.append(obj)
            except Exception:
                pass
    return out

for f in files:
    if os.path.isdir(f):
        continue
    try:
        data = open(f, 'rb').read()
    except Exception:
        continue
    for obj in extract_jsons(data, b'cet4_study_state_v1'):
        if isinstance(obj, dict) and ('libs' in obj or 'words' in obj or 'settings' in obj):
            libs = obj.get('libs') or {}
            words = sum(len((libs.get(k) or {}).get('words') or {}) for k in libs)
            days = len(obj.get('history') or {})
            cands.append({'file': os.path.basename(f), 'size': os.path.getsize(f),
                          'mtime': os.path.getmtime(f), 'words': words, 'days': days, 'state': obj})

cands.sort(key=lambda c: (c['words'], c['days'], c['mtime']), reverse=True)
print('共找到 %d 份候选存档:' % len(cands))
for c in cands[:8]:
    t = datetime.datetime.fromtimestamp(c['mtime']).strftime('%m-%d %H:%M')
    print('  %s: 词记录 %d, 历史 %d 天, 修改于 %s, %dB' % (c['file'], c['words'], c['days'], t, c['size']))

if cands:
    best = cands[0]
    libname = (best['state'].get('settings') or {}).get('lib', 'cet4')
    print('\n最佳存档: %s | 词库: %s | 词记录: %d | 历史: %d 天' % (best['file'], libname, best['words'], best['days']))
    lw = (best['state']['libs'].get(libname) or {}).get('words') or {}
    print('样例词:', list(lw.keys())[:10])
    stages = {}
    for w, r in lw.items():
        stages[r.get('stage', '?')] = stages.get(r.get('stage', '?'), 0) + 1
    print('stage 分布:', stages)
    out = {'app': 'cet4-vocab', 'version': 2, 'exportedAt': time.time() * 1000,
           'state': best['state'], '_note': '从电脑浏览器localStorage抢救恢复'}
    fn = '进度恢复_20261002.json'
    with open(fn, 'w', encoding='utf-8') as fp:
        json.dump(out, fp, ensure_ascii=False)
    print('\n已生成导入文件:', fn, '(发给手机 → 设置 → 导入进度)')
else:
    print('没有可解析的完整存档')
