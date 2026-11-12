#!/usr/bin/env python3
"""Convert the raw OpenStreetMap extract of SZU Canghai campus into compact game data.

Input : tools/osm/area.json, rels.json, boundary.json   (Overpass API, (c) OpenStreetMap contributors, ODbL)
Output: src/data/campus.json

Local frame: +x = east, +z = south, y = up, metres, origin at (LAT0, LON0).
"""
import json, math, os, random, hashlib
from shapely.geometry import Polygon, MultiPolygon, LineString, Point, box, GeometryCollection
from shapely.ops import unary_union
from shapely.prepared import prep
from shapely.strtree import STRtree

HERE = os.path.dirname(os.path.abspath(__file__))
LAT0, LON0 = 22.5315, 113.9345
MX = 111320 * math.cos(math.radians(LAT0))
MZ = 111320
WORLD = box(-548, -526, 548, 526)          # playable / detailed region
random.seed(20261112)


def xy(p):
    return ((p['lon'] - LON0) * MX, -(p['lat'] - LAT0) * MZ)


def nkey(p):
    return (round(p['lat'] * 1e7), round(p['lon'] * 1e7))


def hsh(*a):
    return int(hashlib.md5(repr(a).encode()).hexdigest()[:8], 16) / 0xffffffff


def load(name):
    return json.load(open(os.path.join(HERE, 'osm', name)))


area = load('area.json')['elements']
rels = load('rels.json')['elements']
bnd = load('boundary.json')['elements'][0]

ways = [e for e in area if e['type'] == 'way' and 'geometry' in e]
nodes = [e for e in area if e['type'] == 'node']


def poly_of(pts, holes=()):
    try:
        p = Polygon(pts, holes)
        if not p.is_valid:
            p = p.buffer(0)
        return p
    except Exception:
        return None


def polys(g):
    """flatten any geometry into a list of Polygons"""
    if g is None or g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    if isinstance(g, (MultiPolygon, GeometryCollection)):
        out = []
        for s in g.geoms:
            out += polys(s)
        return out
    return []


def ring(coords, nd=2):
    c = list(coords)
    if len(c) > 1 and c[0] == c[-1]:
        c = c[:-1]
    out = []
    for x, z in c:
        out += [round(x, nd), round(z, nd)]
    return out


def poly_json(p, nd=2):
    return {'o': ring(p.exterior.coords, nd), 'h': [ring(h.coords, nd) for h in p.interiors]}


# ---------------------------------------------------------------- boundaries
canghai = poly_of([xy(p) for p in bnd['geometry']])
yuehai = None
for r in rels:
    if r['id'] == 13900447:
        outer = [m for m in r['members'] if m['role'] == 'outer'][0]
        yuehai = poly_of([xy(p) for p in outer['geometry']])

# ---------------------------------------------------------------- buildings
FLOOR = {'university': 4.2, 'dormitory': 3.3, 'apartments': 3.0, 'commercial': 4.0, 'office': 4.0,
         'yes': 3.8, 'construction': 3.6}

