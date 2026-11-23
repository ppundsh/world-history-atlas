# 人為災害地圖：把 source_world.py 與 source_tw_jp.py 的事件整理成 disasters.json，再由 build_disaster.mjs 產生網站資料。
#   python3 data-pipeline/disaster/make_json.py
# 每個事件的欄位：
#   id、c 類別（nuclear 核能與輻射、dam 潰壩與土石堆、chem 化學與工業、marine 海洋污染、air 空氣污染、war 戰爭與核試、eco 長期生態破壞）
#   dt 日期（YYYY、YYYY-MM 或 YYYY-MM-DD）；b 急性期結束年（預設同年）；k 影響範圍淡化後保留到哪一年（例如隔離區保留到 2026）
#   lon、lat 事故地點；sh 影響範圍：c:半徑km｜e:長半軸km,短半軸km,方位角°｜p:長度km,寬度km,方位角°（由事故點向外延伸的煙羽）｜g:經,緯 經,緯 …（多邊形）
#   gd 範圍擴散所需天數；rt 下游或漂流路線（經,緯 …）；rd 路線走完所需天數；sz 規模 1–3（各類依自身指標：核事故看 INES 分級、漏油看噸數、其他看死傷）
#   zh/en/ja 名稱；dzh/den 說明；dead 死亡人數（可為區間，「+」表示以上）；mzh/men 規模指標；rzh/ren 影響範圍的依據
#   wzh/wen/wja 維基百科條目；det=1 放大後才顯示的較小事件；nolabel=1 只畫範圍（例如隔離區）
import json, os, re
here = os.path.dirname(os.path.abspath(__file__))
out = []
for f in ('source_world.py', 'source_tw_jp.py'):
    ns = {}
    exec(open(os.path.join(here, f), encoding='utf-8').read(), ns)
    out += ns['E']
ids = set()
for e in out:
    assert e['id'] not in ids, e['id']; ids.add(e['id'])
    assert e['c'] in ('nuclear', 'dam', 'chem', 'marine', 'air', 'war', 'eco'), e['id']
    assert re.fullmatch(r'-?\d{4}(-\d\d(-\d\d)?)?', e['dt']), e['id']
    assert -180 <= e['lon'] <= 180 and -90 <= e['lat'] <= 90, e['id']
    if e.get('sh'): assert re.fullmatch(r'[cepg]:.+', e['sh']), e['id']
    assert e.get('rt') or e.get('sh'), e['id'] + ': no range or route'
    for k in ('zh', 'en', 'ja', 'dzh', 'den'): assert e.get(k), e['id'] + ' ' + k
json.dump(out, open(os.path.join(here, 'disasters.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(len(out), 'events')
