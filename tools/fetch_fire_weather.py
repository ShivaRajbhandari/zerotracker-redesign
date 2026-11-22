#!/usr/bin/env python3
"""
Fire-weather pipeline for the Net Zero Tracker redesign: downloads the Copernicus (CEMS) daily Fire Weather Index
(ERA5-based, 0.25 degrees, 1979 onward) ONE YEAR AT A TIME, boils each year down to a few small arrays, deletes the big
download, and at the end writes the two data files the website reads (gm_fwi.js for the world map, fwi.js for the charts).

Why it is built this way
  * Nothing is read by a person or a chat assistant, so it costs no tokens.
  * Disk use stays small: one year of daily data is about 1-2 GB, and it is deleted as soon as it is processed.
    The kept results are about 10-20 MB per year (compressed).  Use --workdir to put the temporary download on an external drive.
  * It can be stopped and restarted: finished years are skipped.

One-time setup
  1. python3 -m venv ~/fwi-venv && source ~/fwi-venv/bin/activate
     pip install cdsapi netCDF4 numpy shapely
  2. Log in at https://ewds.climate.copernicus.eu , open your profile, and copy the API url and key.  Create the file ~/.ewdsapirc
     with exactly two lines (the key is a secret: do not share it or commit it):
         url: https://ewds.climate.copernicus.eu/api
         key: <your key>
  3. On the dataset page (https://ewds.climate.copernicus.eu/datasets/cems-fire-historical-v1?tab=download) accept the licence once
     (scroll to the bottom of the Download tab) or requests are refused.

Run
  python fetch_fire_weather.py --out ./fwi_out --site /path/to/zerotracker-redesign        # everything, 1979-2025
  python fetch_fire_weather.py --years 1979 1990 --out ./fwi_out                           # just some years
  python fetch_fire_weather.py --aggregate-only --out ./fwi_out --site /path/to/zerotracker-redesign   # rebuild the website files
Then copy gm_fwi.js and fwi.js (written into --site) and commit them.  Requests wait in the Copernicus queue, so a full run takes
many hours; leave it running (for example under `caffeinate -i`).
"""
import argparse, os, sys, time, json, math, shutil, base64, tempfile, warnings
import numpy as np
warnings.filterwarnings('ignore')

DATASET = 'cems-fire-historical-v1'
# EFFIS fire danger classes: high from 21.3, very high from 38, extreme from 50 (the others are extra cut points)
THRESH = [10.0, 15.0, 21.3, 30.0, 38.0, 50.0]
T_HIGH, T_VHIGH = THRESH.index(21.3), THRESH.index(38.0)
EU27 = '040 056 100 191 196 203 208 233 246 250 276 300 348 372 380 428 440 442 470 528 616 620 642 703 705 724 752'.split()


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


# --------------------------------------------------------------------------- download
def safe_remove(path, root):
    """Delete ONE downloaded file, and only if it sits inside this run's own temporary folder and looks like one of our downloads.
    Nothing else is ever deleted: no folders are removed recursively and no wildcards are used."""
    real, base = os.path.realpath(path), os.path.realpath(root)
    name = os.path.basename(real)
    if os.path.dirname(real) == base and name.startswith('fwi_') and name.endswith('.nc') and os.path.isfile(real):
        os.remove(real)
    else:
        log('NOT deleting (not one of this run\'s downloads):', path)


def make_client(rc):
    import cdsapi
    path = os.path.expanduser(rc)
    if os.path.exists(path):
        cfg = {}
        for line in open(path):
            if ':' in line and not line.strip().startswith('#'):
                k, v = line.split(':', 1); cfg[k.strip()] = v.strip()
        return cdsapi.Client(url=cfg['url'], key=cfg['key'])
    log('No', rc, 'found: falling back to the default ~/.cdsapirc (its url must be the EWDS one)')
    return cdsapi.Client()


def request_months(client, year, months, dest):
    req = {'product_type': 'reanalysis', 'variable': ['fire_weather_index'], 'dataset_type': 'consolidated_dataset',
           'system_version': ['4_1'], 'year': [str(year)], 'month': ['%02d' % m for m in months],
           'day': ['%02d' % d for d in range(1, 32)], 'grid': '0.25/0.25', 'data_format': 'netcdf'}
    client.retrieve(DATASET, req, dest)