# official names (2019 naming scheme) for the Canghai campus buildings
OVERRIDE = {
    319101983: dict(name='致腾楼', sub='计算机与软件学院', style='tengbase', color='#d9c0a2', levels=3),
    776358632: dict(name='致腾楼', style='teng', color='#d9c0a2'),
    231086125: dict(name='致信楼', sub='电子与信息工程学院 · 机电与控制工程学院', style='xin'),
    231086119: dict(style='xin', levels=5),
    231086126: dict(style='xin', levels=4),
    319101984: dict(name='致原楼', sub='物理与光电工程学院', style='yuanbase', levels=3),
    231086366: dict(name='致工楼', sub='土木与交通工程学院', style='gong'),
    984606893: dict(name='致知楼', sub='高等研究院', style='zhi'),
    984606892: dict(name='致理楼 L4', sub='理工教学楼', style='li'),
    654873809: dict(name='致理楼 L1', sub='理工教学楼', style='li'),
    654873808: dict(name='致理楼 L2', sub='理工教学楼', style='li'),
    629940891: dict(name='致理楼 L3', sub='理工教学楼', style='li'),
    776358622: dict(style='li'),
    629940892: dict(name='致真楼', sub='实验楼', style='zhen'),
    629940889: dict(name='致艺楼', sub='传播学院 · 艺术学部（洞洞楼）', style='holes'),
    629940890: dict(name='致艺楼', sub='传播学院 · 艺术学部（洞洞楼）', style='holes'),
    776358621: dict(style='holesbase'),
    722200010: dict(name='演播厅', style='studio'),
    776358623: dict(style='li'),
    319101979: dict(name='南区餐厅', sub='沧海校区食堂', style='canteen', levels=3, fh=5.0),
    292598302: dict(name='春笛', sub='学生公寓', style='dorm'),
    292598304: dict(name='夏筝', sub='学生公寓', style='dorm'),
    13233284: dict(name='秋瑟', sub='学生公寓', style='dorm'),
    220880938: dict(name='冬筑', sub='学生公寓', style='dorm'),
    292598303: dict(name='高音', sub='学生公寓', style='dorm'),
    242066977: dict(name='低音', sub='学生公寓', style='dorm'),
}
for pid in (776358624, 776358625, 776358626, 776358627, 776358628, 776358629, 776358630, 776358631):
    OVERRIDE.setdefault(pid, {})['style'] = 'yuan'
OVERRIDE[776358630]['style'] = 'yuanbase'
OVERRIDE[776358631]['style'] = 'yuanbase'

GLASS_NAMES = ('大厦', '研究院', '中心', '大楼', '基地', '栋')


def guess_levels(t, kind, a, bid):
    r = hsh('lv', bid)
    if kind == 'commercial':
        if a > 4500:
            return 6 + int(r * 6)
        if a > 2000:
            return 9 + int(r * 12)
        return 8 + int(r * 16)
    if kind == 'university':
        return 4 + int(r * 3)
    if kind == 'dormitory':
        return 6 + int(r * 3)
    if kind == 'apartments':
        return 7 + int(r * 18) if a > 500 else 7
    if kind == 'construction':
        return 4 + int(r * 8)
    if a < 60:
        return 1
    if a < 300:
        return 1 + int(r * 3)
    return 2 + int(r * 4)


def style_of(t, kind, name, levels, a, bid, in_campus, in_yuehai):
    mat = t.get('building:material', '')
    r = hsh('st', bid)
    if kind == 'construction':
        return 'construction'
    if kind in ('commercial', 'office'):
        if mat in ('mirror', 'glass') or levels >= 24:
            return 'glass'
        return 'glass' if r < 0.55 else 'office'
    if kind == 'dormitory':
        return 'dorm' if levels >= 9 else 'dormlow'
    if kind == 'apartments':
        return 'resi'
    if kind == 'university':
        return 'li' if in_campus else 'uni'
    if in_yuehai or in_campus:
        return 'uni' if a > 300 else 'small'
    return 'office' if a > 800 else 'small'


buildings = []
bpolys = []          # shapely footprints (ground-touching) for spatial queries


