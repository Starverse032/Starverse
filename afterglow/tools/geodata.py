#!/usr/bin/env python3
"""Regenerate web/src/data/land.js and places.js from Natural Earth (public domain) GeoJSON.

  curl -LO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson
  curl -LO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_lakes.geojson
  curl -LO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson
  python3 tools/geodata.py <dir with the three files>

The geodata is only used as coordinates: the film's code rasterises the coastlines and
synthesises the city lights itself (no imagery is used).
"""
import json
import os
import sys

src = sys.argv[1] if len(sys.argv) > 1 else '.'
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'src', 'data')


def simp(ring, tol):
    out = [ring[0]]
    for p in ring[1:]:
        q = out[-1]
        if abs(p[0] - q[0]) > tol or abs(p[1] - q[1]) > tol:
            out.append(p)
    return out


def polys(fn, tol=0.06):
    g = json.load(open(os.path.join(src, fn)))
    res = []
    for f in g['features']:
        geom = f['geometry']
        ps = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
        for poly in ps:
            for k, ring in enumerate(poly):
                r = simp(ring, tol)
                if len(r) >= 4:
                    res.append({'hole': k > 0, 'pts': [round(c, 2) for p in r for c in p]})
    return res


land = polys('ne_50m_land.geojson')
lakes = polys('ne_50m_lakes.geojson')
places = []
for f in json.load(open(os.path.join(src, 'ne_10m_populated_places_simple.geojson')))['features']:
    pop = f['properties'].get('pop_max') or 0
    if pop >= 15000:
        lon, lat = f['geometry']['coordinates'][:2]
        places.append([round(lon, 2), round(lat, 2), int(pop)])
places.sort(key=lambda x: -x[2])
hdr = '// Natural Earth (public domain, naturalearthdata.com) — simplified by tools/geodata.py. Coordinates are [lon, lat] degrees.\n'
J = lambda o: json.dumps(o, separators=(',', ':'))
with open(os.path.join(dst, 'land.js'), 'w') as f:
    f.write(hdr + 'export const LAND = ' + J([r['pts'] for r in land if not r['hole']]) + ';\n'
            + 'export const LAND_HOLES = ' + J([r['pts'] for r in land if r['hole']]) + ';\n'
            + 'export const LAKES = ' + J([r['pts'] for r in lakes if not r['hole']]) + ';\n')
with open(os.path.join(dst, 'places.js'), 'w') as f:
    f.write(hdr + '// [lon, lat, population] for populated places with population >= 15,000, sorted by population.\n'
            + 'export const PLACES = ' + J(places) + ';\n')
print(len(land), 'land rings,', len(lakes), 'lakes,', len(places), 'places')