def fetch_and_reduce(client, year, workdir, acc):   # workdir is this run's own fresh temporary folder
    """Download the year (splitting it into smaller requests if the site says it is too big) and fold it into acc."""
    todo = [list(range(1, 13))]
    while todo:
        months = todo.pop(0)
        dest = os.path.join(workdir, 'fwi_%d_%02d-%02d.nc' % (year, months[0], months[-1]))
        for attempt in range(1, 5):
            try:
                log('requesting', year, 'months', months[0], '-', months[-1], '(attempt %d)' % attempt)
                request_months(client, year, months, dest)
                break
            except Exception as ex:   # noqa
                if os.path.exists(dest): safe_remove(dest, workdir)   # a partial file from the failed try
                msg = str(ex).lower()
                if len(months) > 1 and any(w in msg for w in ('cost', 'too large', 'too many', 'limit', 'exceed')):
                    h = len(months) // 2
                    log('request too big, splitting:', str(ex)[:140])
                    todo = [months[:h], months[h:]] + todo
                    dest = None
                    break
                log('download problem:', str(ex)[:200], '- waiting a minute and retrying')
                time.sleep(60)
        else:
            raise RuntimeError('giving up on %d %s' % (year, months))
        if dest is None:
            continue
        reduce_file(dest, acc)
        safe_remove(dest, workdir)
        log('processed and deleted', os.path.basename(dest))


# --------------------------------------------------------------------------- reduce one file
class Acc(object):
    """Running totals for one year on the file's own grid."""
    def __init__(self):
        self.sum = self.n = self.cnt = self.mx = None

    def add(self, block):          # block: (days, lat, lon) float32 with NaN where there is no value
        ok = ~np.isnan(block)
        if self.sum is None:
            h, w = block.shape[1:]
            self.sum = np.zeros((h, w), np.float64); self.n = np.zeros((h, w), np.int16)
            self.cnt = np.zeros((len(THRESH), h, w), np.int16); self.mx = np.full((h, w), np.nan, np.float32)
        self.sum += np.nansum(block, axis=0); self.n += ok.sum(axis=0).astype(np.int16)
        for i, t in enumerate(THRESH):
            self.cnt[i] += (block >= t).sum(axis=0).astype(np.int16)
        self.mx = np.fmax(self.mx, np.nanmax(np.where(ok, block, -1), axis=0).astype(np.float32))


def find_var(nc):
    for name, v in nc.variables.items():
        if v.ndim >= 3 and name.lower() not in ('latitude', 'longitude', 'lat', 'lon', 'time', 'valid_time'):
            return name
    raise RuntimeError('no data variable in file: ' + ', '.join(nc.variables))


def reduce_file(path, acc, step=16):
    import netCDF4
    nc = netCDF4.Dataset(path); v = nc.variables[find_var(nc)]
    for i in range(0, v.shape[0], step):
        b = np.ma.filled(v[i:i + step].astype(np.float32), np.nan)
        if b.ndim == 4:
            b = b[:, 0]
        acc.add(b)
    lat = np.array(nc.variables[[k for k in nc.variables if k.lower() in ('latitude', 'lat')][0]][:], dtype=np.float64)
    lon = np.array(nc.variables[[k for k in nc.variables if k.lower() in ('longitude', 'lon')][0]][:], dtype=np.float64)
    nc.close()
    acc.lat, acc.lon = lat, lon