def add_building(bid, t, outer, holes=()):
    part = 'building:part' in t
    kind = t.get('building:part') if part else t.get('building')
    if kind in ('train_station',):
        return
    if kind == 'yes' and part:
        kind = 'commercial'
    p = poly_of(outer, holes)
    if p is None or p.is_empty:
        return
    if not p.intersects(WORLD.buffer(60)):
        return
    for p in polys(p):
        if p.area < 12:
            continue
        ov = OVERRIDE.get(bid, {})
        c = p.representative_point()
        in_campus = canghai.contains(c)
        in_yuehai = yuehai is not None and yuehai.contains(c)
        name = ov.get('name', t.get('name', ''))
        levels = ov.get('levels')
        if levels is None:
            lv = t.get('building:levels')
            levels = float(lv) if lv else None
        if levels is not None and levels <= 0:
            continue
        guessed = levels is None
        if guessed:
            levels = guess_levels(t, kind, p.area, bid)
        fh = ov.get('fh', FLOOR.get(kind, 3.8))
        if 'height' in t and 'levels' not in ov:
            h = float(t['height'])
            fh = h / max(1.0, levels)
        else:
            h = levels * fh
        mh = 0.0
        if 'min_height' in t:
            mh = float(t['min_height'])
        elif 'building:min_level' in t:
            mh = float(t['building:min_level']) * fh
        style = ov.get('style') or style_of(t, kind, name, levels, p.area, bid, in_campus, in_yuehai)
        b = dict(id=bid, n=name, s=ov.get('sub', ''), k=kind, st=style, lv=int(round(levels)), fh=round(fh, 2),
                 ht=round(h, 1), mh=round(mh, 1), part=1 if part else 0, c=1 if in_campus else (2 if in_yuehai else 0),
                 col=ov.get('color', t.get('building:colour', '')), sd=round(hsh('seed', bid), 4))
        b.update(poly_json(p))
        b['cx'] = round(c.x, 1)
        b['cz'] = round(c.y, 1)
        b['a'] = round(p.area)
        buildings.append(b)
        if mh < 3:
            bpolys.append(p)


for e in ways:
    t = e.get('tags', {})
    if 'building' in t or 'building:part' in t:
        add_building(e['id'], t, [xy(p) for p in e['geometry']])
for r in rels:
    t = r.get('tags', {})
    if 'building' in t:
        outers = [m for m in r['members'] if m['role'] == 'outer' and 'geometry' in m]
        inners = [m for m in r['members'] if m['role'] == 'inner' and 'geometry' in m]
        for o in outers:
            op = poly_of([xy(p) for p in o['geometry']])
            hs = []
            for i in inners:
                ip = [xy(p) for p in i['geometry']]
                if op is not None and op.contains(Point(ip[0])):
                    hs.append(ip)
            add_building(r['id'], t, [xy(p) for p in o['geometry']], hs)

bld_union = unary_union(bpolys)
bld_tree = STRtree(bpolys)


def near_building(x, z, d=1.5):
    pt = Point(x, z)
    for i in bld_tree.query(pt.buffer(d)):
        if bpolys[i].distance(pt) <= d:
            return True
    return False


# ---------------------------------------------------------------- roads & paths
CARW = {'primary': 12.0, 'primary_link': 7.0, 'secondary': 10.0, 'tertiary': 8.0, 'unclassified': 6.5,
        'residential': 6.0, 'service': 4.6, 'turning_loop': 6.0}
SIDEWALK = {'primary': 3.5, 'primary_link': 2.5, 'secondary': 3.5, 'tertiary': 3.0, 'unclassified': 1.6,
            'residential': 1.6, 'service': 0.0}
FOOT = ('footway', 'path', 'steps', 'pedestrian', 'cycleway')
ELEV = 6.0
SKY = {1272661380: 12.6, 1272661379: 29.4, 1272661378: 46.2}

roads = []        # ground level car roads (centre lines)
foots = []        # ground level foot paths
decks = []        # elevated walkways / bridges / stairs
plazas = []
road_geoms, walk_geoms, foot_geoms, plaza_geoms = [], [], [], []


def layer_of(t):
    try:
        return int(float(t.get('layer', '0')))
    except ValueError:
        return 0


def densify(pts, step=4.0):
    out = [pts[0]]
    for i in range(1, len(pts)):
        x0, z0 = pts[i - 1]
        x1, z1 = pts[i]
        d = math.hypot(x1 - x0, z1 - z0)
        n = max(1, int(math.ceil(d / step)))
        for k in range(1, n + 1):
            out.append((x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n))
    return out


