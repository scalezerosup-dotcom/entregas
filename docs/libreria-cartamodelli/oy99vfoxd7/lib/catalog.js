/* Catalogo: cada "design" es una prenda; cada talla de la prenda es un cartamodello distinto. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.PMCatalog = factory;
})(typeof self !== 'undefined' ? self : this, function (PM) {
  'use strict';
  var D = [], used = {};
  function slug(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function add(cat, set, type, name, fabric, diff, gen) {
    var s = slug(name), base = s, n = 1;
    while (used[s]) { n++; s = base + '-' + n; }
    used[s] = 1;
    D.push({ slug: s, name: name, cat: cat, set: set, type: type, fabric: fabric, diff: diff, gen: gen });
  }
  var NECK = { rotondo: 'Scollo Rotondo', V: 'Scollo a V', barca: 'Scollo a Barca', quadrato: 'Scollo Quadrato', profondo: 'Scollo Profondo', alto: 'Collo Alto' };
  var SLV = { none: 'Senza Maniche', short: 'Manica Corta', '3/4': 'Manica a 3/4', long: 'Manica Lunga', puff: 'Manica a Sbuffo', bell: 'Manica a Campana', cap: 'Manichetta' };
  var T_TOP = 'Top e Camicie', T_DRESS = 'Abiti', T_SKIRT = 'Gonne', T_TROU = 'Pantaloni', T_OTHER = 'Altro';
  function L(d, f) { return Math.round(d.h * f); }
  function rename(pcs, map) { pcs.forEach(function (p) { if (map[p.name]) p.name = map[p.name]; }); return pcs; }
  function merge(a, b) { return { pieces: a.pieces.concat(b.pieces), info: {} }; }
  function waistDress(d, o) {
    var b = PM.bodice(d, { neck: o.neck, sleeve: o.sleeve, len: 0, shape: 'fitted', binding: true });
    rename(b.pieces, { Davanti: 'Corpetto davanti', Dietro: 'Corpetto dietro' });
    var s = PM.skirt(d, Object.assign({ waist: 'none' }, o.skirt(d)));
    rename(s.pieces, { Davanti: 'Gonna davanti', Dietro: 'Gonna dietro' });
    return merge(b, s);
  }
  var FAB = {
    top: 'Cotone, viscosa, popeline, jersey leggero', dress: 'Cotone, viscosa, crepe, lino', skirt: 'Cotone, crepe, gabardine leggera, lino',
    trou: 'Gabardine, lino, cotone elasticizzato, twill', gown: 'Raso, crepe, chiffon, taffetà', kid: 'Cotone, jersey, popeline', baby: 'Jersey di cotone, felpa leggera, cotone morbido',
    man: 'Cotone, popeline, jersey, lino'
  };
  var fmt = function (x) { return x; };

  /* ======================================= FEMMINILE (110) ======================================= */
  /* Top e bluse: 6 scolli x 6 maniche = 36 */
  var styles = [
    { lab: 'Top Corto', len: -6, shape: 'boxy' }, { lab: 'Blusa', len: 8, shape: 'semi' },
    { lab: 'Blusa Lunga', len: 22, shape: 'semi' }, { lab: 'Tunica', len: 40, shape: 'boxy', flare: 10 },
    { lab: 'Top Aderente', len: 6, shape: 'fitted' }
  ];
  var neckKeys = ['rotondo', 'V', 'barca', 'quadrato', 'profondo', 'alto'], sleeveKeys = ['none', 'short', '3/4', 'long', 'puff', 'bell'], idx = 0;
  neckKeys.forEach(function (nk, i) {
    sleeveKeys.forEach(function (sk, j) {
      var st = styles[(i * 3 + j * 2 + idx++) % styles.length];
      var sleeve = sk, tank = sk === 'none';
      add('femminile', 'F', T_TOP, st.lab + ' ' + NECK[nk] + ' ' + SLV[sk], FAB.top, st.shape === 'fitted' ? 'Medio' : 'Facile',
        (function (nk, sk, st, tank) { return function (d) { return PM.bodice(d, { neck: nk, sleeve: sk, len: st.len, shape: st.shape, flare: st.flare || 0, tank: tank }); }; })(nk, sk, st, tank));
    });
  });
  /* Abiti: 4 scolli x 5 maniche + 2 = 22 */
  var dLens = [{ n: 'Mini', f: 0.255 }, { n: 'al Ginocchio', f: 0.345 }, { n: 'Midi', f: 0.445 }, { n: 'Lungo', f: 0.55 }];
  var dShapes = [{ n: 'Dritto', shape: 'boxy', fl: 0 }, { n: 'a Trapezio', shape: 'semi', fl: 16 }, { n: 'Svasato', shape: 'semi', fl: 26 }];
  var dn = 0;
  var dressSet = [];
  ['rotondo', 'V', 'quadrato', 'barca'].forEach(function (nk) { ['none', 'short', '3/4', 'long', 'bell'].forEach(function (sk) { dressSet.push([nk, sk]); }); });
  dressSet.push(['alto', 'long'], ['profondo', 'none']);
  dressSet.forEach(function (ns, i) {
    var ln = dLens[(i * 2 + 1) % 4], sh = dShapes[i % 3];
    add('femminile', 'F', T_DRESS, 'Abito ' + ln.n + ' ' + sh.n + ' ' + NECK[ns[0]] + ' ' + SLV[ns[1]], FAB.dress, 'Facile',
      (function (ns, ln, sh) { return function (d) { return PM.bodice(d, { neck: ns[0], sleeve: ns[1], len: L(d, ln.f) - Math.round(d.bl + 2) + 2 > 0 ? L(d, ln.f) : L(d, ln.f), shape: sh.shape, flare: sh.fl, tank: ns[1] === 'none' }); }; })(ns, ln, sh));
  });
  /* Abiti con gonna cucita in vita: 8 */
  var wdSk = [
    { n: 'a Ruota', f: function (d) { return { type: 'circle', len: L(d, 0.28), angle: 360 }; } },
    { n: 'Svasata', f: function (d) { return { type: 'flared', len: L(d, 0.33) }; } },
    { n: 'a Campana', f: function (d) { return { type: 'a', len: L(d, 0.34) }; } },
    { n: 'a Balze', f: function (d) { return { type: 'tiers', tiers: 3, len: L(d, 0.4) }; } }
  ];
  [['rotondo', 'none'], ['V', 'short'], ['barca', '3/4'], ['quadrato', 'long'], ['profondo', 'none'], ['V', 'long'], ['rotondo', 'short'], ['quadrato', 'none']].forEach(function (ns, i) {
    var sk = wdSk[i % 4];
    add('femminile', 'F', T_DRESS, 'Abito con Gonna ' + sk.n + ' ' + NECK[ns[0]] + ' ' + SLV[ns[1]], FAB.dress, 'Medio',
      (function (ns, sk) { return function (d) { return waistDress(d, { neck: ns[0], sleeve: ns[1], skirt: sk.f }); }; })(ns, sk));
  });
  /* Gonne: 24 */
  var sLens = { mini: [0.25, 'Mini'], knee: [0.345, 'al Ginocchio'], midi: [0.445, 'Midi'], long: [0.55, 'Lunga'] };
  function skirtAdd(typeLabel, opt, lenKey, waist) {
    var lf = sLens[lenKey];
    add('femminile', 'F', T_SKIRT, 'Gonna ' + typeLabel + ' ' + lf[1] + (waist === 'elastico' ? ' con Elastico' : ''), FAB.skirt, opt.type === 'tiers' || opt.type === 'circle' ? 'Facile' : 'Medio',
      function (d) { return PM.skirt(d, Object.assign({ len: Math.round(d.h * lf[0]), waist: waist, zip: waist !== 'elastico' }, opt)); });
  }
  ['mini', 'knee', 'midi', 'long'].forEach(function (k, i) { skirtAdd('Dritta', { type: 'straight' }, k, i % 2 ? 'elastico' : 'cintura'); });
  ['mini', 'knee', 'midi'].forEach(function (k, i) { skirtAdd('a Tubo', { type: 'pencil' }, k, 'cintura'); });
  ['mini', 'knee', 'midi', 'long'].forEach(function (k, i) { skirtAdd('a Trapezio', { type: 'a' }, k, i % 2 ? 'cintura' : 'elastico'); });
  ['mini', 'knee', 'midi', 'long'].forEach(function (k, i) { skirtAdd('Svasata', { type: 'flared' }, k, i % 2 ? 'elastico' : 'cintura'); });
  skirtAdd('a Ruota Intera', { type: 'circle', angle: 360 }, 'mini', 'cintura');
  skirtAdd('a Ruota Intera', { type: 'circle', angle: 360 }, 'knee', 'cintura');
  skirtAdd('a Ruota 3/4', { type: 'circle', angle: 270 }, 'mini', 'cintura');
  skirtAdd('a Ruota 3/4', { type: 'circle', angle: 270 }, 'knee', 'cintura');
  skirtAdd('a Mezza Ruota', { type: 'circle', angle: 180 }, 'mini', 'cintura');
  skirtAdd('a Due Balze', { type: 'tiers', tiers: 2 }, 'midi', 'elastico');
  skirtAdd('a Tre Balze', { type: 'tiers', tiers: 3 }, 'midi', 'elastico');
  skirtAdd('a Quattro Balze', { type: 'tiers', tiers: 4 }, 'long', 'elastico');
  skirtAdd('a Cinque Balze', { type: 'tiers', tiers: 5 }, 'long', 'elastico');
  /* Pantaloni: 20 */
  var PT = [
    ['Pantalone Skinny', 14, 15.5, 1.0, 'cintura'], ['Pantalone Slim', 16.5, 17.5, 1.0, 'cintura'], ['Pantalone Dritto', 20, 21, 1.0, 'cintura'],
    ['Pantalone Svasato', 26, 22, 1.0, 'cintura'], ['Pantalone a Palazzo', 34, 29, 1.0, 'elastico'], ['Pantalone Cigarette', 17, 19, 0.9, 'cintura'],
    ['Pantalone Jogger con Polsini', 15, 19, 0.92, 'elastico', 'cuffs'], ['Pantalone Culotte', 31, 27, 0.68, 'elastico'], ['Pantalone Capri', 17, 18, 0.72, 'cintura'],
    ['Pantalone a Zampa', 32, 23, 1.0, 'cintura'], ['Pantalone Palazzo Corto', 33, 28, 0.78, 'elastico'], ['Pantalone Pinocchietto', 18, 18.5, 0.8, 'cintura'],
    ['Bermuda', 23, 24, 0.4, 'cintura'], ['Bermuda Slim', 20, 21, 0.4, 'cintura'], ['Shorts', 24, 25, 0.12, 'cintura'], ['Shorts con Elastico', 25, 26, 0.16, 'elastico'],
    ['Shorts a Vita Alta', 22, 23, 0.1, 'cintura'], ['Pantalone Chino con Tasche', 19, 20, 1.0, 'cintura', 'pocket'], ['Pantalone Cargo', 22, 23, 1.0, 'elastico', 'pocket'],
    ['Pantalone Comodo con Elastico', 24, 25, 0.95, 'elastico']
  ];
  function trouAdd(cat, set, r, fabric) {
    add(cat, set, T_TROU, r[0], fabric || FAB.trou, r[4] === 'elastico' ? 'Facile' : 'Medio', function (d) {
      return PM.trousers(d, { hem: r[1], knee: r[2], inseam: Math.round(d.inseam * r[3]), waistband: r[4], pocket: r[5] === 'pocket', cuffs: r[5] === 'cuffs' });
    });
  }
  PT.forEach(function (r) { trouAdd('femminile', 'F', r); });

  /* ======================================= MASCHILE (40) ======================================= */
  [['rotondo', 'Maglietta Girocollo'], ['V', 'Maglietta Scollo a V'], ['alto', 'Maglietta Collo Alto']].forEach(function (n) {
    [['short', 22, 'Manica Corta'], ['short', 32, 'Manica Corta Lunga'], ['long', 24, 'Manica Lunga'], ['none', 22, 'Canotta']].forEach(function (v) {
      add('maschile', 'M', T_TOP, n[1] + ' ' + v[2], FAB.man, 'Facile', function (d) {
        return PM.bodice(d, { neck: n[0], sleeve: v[0], len: v[1], shape: 'boxy', tank: v[0] === 'none', cuffs: v[0] === 'long' });
      });
    });
  });
  [['Camicia Manica Corta', 'short', 'boxy', false, false], ['Camicia Manica Corta con Tasca', 'short', 'boxy', true, false],
   ['Camicia Manica Lunga', 'long', 'semi', false, true], ['Camicia Manica Lunga con Tasca', 'long', 'semi', true, true],
   ['Camicia Oversize', 'long', 'boxy', false, true], ['Camicia Estiva Aderente', 'short', 'semi', false, false]].forEach(function (c) {
    add('maschile', 'M', T_TOP, c[0], FAB.man, 'Medio', function (d) {
      return PM.bodice(d, { neck: 'alto', sleeve: c[1], len: 30, shape: c[2], collar: true, pocket: c[3], cuffs: c[4], open: true });
    });
  });
  [['Pantalone Chino', 19, 20, 1.0, 'cintura', 'pocket'], ['Pantalone Slim', 17, 18, 1.0, 'cintura'], ['Pantalone Dritto', 21, 22, 1.0, 'cintura'],
   ['Pantalone Cargo', 23, 24, 1.0, 'elastico', 'pocket'], ['Pantalone Jogger', 16, 20, 0.92, 'elastico', 'cuffs'], ['Bermuda', 24, 25, 0.4, 'cintura'],
   ['Bermuda Cargo', 26, 27, 0.4, 'elastico', 'pocket'], ['Shorts', 25, 26, 0.16, 'elastico'], ['Pantalone Elegante', 20, 21, 1.0, 'cintura'],
   ['Pantalone Pigiama', 24, 25, 1.0, 'elastico'], ['Pigiama Corto', 26, 27, 0.2, 'elastico'], ['Pantalone Lino Ampio', 28, 28, 1.0, 'elastico'],
   ['Pantalone da Lavoro', 23, 24, 1.0, 'cintura', 'pocket'], ['Pantalone Jeans Slim', 16.5, 17.5, 1.0, 'cintura']].forEach(function (r) { trouAdd('maschile', 'M', r, FAB.man); });
  [['Gilet Classico', 25, 'boxy'], ['Gilet Lungo', 38, 'boxy'], ['Gilet con Tasche', 28, 'boxy'], ['Gilet Aderente', 24, 'semi']].forEach(function (g) {
    add('maschile', 'M', T_OTHER, g[0], FAB.man, 'Medio', function (d) { return PM.bodice(d, { neck: 'V', sleeve: 'none', len: g[1], shape: g[2], open: true, pocket: g[0].indexOf('Tasche') > -1 }); });
  });
  [['Felpa Oversize', 26, 'long'], ['Felpa Corta', 12, 'long'], ['Polo Manica Corta', 24, 'short'], ['Polo Manica Lunga', 24, 'long']].forEach(function (g, i) {
    add('maschile', 'M', T_TOP, g[0], FAB.man, 'Medio', function (d) {
      return PM.bodice(d, { neck: i < 2 ? 'alto' : 'V', sleeve: g[2], len: g[1], shape: 'boxy', cuffs: true, waistband: i < 2, collar: i >= 2, open: i >= 2 });
    });
  });

  /* ======================================= BAMBINI (50) ======================================= */
  [['rotondo', 'Maglietta Girocollo'], ['V', 'Maglietta Scollo a V'], ['alto', 'Maglietta Collo Alto']].forEach(function (n) {
    [['short', 'Manica Corta'], ['long', 'Manica Lunga'], ['none', 'Canotta'], ['3/4', 'Manica a 3/4']].forEach(function (v) {
      add('bambini', 'K', T_TOP, n[1] + ' ' + v[1], FAB.kid, 'Facile', function (d) {
        return PM.bodice(d, { neck: n[0], sleeve: v[0], len: Math.round(d.h * 0.07), shape: 'boxy', tank: v[0] === 'none' });
      });
    });
  });
  ['rotondo', 'V', 'quadrato', 'barca'].forEach(function (nk, i) {
    ['none', 'short', 'long'].forEach(function (sk, j) {
      var fl = [14, 22, 18][(i + j) % 3], lf = [0.2, 0.26, 0.23][(i + 2 * j) % 3];
      add('bambini', 'K', T_DRESS, 'Vestito ' + ['Corto', 'al Ginocchio', 'Svasato'][(i + 2 * j) % 3] + ' ' + NECK[nk] + ' ' + SLV[sk], FAB.kid, 'Facile', function (d) {
        return PM.bodice(d, { neck: nk, sleeve: sk, len: Math.round(d.h * lf), shape: 'semi', flare: Math.round(fl * d.h / 120), tank: sk === 'none' });
      });
    });
  });
  [['a Trapezio', { type: 'a' }, 0.2], ['a Trapezio Lunga', { type: 'a' }, 0.3], ['Svasata', { type: 'flared' }, 0.22], ['Svasata Lunga', { type: 'flared' }, 0.3],
   ['a Ruota Intera', { type: 'circle', angle: 360 }, 0.2], ['a Ruota 3/4', { type: 'circle', angle: 270 }, 0.22], ['a Due Balze', { type: 'tiers', tiers: 2 }, 0.28], ['a Tre Balze', { type: 'tiers', tiers: 3 }, 0.32]].forEach(function (s) {
    add('bambini', 'K', T_SKIRT, 'Gonna ' + s[0], FAB.kid, 'Facile', function (d) { return PM.skirt(d, Object.assign({ len: Math.round(d.h * s[2]), waist: 'elastico' }, s[1])); });
  });
  [['Pantalone Skinny', 14, 15, 1.0, 'elastico'], ['Pantalone Slim', 16, 17, 1.0, 'elastico'], ['Pantalone Dritto', 19, 20, 1.0, 'elastico'], ['Pantalone a Palazzo', 30, 26, 1.0, 'elastico'],
   ['Pantalone Jogger con Polsini', 15, 19, 0.92, 'elastico', 'cuffs'], ['Pantalone Capri', 17, 18, 0.72, 'elastico'], ['Bermuda', 22, 23, 0.4, 'elastico'], ['Shorts', 23, 24, 0.14, 'elastico'],
   ['Shorts con Elastico', 24, 25, 0.18, 'elastico'], ['Pantalone Cargo', 21, 22, 1.0, 'elastico', 'pocket']].forEach(function (r) { trouAdd('bambini', 'K', r, FAB.kid); });
  [['Felpa', 'alto', 'long', 0.16, true], ['Felpa Corta', 'alto', 'long', 0.08, true]].forEach(function (g) {
    add('bambini', 'K', T_TOP, g[0], FAB.kid, 'Medio', function (d) { return PM.bodice(d, { neck: g[1], sleeve: g[2], len: Math.round(d.h * g[3]), shape: 'boxy', cuffs: true, waistband: true }); });
  });
  [['Gilet Classico', 0.14], ['Gilet Lungo', 0.22]].forEach(function (g) {
    add('bambini', 'K', T_OTHER, g[0], FAB.kid, 'Medio', function (d) { return PM.bodice(d, { neck: 'V', sleeve: 'none', len: Math.round(d.h * g[1]), shape: 'boxy', open: true }); });
  });
  ['Kimono Corto', 'Kimono Lungo'].forEach(function (n, i) {
    add('bambini', 'K', T_OTHER, n, FAB.kid, 'Facile', function (d) { return PM.kimono(d, { len: Math.round(d.h * (i ? 0.45 : 0.3)), sleeveLen: Math.round(d.arm * (i ? 0.55 : 0.4)) }); });
  });
  ['Cappello a Fascia', 'Cappello Classico'].forEach(function (n) {
    add('bambini', 'K', T_OTHER, n, FAB.kid, 'Facile', function (d) { return PM.hat(d, {}); });
  });

  /* ======================================= NEONATI (40) ======================================= */
  [['rotondo', 'Maglietta Girocollo'], ['barca', 'Maglietta a Barca'], ['alto', 'Maglietta Collo Alto'], ['V', 'Maglietta Scollo a V']].forEach(function (n) {
    [['short', 'Manica Corta'], ['long', 'Manica Lunga'], ['none', 'Senza Maniche']].forEach(function (v) {
      add('neonati', 'B', T_TOP, n[1] + ' ' + v[1], FAB.baby, 'Facile', function (d) {
        return PM.bodice(d, { neck: n[0], sleeve: v[0], len: Math.round(d.h * 0.1), shape: 'boxy', tank: v[0] === 'none' });
      });
    });
  });
  [['rotondo', 'none'], ['rotondo', 'short'], ['rotondo', 'long'], ['barca', 'none'], ['barca', 'short'], ['barca', 'long'], ['V', 'short'], ['quadrato', 'short']].forEach(function (ns, i) {
    add('neonati', 'B', T_DRESS, 'Vestitino ' + ['Svasato', 'a Trapezio'][i % 2] + ' ' + NECK[ns[0]] + ' ' + SLV[ns[1]], FAB.baby, 'Facile', function (d) {
      return PM.bodice(d, { neck: ns[0], sleeve: ns[1], len: Math.round(d.h * (i % 2 ? 0.27 : 0.23)), shape: 'semi', flare: Math.round(8 + (i % 2) * 5), tank: ns[1] === 'none' });
    });
  });
  [['Pantaloncini', 19, 20, 0.12], ['Pantaloni con Elastico', 17, 18, 1.0], ['Pantaloni Harem', 14, 15, 0.95], ['Leggings', 11, 12, 1.0], ['Bermuda', 18, 19, 0.35],
   ['Pantaloni con Polsini', 13, 17, 0.95, 'cuffs'], ['Pantaloni Svasati', 20, 17, 1.0], ['Pantaloni Capri', 15, 16, 0.65]].forEach(function (r) {
    add('neonati', 'B', T_TROU, r[0], FAB.baby, 'Facile', function (d) {
      return PM.trousers(d, { hem: r[1], knee: r[2], inseam: Math.round(d.inseam * (r[3])), waistband: 'elastico', cuffs: r[4] === 'cuffs' });
    });
  });
  [['a Trapezio', { type: 'a' }, 0.2], ['a Trapezio Lunga', { type: 'a' }, 0.28], ['Svasata', { type: 'flared' }, 0.22], ['a Due Balze', { type: 'tiers', tiers: 2 }, 0.26]].forEach(function (s) {
    add('neonati', 'B', T_SKIRT, 'Gonnellina ' + s[0], FAB.baby, 'Facile', function (d) { return PM.skirt(d, Object.assign({ len: Math.round(d.h * s[2]), waist: 'elastico' }, s[1])); });
  });
  ['Kimono Corto', 'Kimono Lungo'].forEach(function (n, i) {
    add('neonati', 'B', T_OTHER, n, FAB.baby, 'Facile', function (d) { return PM.kimono(d, { len: Math.round(d.h * (i ? 0.42 : 0.3)), sleeveLen: Math.round(d.arm * (i ? 0.55 : 0.4)) }); });
  });
  [['Bavaglino Rotondo', 13, 20], ['Bavaglino Ampio', 16, 24], ['Bavaglino Piccolo', 11, 16]].forEach(function (b) {
    add('neonati', 'B', T_OTHER, b[0], FAB.baby, 'Facile', function (d) { return PM.bib(d, { w: b[1] + (d.h - 62) * 0.05, h: b[2] + (d.h - 62) * 0.06 }); });
  });
  ['Cappellino a Fascia', 'Cappellino Classico', 'Cappellino Estivo'].forEach(function (n) {
    add('neonati', 'B', T_OTHER, n, FAB.baby, 'Facile', function (d) { return PM.hat(d, {}); });
  });

  /* ======================================= CERIMONIA (40) ======================================= */
  var gSk = [
    { n: 'a Campana', f: function (d) { return { type: 'a', len: L(d, 0.55) }; } },
    { n: 'Svasata', f: function (d) { return { type: 'flared', len: L(d, 0.55) }; } },
    { n: 'a Balze', f: function (d) { return { type: 'tiers', tiers: 4, len: L(d, 0.55) }; } },
    { n: 'a Sirena', f: function (d) { return { type: 'pencil', len: L(d, 0.55) }; } }
  ];
  var gi = 0;
  ['V', 'quadrato', 'barca', 'profondo', 'rotondo'].forEach(function (nk) {
    ['none', 'short', 'long'].forEach(function (sk) {
      var n1 = gSk[gi % 4], n2 = gSk[(gi + 2) % 4]; gi++;
      [n1, n2].forEach(function (sk2, k) {
        if (k === 1 && gi % 4 === 3) return;
        add('cerimonia', 'F', T_DRESS, 'Abito da Cerimonia ' + sk2.n + ' ' + NECK[nk] + ' ' + SLV[sk], FAB.gown, 'Medio', function (d) {
          return waistDress(d, { neck: nk, sleeve: sk, skirt: sk2.f });
        });
      });
    });
  });
  /* limitar a 26 abiti, aggiungere 4 bolero */
  while (D.filter(function (x) { return x.cat === 'cerimonia'; }).length > 26) {
    for (var q = D.length - 1; q >= 0; q--) if (D[q].cat === 'cerimonia') { delete used[D[q].slug]; D.splice(q, 1); break; }
  }
  ['short', '3/4', 'long', 'cap'].forEach(function (sk) {
    add('cerimonia', 'F', T_OTHER, 'Bolero ' + SLV[sk], FAB.gown, 'Medio', function (d) {
      return PM.bodice(d, { neck: 'V', sleeve: sk, len: -14, shape: 'semi', open: true, binding: true });
    });
  });
  [['rotondo', 'none'], ['V', 'none'], ['quadrato', 'short'], ['barca', 'none'], ['alto', 'short']].forEach(function (ns, i) {
    [['a Ruota', function (d) { return { type: 'circle', len: L(d, 0.25), angle: 360 }; }], ['a Balze', function (d) { return { type: 'tiers', tiers: 3, len: L(d, 0.3) }; }]].forEach(function (sk) {
      add('cerimonia', 'K', T_DRESS, 'Abito da Cerimonia Bambina ' + sk[0] + ' ' + NECK[ns[0]] + ' ' + SLV[ns[1]], FAB.gown, 'Medio', function (d) {
        return waistDress(d, { neck: ns[0], sleeve: ns[1], skirt: sk[1] });
      });
    });
  });

  return D;
});