def to_cells(A, lat, lon):
    """Any 0.25 degree global grid -> 720 x 1440 squares, north first, longitude from -180."""
    A = np.asarray(A, dtype=np.float32)
    if lat[0] < lat[-1]:
        A = A[::-1]
    if lon[0] >= -1:   # 0..360: move the western half to the front
        A = np.roll(A, A.shape[1] // 2, axis=1)
    if A.shape[0] == 721:     # values sit on the grid lines: average neighbouring lines into squares
        a = np.stack([A[:-1], A[1:]]); A = np.nanmean(a, axis=0)
        a = np.stack([A, np.roll(A, -1, axis=1)]); A = np.nanmean(a, axis=0)
    return A


def save_year(acc, year, out):
    cnt = np.stack([to_cells(acc.cnt[i].astype(np.float32), acc.lat, acc.lon) for i in range(len(THRESH))])
    mean = to_cells(np.where(acc.n > 0, acc.sum / np.maximum(acc.n, 1), np.nan), acc.lat, acc.lon)
    n = to_cells(acc.n.astype(np.float32), acc.lat, acc.lon)
    np.savez_compressed(os.path.join(out, 'fwi_%d.npz' % year), mean=mean.astype(np.float16), n=np.round(np.nan_to_num(n)).astype(np.int16),
                        cnt=np.round(np.nan_to_num(cnt)).astype(np.int16), mx=to_cells(acc.mx, acc.lat, acc.lon).astype(np.float16), thresh=np.array(THRESH))


# --------------------------------------------------------------------------- website files
def load_years(out):
    ys = {}
    for f in sorted(os.listdir(out)):
        if f.startswith('fwi_') and f.endswith('.npz'):
            ys[int(f[4:8])] = os.path.join(out, f)
    return ys


def decode(topo):
    tr = topo['transform']; arcs = []
    for a in topo['arcs']:
        x = y = 0; pts = []
        for p in a:
            x += p[0]; y += p[1]; pts.append((x * tr['scale'][0] + tr['translate'][0], y * tr['scale'][1] + tr['translate'][1]))
        arcs.append(pts)
    return arcs


def polygons(site):
    from shapely.geometry import Polygon
    from shapely.ops import unary_union
    def ring(arcs, idxs):
        out = []
        for i in idxs:
            seg = arcs[i] if i >= 0 else arcs[~i][::-1]
            out.extend(seg if not out else seg[1:])
        return out
    def geom(arcs, g):
        def poly(rings):
            r = [q for q in (ring(arcs, x) for x in rings) if len(q) >= 4]
            if not r: return Polygon()
            r = [[(x + 360 if x < 0 else x, y) for x, y in q] if (max(a for a, _ in q) - min(a for a, _ in q) > 180) else q for q in r]
            p = Polygon(r[0], r[1:]); return p if p.is_valid else p.buffer(0)
        if g['type'] == 'Polygon': return poly(g['arcs'])
        if g['type'] == 'MultiPolygon': return unary_union([poly(x) for x in g['arcs']])
        return None
    world = json.load(open(os.path.join(site, 'world.json'))); wa = decode(world)
    countries = {g['id']: geom(wa, g) for g in world['objects']['countries']['geometries'] if g.get('arcs') is not None and g.get('id')}
    regs = json.load(open(os.path.join(site, 'regions.json'))); ra = decode(regs)
    regions = {g['properties']['s']: geom(ra, g) for g in regs['objects']['regions']['geometries'] if g.get('arcs') is not None}
    return ({k: v for k, v in countries.items() if v is not None and not v.is_empty}, {k: v for k, v in regions.items() if v is not None and not v.is_empty})


def aggregate(out, site, entities, min_years=10):
    import shapely
    from shapely.ops import unary_union
    ys = load_years(out)
    if not ys:
        sys.exit('no yearly files in ' + out)
    years = sorted(ys); log('years available:', years[0], '-', years[-1], '(%d)' % len(years))
    lat = np.arange(89.875, -90, -0.25); lon = np.arange(-179.875, 180, 0.25)
    # ---- the world map: change in days a year with high fire danger (FWI >= 21.3), 2005-2024 compared with 1981-2000
    def avg(rng):
        sel = [y for y in years if rng[0] <= y <= rng[1]]
        if len(sel) < min_years: sys.exit('need at least %d years between %d and %d (have %d)' % (min_years, rng[0], rng[1], len(sel)))
        tot = 0; k = 0
        for y in sel:
            d = np.load(ys[y]); n = d['n'].astype(np.float32); c = d['cnt'][T_HIGH].astype(np.float32)
            tot = tot + np.where(n > 0, c / np.maximum(n, 1) * 365.25, np.nan); k += 1
        return tot / k
    a1, a2 = avg((1981, 2000)), avg((2005, 2024)); delta = a2 - a1
    q = np.where(np.isnan(delta), -128, np.clip(np.round(delta), -127, 127)).astype(np.int8)
    open(os.path.join(site, 'gm_fwi.js'), 'w').write('window.NZGMi=' + json.dumps({'w': -180, 'n': 90, 's': 0.25, 'nc': 1440, 'nr': 720, 'sc': 1, 'b': base64.b64encode(q.tobytes()).decode()}, separators=(',', ':')) + ';')
    log('gm_fwi.js written: valid squares', int((q != -128).sum()), 'range', int(q[q != -128].min()), int(q[q != -128].max()))
    # ---- each country and region: yearly days with high / very high fire danger, averaged over its outline
    countries, regions = polygons(site)
    LON, LAT = np.meshgrid(lon, lat); wts = np.cos(np.radians(LAT)).ravel()
    def cells_in(poly):
        minx, miny, maxx, maxy = poly.bounds
        j = np.where((lat >= miny - 0.25) & (lat <= maxy + 0.25))[0]
        i = np.where((lon >= minx - 0.25) | (lon <= maxx - 360 + 0.25))[0] if maxx > 180 else np.where((lon >= minx - 0.25) & (lon <= maxx + 0.25))[0]
        if not len(i) or not len(j): return None
        sub = np.ix_(j, i); X = LON[sub]; Y = LAT[sub]
        if maxx > 180: X = np.where(X < 0, X + 360, X)
        jj, ii = np.where(shapely.contains_xy(poly, X, Y))
        return (j[jj] * len(lon) + i[ii]) if len(jj) else None
    idx = {}
    for e in entities:
        if e['c'] == 'EUU':
            ps = [countries[k] for k in EU27 if k in countries]; poly = unary_union(ps) if ps else None
        else:
            poly = countries.get(e.get('iso')) if e['t'] == 'country' else regions.get(e['s'])
        if poly is None: continue
        f = cells_in(poly)
        if f is not None and len(f) >= 2: idx[e['s']] = f
    log('places with squares:', len(idx))
    res = {s: [[], []] for s in idx}
    for y in years:
        d = np.load(ys[y]); n = d['n'].ravel().astype(np.float32)
        for t, ti in enumerate((T_HIGH, T_VHIGH)):
            c = d['cnt'][ti].ravel().astype(np.float32) / np.maximum(n, 1) * 365.25
            for s, f in idx.items():
                ok = n[f] > 0
                w = wts[f] * ok
                res[s][t].append(int(round(float((c[f] * w).sum() / w.sum()) * 10)) if w.sum() > 0 else None)
    o = {'y0': years[0], 'y1': years[-1], 'years': years, 't': [THRESH[T_HIGH], THRESH[T_VHIGH]], 'd': res}
    open(os.path.join(site, 'fwi.js'), 'w').write('window.NZFW=' + json.dumps(o, separators=(',', ':')) + ';')
    log('fwi.js written:', len(res), 'places')


# --------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--years', nargs=2, type=int, default=[1979, 2025], metavar=('FIRST', 'LAST'))
    ap.add_argument('--out', default='./fwi_out', help='where the small yearly summaries are kept')
    ap.add_argument('--workdir', default=None, help='parent folder for the temporary download folder (default: inside --out). A new folder is made there for each run and removed when empty')
    ap.add_argument('--site', default=None, help='the website folder (needs world.json and regions.json); gm_fwi.js and fwi.js are written there')
    ap.add_argument('--entities', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fwi_entities.json'))
    ap.add_argument('--rc', default='~/.ewdsapirc')
    ap.add_argument('--aggregate-only', action='store_true')
    ap.add_argument('--min-years', type=int, default=10)
    ap.add_argument('--min-free-gb', type=float, default=4.0)
    ap.add_argument('--force', action='store_true', help='redo years that are already finished')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    if a.workdir: os.makedirs(a.workdir, exist_ok=True)
    work = tempfile.mkdtemp(prefix='fwi_download_', dir=a.workdir or a.out)   # a brand-new folder that only this run uses
    if not a.aggregate_only:
        client = make_client(a.rc)
        for y in range(a.years[0], a.years[1] + 1):
            outf = os.path.join(a.out, 'fwi_%d.npz' % y)
            if os.path.exists(outf) and not a.force:
                log(y, 'already done'); continue
            free = shutil.disk_usage(work).free / 1e9
            if free < a.min_free_gb:
                sys.exit('only %.1f GB free in %s; a year needs up to about 2-3 GB while it is processed (use --workdir on another drive)' % (free, work))
            log('=== year', y, '(free disk %.1f GB)' % free)
            acc = Acc(); fetch_and_reduce(client, y, work, acc); save_year(acc, y, a.out)
            log('saved', outf, '%.1f MB' % (os.path.getsize(outf) / 1e6))
    try:
        os.rmdir(work)    # removes the temporary folder only if it is empty; never touches anything else
    except OSError:
        log('temporary folder not empty, left in place:', work)
    if a.site:
        aggregate(a.out, a.site, json.load(open(a.entities)), a.min_years)
    else:
        log('no --site given: skipping the website files (run again with --aggregate-only --site <folder> when ready)')


if __name__ == '__main__':
    main()