def cumlen(pts):
    s = [0.0]
    for i in range(1, len(pts)):
        s.append(s[-1] + math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
    return s


hw = [e for e in ways if 'highway' in e.get('tags', {})]
bridge_ways, step_ways = [], []
for e in hw:
    t = e['tags']
    h = t['highway']
    if t.get('area') == 'yes':
        continue
    if h == 'steps':
        step_ways.append(e)
    elif t.get('bridge') and (h in FOOT or h in CARW) and layer_of(t) >= 0:
        bridge_ways.append(e)

# nodes touched by bridges / stairs -> used to decide which bridge ends stay in the air
touch = {}
for e in bridge_ways + step_ways:
    for p in e['geometry']:
        touch.setdefault(nkey(p), set()).add(e['id'])

node_elev = {}
for e in bridge_ways:
    t = e['tags']
    h = t['highway']
    car = h in CARW
    E = SKY.get(e['id'], ELEV)
    g = e['geometry']
    pts = [xy(p) for p in g]

    def attached(i):
        k = nkey(g[i])
        if len(touch.get(k, ())) > 1:
            return True
        return near_building(pts[i][0], pts[i][1], 2.5)

    a0, a1 = attached(0), attached(-1)
    if e['id'] in SKY:
        a0 = a1 = True
    slope = 1 / 9.0 if car else 1 / 6.0
    dp = densify(pts, 3.0)
    s = cumlen(dp)
    L = s[-1]
    ys = []
    for i in range(len(dp)):
        y = E
        if not a0:
            y = min(y, s[i] * slope)
        if not a1:
            y = min(y, (L - s[i]) * slope)
        ys.append(y)
    # remember elevation at original nodes
    so = cumlen(pts)
    for i, p in enumerate(g):
        y = E
        if not a0:
            y = min(y, so[i] * slope)
        if not a1:
            y = min(y, (so[-1] - so[i]) * slope)
        k = nkey(p)
        node_elev[k] = max(node_elev.get(k, 0), y)
    w = 7.0 if car else (5.0 if t.get('name') else 3.2)
    if e['id'] in SKY:
        w = 4.0
    decks.append(dict(id=e['id'], k='road' if car else 'foot', w=w, n=t.get('name', ''),
                      p=[round(v, 2) for i in range(len(dp)) for v in (dp[i][0], ys[i], dp[i][1])]))

for e in step_ways:
    g = e['geometry']
    pts = [xy(p) for p in g]
    y0 = node_elev.get(nkey(g[0]), 0.0)
    y1 = node_elev.get(nkey(g[-1]), 0.0)
    if y0 < 0.3 and y1 < 0.3:
        if layer_of(e['tags']) >= 0 and not e['tags'].get('tunnel'):
            foot_geoms.append(LineString(pts).buffer(1.3, quad_segs=2, cap_style='flat'))
        continue
    dp = densify(pts, 1.0)
    s = cumlen(dp)
    L = max(s[-1], 0.01)
    # keep stairs at a believable pitch: extend the low end if the way is too short
    need = abs(y1 - y0) / 0.62
    if L < need:
        if y0 < y1:
            dx, dz = pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]
            d = math.hypot(dx, dz) or 1
            pts = [(pts[0][0] + dx / d * (need - L), pts[0][1] + dz / d * (need - L))] + pts
        else:
            dx, dz = pts[-1][0] - pts[-2][0], pts[-1][1] - pts[-2][1]
            d = math.hypot(dx, dz) or 1
            pts = pts + [(pts[-1][0] + dx / d * (need - L), pts[-1][1] + dz / d * (need - L))]
        dp = densify(pts, 1.0)
        s = cumlen(dp)
        L = s[-1]
    decks.append(dict(id=e['id'], k='steps', w=2.6, n='',
                      p=[round(v, 2) for i in range(len(dp)) for v in (dp[i][0], y0 + (y1 - y0) * s[i] / L, dp[i][1])]))

for e in hw:
    t = e['tags']
    h = t['highway']
    L = layer_of(t)
    if h == 'steps' or e in bridge_ways:
        continue
    if t.get('tunnel') or L < 0 or t.get('covered') == 'yes':
        continue
    pts = [xy(p) for p in e['geometry']]
    if t.get('area') == 'yes' or (h == 'pedestrian' and pts[0] == pts[-1] and len(pts) > 3):
        p = poly_of(pts)
        if p is not None:
            plaza_geoms.append(p)
        continue
    if len(pts) < 2:
        continue
    ls = LineString(pts)
    if not ls.intersects(WORLD):
        continue
    if h in CARW:
        w = CARW[h]
        lanes = t.get('lanes')
        if lanes:
            w = max(w if h in ('primary',) else 0, float(lanes) * 3.4 + 1.0)
        elif t.get('oneway') == 'yes' and h in ('tertiary', 'unclassified', 'secondary'):
            w *= 0.85
        road_geoms.append(ls.buffer(w / 2, quad_segs=3, cap_style='round'))
        sw = SIDEWALK.get(h, 0)
        if sw:
            walk_geoms.append(ls.buffer(w / 2 + sw, quad_segs=3, cap_style='round'))
        roads.append(dict(k=h, w=round(w, 1), ow=1 if t.get('oneway') == 'yes' else 0, n=t.get('name', ''),
                          p=ring(pts)))
    elif h in FOOT:
        # ramps from elevated nodes down to the ground
        e0 = node_elev.get(nkey(e['geometry'][0]), 0.0)
        e1 = node_elev.get(nkey(e['geometry'][-1]), 0.0)
        w = 2.6 if h != 'pedestrian' else 5.0
        if (e0 > 1.0 or e1 > 1.0) and ls.length > 8:
            dp = densify(pts, 2.0)
            s = cumlen(dp)
            Lt = s[-1]
            ys = []
            for i in range(len(dp)):
                y = 0.0
                if e0 > 1.0:
                    y = max(y, e0 - s[i] / 5.0)
                if e1 > 1.0:
                    y = max(y, e1 - (Lt - s[i]) / 5.0)
                ys.append(y)
            # split into elevated part (deck) and ground part
            cur = []
            for i in range(len(dp)):
                if ys[i] > 0.02:
                    cur.append((dp[i][0], ys[i], dp[i][1]))
                else:
                    if cur:
                        cur.append((dp[i][0], 0.0, dp[i][1]))
                        decks.append(dict(id=e['id'], k='ramp', w=3.0, n='', p=[round(v, 2) for q in cur for v in q]))
                        cur = []
            if len(cur) > 1:
                decks.append(dict(id=e['id'], k='ramp', w=3.0, n='', p=[round(v, 2) for q in cur for v in q]))
        foot_geoms.append(ls.buffer(w / 2, quad_segs=2, cap_style='round'))

# ---------------------------------------------------------------- areas
grass_g, wood_g, water_g, park_g, parking_g, pool_g = [], [], [], [], [], []
pitches = []
for e in ways:
    t = e.get('tags', {})
    pts = [xy(p) for p in e['geometry']]
    if len(pts) < 4 or pts[0] != pts[-1]:
        continue
    lu, le, na, am = t.get('landuse'), t.get('leisure'), t.get('natural'), t.get('amenity')
    if not (lu or le or na or am):
        continue
    p = poly_of(pts)
    if p is None or p.is_empty or not p.intersects(WORLD):
        continue
    if lu in ('grass', 'flowerbed', 'greenfield', 'recreation_ground', 'village_green'):
        grass_g.append(p)
    elif le in ('park', 'garden'):
        park_g.append(p)
    elif na == 'wood':
        wood_g.append(p)
    elif na == 'water':
        water_g.append(p)
    elif le == 'swimming_pool':
        pool_g.append(p)
    elif am == 'parking':
        parking_g.append(p)
    elif le == 'pitch':
        rr = p.minimum_rotated_rectangle
        c = list(rr.exterior.coords)[:4]
        e1 = (c[1][0] - c[0][0], c[1][1] - c[0][1])
        e2 = (c[2][0] - c[1][0], c[2][1] - c[1][1])
        l1, l2 = math.hypot(*e1), math.hypot(*e2)
        if l1 >= l2:
            ang, ln, wd = math.atan2(e1[1], e1[0]), l1, l2
        else:
            ang, ln, wd = math.atan2(e2[1], e2[0]), l2, l1
        pitches.append(dict(sp=t.get('sport', 'multi'), sf=t.get('surface', ''), cx=round(rr.centroid.x, 2),
                            cz=round(rr.centroid.y, 2), a=round(ang, 4), l=round(ln, 2), w=round(wd, 2), poly=p))
for r in rels:
    t = r.get('tags', {})
    if t.get('natural') == 'wood' or t.get('highway') == 'pedestrian':
        outers = [m for m in r['members'] if m['role'] == 'outer' and 'geometry' in m]
        inners = [m for m in r['members'] if m['role'] == 'inner' and 'geometry' in m]
        for o in outers:
            p = poly_of([xy(q) for q in o['geometry']], [[xy(q) for q in i['geometry']] for i in inners])
            if p is None:
                continue
            (wood_g if t.get('natural') == 'wood' else plaza_geoms).append(p)

# ---------------------------------------------------------------- planar partition of the ground
BIG = WORLD
road_u = unary_union(road_geoms + parking_g).intersection(BIG)
water_u = unary_union(water_g).intersection(BIG) if water_g else Polygon()
pool_u = unary_union(pool_g).intersection(BIG) if pool_g else Polygon()
pitch_u = unary_union([p['poly'] for p in pitches]) if pitches else Polygon()
plaza_u = unary_union(plaza_geoms).intersection(BIG) if plaza_geoms else Polygon()
apron_u = bld_union.buffer(3.0, quad_segs=2, join_style='mitre')
pave_u = unary_union(foot_geoms + walk_geoms + [apron_u]).intersection(BIG)
grass_u = unary_union(grass_g + park_g).intersection(BIG)
wood_u = unary_union(wood_g).intersection(BIG) if wood_g else Polygon()
campus_u = unary_union([g for g in (canghai, yuehai) if g is not None]).intersection(BIG)

taken = Polygon()
layers = {}


def claim(name, g):
    global taken
    g = g.difference(taken) if not taken.is_empty else g
    g = g.buffer(0)
    layers[name] = g
    taken = unary_union([taken, g])
    return g


claim('road', road_u)
claim('water', water_u)
claim('pool', pool_u)
claim('pitch', pitch_u)
claim('plaza', plaza_u)
claim('pave', pave_u)
claim('wood', wood_u)
claim('grass', grass_u)
claim('lawn', campus_u)          # leftover campus land = lawn
claim('city', BIG)               # leftover outside the campuses = city paving

ground = {}
for name, g in layers.items():
    if name == 'pitch':
        continue
    out = []
    for p in polys(g):
        p = p.simplify(0.04, preserve_topology=True)
        if p.area < 0.5:
            continue
        out.append(poly_json(p))
    ground[name] = out
for pt in pitches:
    g = pt.pop('poly').difference(unary_union([layers['road'], layers['water'], layers['pool']]))
    pp = polys(g)
    if not pp:
        continue
    pt.update(poly_json(max(pp, key=lambda q: q.area)))
pitches = [p for p in pitches if 'o' in p]

# ---------------------------------------------------------------- support columns under elevated decks
road_buf = layers['road'].buffer(0.7)
for d in decks:
    d['c'] = []
    if d['k'] not in ('foot', 'road') or d['id'] in SKY:
        continue
    P = d['p']
    pts = [(P[i], P[i + 1], P[i + 2]) for i in range(0, len(P), 3)]
    s, nxt = 0.0, 3.0
    for i in range(1, len(pts)):
        seg = math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2])
        while seg > 0 and nxt <= s + seg:
            t = (nxt - s) / seg
            x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t
            y = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t
            z = pts[i - 1][2] + (pts[i][2] - pts[i - 1][2]) * t
            pt = Point(x, z)
            if y > 2.4 and not road_buf.contains(pt) and not bld_union.contains(pt):
                d['c'] += [round(x, 2), round(y, 2), round(z, 2)]
            nxt += 12.0
        s += seg

# ---------------------------------------------------------------- vegetation & street furniture
deck_lines = []
for d in decks:
    c = [(d['p'][i], d['p'][i + 2]) for i in range(0, len(d['p']), 3)]
    if len(c) > 1:
        deck_lines.append(LineString(c).buffer(d['w'] / 2 + 1.2, quad_segs=2))
deck_u = unary_union(deck_lines) if deck_lines else Polygon()
hard_u = unary_union([bld_union.buffer(2.6), layers['road'].buffer(0.9), layers['water'], layers['pool'],
                      layers['pitch'].buffer(1.5), deck_u, layers['plaza'].buffer(-2.0)])
hard_p = prep(hard_u)
foot_u = unary_union(foot_geoms) if foot_geoms else Polygon()
foot_p = prep(foot_u)

trees = []          # x, z, type, scale, rot
tree_pts = []
GRID = {}


def far_enough(x, z, d):
    gx, gz = int(x // 8), int(z // 8)
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for (px, pz) in GRID.get((gx + i, gz + j), ()):
                if (px - x) ** 2 + (pz - z) ** 2 < d * d:
                    return False
    return True


def put_tree(x, z, ty, sc, mind):
    if not WORLD.contains(Point(x, z)):
        return False
    if hard_p.contains(Point(x, z)) or not far_enough(x, z, mind):
        return False
    GRID.setdefault((int(x // 8), int(z // 8)), []).append((x, z))
    trees.append([round(x, 1), round(z, 1), ty, round(sc, 2), round(random.random() * 6.28, 2)])
    return True


# street trees: rows along the kerb
for r in roads:
    if r['k'] in ('service', 'primary_link'):
        continue
    pts = [(r['p'][i], r['p'][i + 1]) for i in range(0, len(r['p']), 2)]
    ls = LineString(pts)
    if ls.length < 20:
        continue
    major = r['k'] in ('primary', 'secondary', 'tertiary')
    c = ls.centroid
    incampus = canghai.contains(c)
    palm = incampus and hsh('palm', r['p'][0], r['p'][1]) < 0.45
    off = r['w'] / 2 + (1.9 if major else 1.3)
    spacing = 11.0 if major else (8.5 if not palm else 7.0)
    for side in (1, -1):
        try:
            o = ls.parallel_offset(off, 'left' if side > 0 else 'right', join_style=2)
        except Exception:
            continue
        for part in (o.geoms if hasattr(o, 'geoms') else [o]):
            if part.is_empty or part.length < spacing:
                continue
            d = spacing * (0.3 + 0.4 * random.random())
            while d < part.length:
                q = part.interpolate(d)
                ty = 2 if palm else (0 if major else random.choice((0, 1, 1, 4)))
                put_tree(q.x + random.uniform(-0.3, 0.3), q.y + random.uniform(-0.3, 0.3), ty,
                         random.uniform(0.85, 1.2), 4.0)
                d += spacing * random.uniform(0.9, 1.12)


def scatter(g, density, types, mind):
    for p in polys(g):
        minx, minz, maxx, maxz = p.bounds
        n = int(p.area * density)
        pp = prep(p)
        tries = 0
        placed = 0
        while placed < n and tries < n * 12:
            tries += 1
            x, z = random.uniform(minx, maxx), random.uniform(minz, maxz)
            if not pp.contains(Point(x, z)):
                continue
            if foot_p.contains(Point(x, z)):
                continue
            if put_tree(x, z, random.choice(types), random.uniform(0.75, 1.3), mind):
                placed += 1


scatter(layers['wood'], 1 / 55.0, (0, 0, 1, 4, 4), 4.5)
scatter(layers['grass'], 1 / 190.0, (0, 1, 1, 3, 4, 2), 6.0)
scatter(layers['lawn'], 1 / 150.0, (0, 1, 1, 3, 4, 4, 2), 5.5)
scatter(layers['city'], 1 / 1500.0, (0, 1), 7.0)

# lamp posts along roads
lamps = []
for r in roads:
    if r['k'] in ('primary_link',):
        continue
    pts = [(r['p'][i], r['p'][i + 1]) for i in range(0, len(r['p']), 2)]
    ls = LineString(pts)
    if ls.length < 25:
        continue
    major = r['k'] in ('primary', 'secondary', 'tertiary')
    spacing = 36.0 if major else 30.0
    off = r['w'] / 2 + 0.7
    d = spacing * random.random()
    side = 1
    while d < ls.length:
        q = ls.interpolate(d)
        q2 = ls.interpolate(min(ls.length, d + 0.5))
        dx, dz = q2.x - q.x, q2.y - q.y
        ln = math.hypot(dx, dz) or 1
        nx, nz = -dz / ln * side, dx / ln * side
        x, z = q.x + nx * off, q.y + nz * off
        pt = Point(x, z)
        if WORLD.contains(pt) and not bld_union.buffer(0.6).contains(pt) and not layers['road'].contains(pt):
            ok = True
            for (lx, lz, *_r) in lamps[-60:]:
                if (lx - x) ** 2 + (lz - z) ** 2 < 100:
                    ok = False
                    break
            if ok:
                lamps.append([round(x, 1), round(z, 1), round(math.atan2(-nz, -nx), 2), 1 if major else 0])
        d += spacing
        if not major:
            side = -side

# ---------------------------------------------------------------- points of interest
pois = []
for n in nodes:
    t = n.get('tags', {})
    x, z = xy(n)
    if not WORLD.contains(Point(x, z)):
        continue
    if t.get('barrier') == 'gate' and t.get('name'):
        pois.append(dict(k='gate', n=t['name'], x=round(x, 1), z=round(z, 1)))
    elif t.get('highway') == 'crossing':
        pois.append(dict(k='crossing', x=round(x, 1), z=round(z, 1)))
    elif t.get('highway') == 'bus_stop':
        pois.append(dict(k='bus', n=t.get('name', ''), x=round(x, 1), z=round(z, 1)))
    elif t.get('railway') == 'subway_entrance':
        pois.append(dict(k='metro', n=t.get('name', t.get('ref', '')), x=round(x, 1), z=round(z, 1)))
    elif t.get('tourism') == 'artwork':
        pois.append(dict(k='art', n=t.get('name', ''), x=round(x, 1), z=round(z, 1)))
    elif t.get('amenity') == 'bench':
        pois.append(dict(k='bench', x=round(x, 1), z=round(z, 1)))
    elif t.get('amenity') == 'fountain':
        pois.append(dict(k='fountain', x=round(x, 1), z=round(z, 1)))

out = dict(
    origin=dict(lat=LAT0, lon=LON0),
    world=[-548, -526, 548, 526],
    canghai=ring(canghai.exterior.coords),
    yuehai=ring(yuehai.intersection(WORLD.buffer(40)).exterior.coords) if yuehai is not None else [],
    buildings=buildings, roads=roads, decks=decks, ground=ground, pitches=pitches,
    trees=trees, lamps=lamps, pois=pois,
)
dst = os.path.join(HERE, '..', 'src', 'data')
os.makedirs(dst, exist_ok=True)
with open(os.path.join(dst, 'campus.json'), 'w') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print('buildings', len(buildings), 'roads', len(roads), 'decks', len(decks), 'pitches', len(pitches),
      'trees', len(trees), 'lamps', len(lamps), 'pois', len(pois))
for k, v in ground.items():
    print('  ground', k, len(v), 'polys', sum(len(p['o']) // 2 + sum(len(h) // 2 for h in p['h']) for p in v), 'verts')
print('bytes', os.path.getsize(os.path.join(dst, 'campus.json')))
