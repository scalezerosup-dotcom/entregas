/* Motore dei cartamodelli: disegna i pezzi (in cm) e li impagina per la stampa in A4. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PM = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var SA = 1.0, HEM = 2.5;
  var PI = Math.PI;

  /* ---------------------------------------------------------------- geometria */
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function bez(p0, c1, c2, p3, n) {
    n = n || 18; var o = [];
    for (var i = 1; i <= n; i++) {
      var t = i / n, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, e = t * t * t;
      o.push([a * p0[0] + b * c1[0] + c * c2[0] + e * p3[0], a * p0[1] + b * c1[1] + c * c2[1] + e * p3[1]]);
    }
    return o;
  }
  function plen(pts) { var s = 0; for (var i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]); return s; }
  function area(p) {
    var a = 0;
    for (var i = 0; i < p.length; i++) { var q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
    return a / 2;
  }
  function bbox(pts) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    pts.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    return { x0: x0, y0: y0, x1: x1, y1: y1, w: x1 - x0, h: y1 - y0 };
  }

  function Path(x, y) { this.p = [[x, y]]; this.s = []; }
  Path.prototype.l = function (x, y, s) { this.p.push([x, y]); this.s.push(s === undefined ? SA : s); return this; };
  Path.prototype.b = function (c1, c2, e, s, n) {
    var p0 = this.p[this.p.length - 1], self = this;
    bez(p0, c1, c2, e, n).forEach(function (q) { self.p.push(q); self.s.push(s === undefined ? SA : s); });
    return this;
  };
  Path.prototype.close = function (s) {
    var cs = s === undefined ? SA : s;
    var first = this.p[0], last = this.p[this.p.length - 1];
    if (dist(first, last) < 1e-6) { cs = this.s.pop(); this.p.pop(); }
    this.s.push(cs);
    /* limpiar puntos duplicados */
    var P = [], S = [];
    for (var i = 0; i < this.p.length; i++) {
      var prev = P.length ? P[P.length - 1] : null;
      if (prev && dist(prev, this.p[i]) < 1e-6) { S[S.length - 1] = this.s[i]; continue; }
      P.push(this.p[i]); S.push(this.s[i]);
    }
    return { pts: P, sa: S };
  };

  function offsetPoly(pts, sa) {
    var n = pts.length, out = [], A = area(pts) > 0 ? 1 : -1, nrm = [];
    for (var i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n], ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey) || 1e-9;
      nrm.push([A * ey / L, -A * ex / L]);
    }
    for (i = 0; i < n; i++) {
      var e1 = (i - 1 + n) % n, n1 = nrm[e1], n2 = nrm[i], d1 = sa[e1], d2 = sa[i], p = pts[i];
      var det = n1[0] * n2[1] - n1[1] * n2[0], x, y;
      if (Math.abs(det) < 1e-4) { x = (n1[0] * d1 + n2[0] * d2) / 2; y = (n1[1] * d1 + n2[1] * d2) / 2; }
      else { x = (d1 * n2[1] - n1[1] * d2) / det; y = (n1[0] * d2 - d1 * n2[0]) / det; }
      var m = Math.hypot(x, y), mx = Math.max(d1, d2) * 3;
      if (m > mx && m > 0) { x *= mx / m; y *= mx / m; }
      out.push([p[0] + x, p[1] + y]);
    }
    return out;
  }

  /* ancho (min x, max x) del poligono a la altura y */
  function span(pts, y) {
    var xs = [];
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    if (!xs.length) return null;
    return [Math.min.apply(null, xs), Math.max.apply(null, xs)];
  }

  /* ---------------------------------------------------------------- pieza */
  function makePiece(name, path, o) {
    o = o || {};
    var pts = path.pts, cut = o.noSew ? pts.slice() : offsetPoly(pts, path.sa);
    var bb = bbox(cut), dx = -bb.x0, dy = -bb.y0;
    function mv(arr) { return arr.map(function (p) { return [p[0] + dx, p[1] + dy]; }); }
    var pc = {
      name: name, pts: mv(pts), cut: mv(cut), qty: o.qty || 1, fold: !!o.fold, noSew: !!o.noSew,
      marks: (o.marks || []).map(function (m) { return { t: m.t, pts: mv(m.pts) }; }),
      note: o.note || '', diagram: false
    };
    var b2 = bbox(pc.cut); pc.w = b2.w; pc.h = b2.h;
    /* filo dritto y etichetta */
    var ym = pc.h * 0.55, sp = span(pc.pts, ym);
    if (sp) {
      var sw = sp[1] - sp[0];
      var L = Math.min(pc.h * 0.4, 28);
      pc.grain = { x: sp[0] + sw * (o.fold ? 0.22 : 0.2), y1: ym - L / 2, y2: ym + L / 2 };
      pc.label = { x: sp[0] + sw * 0.62, y: ym };
    } else { pc.label = { x: pc.w / 2, y: pc.h / 2 }; }
    return pc;
  }

  /* rettangolo: 1:1 se entra in 55x55, altrimenti schema in scala ridotta */
  function rect(name, w, h, qty, note) {
    w = Math.round(w * 10) / 10; h = Math.round(h * 10) / 10;
    var big = (w > 55 || h > 55);
    var dw = w, dh = h;
    if (big) { var s = Math.min(17 / w, 9 / h, 1); dw = Math.max(w * s, 6); dh = Math.max(h * s, 3); }
    var pts = [[0, 0], [dw, 0], [dw, dh], [0, dh]];
    return {
      name: name, pts: pts, cut: pts, qty: qty || 1, fold: false, noSew: true, marks: [],
      note: note || '', diagram: big, w: dw, h: dh, rectW: w, rectH: h,
      grain: null, label: { x: dw / 2, y: dh / 2 }
    };
  }

  /* ---------------------------------------------------------------- taglie */
  function mk(chest, waist, hip, o) {
    var d = { chest: chest, waist: waist, hip: hip, h: 166 };
    d.bl = 40 + (chest - 88) * 0.04; d.arm = 59 + (chest - 88) * 0.03; d.wrist = 15.5 + (chest - 88) * 0.04;
    d.rise = 26 + (hip - 96) * 0.07; d.inseam = 80; d.kid = false; d.sex = 'F';
    for (var k in (o || {})) d[k] = o[k];
    return d;
  }
  var SIZES = { F: [], M: [], K: [], B: [] };
  [['40', 'S', 84, 66, 92], ['42', 'M', 88, 70, 96], ['44', 'L', 92, 74, 100], ['46', 'XL', 96, 78, 104],
   ['48', 'XXL', 100, 82, 108], ['50', '3XL', 106, 88, 114], ['52', '4XL', 112, 94, 120], ['54', '5XL', 118, 100, 126]]
    .forEach(function (r, i) {
      var d = mk(r[2], r[3], r[4]); d.key = r[0]; d.lbl = 'IT ' + r[0] + ' · ' + r[1] + (i >= 4 ? ' · Plus' : '');
      SIZES.F.push(d);
    });
  [['46', 'S', 92, 80, 96], ['48', 'M', 98, 86, 102], ['50', 'L', 104, 92, 108], ['52', 'XL', 110, 98, 114],
   ['54', 'XXL', 116, 104, 120], ['56', '3XL', 122, 110, 126], ['58', '4XL', 128, 116, 132]]
    .forEach(function (r, i) {
      var d = mk(r[2], r[3], r[4], { sex: 'M', h: 178 });
      d.bl = 44 + (r[2] - 98) * 0.04; d.arm = 64 + (r[2] - 98) * 0.02; d.wrist = 17 + (r[2] - 98) * 0.03;
      d.rise = 27.5 + (r[4] - 102) * 0.07; d.inseam = 82;
      d.key = r[0]; d.lbl = 'IT ' + r[0] + ' · ' + r[1] + (i >= 4 ? ' · Plus' : '');
      SIZES.M.push(d);
    });
  [[2, 92, 54, 52, 56, 22], [3, 98, 56, 53, 58, 24], [4, 104, 58, 54, 60, 25], [6, 116, 62, 56, 66, 28],
   [8, 128, 66, 58, 72, 31], [10, 140, 70, 60, 78, 34], [12, 152, 76, 64, 84, 36], [14, 164, 80, 66, 88, 38]]
    .forEach(function (r) {
      var d = { key: String(r[0]), lbl: r[0] + ' anni · ' + r[1] + ' cm', h: r[1], chest: r[2], waist: r[3], hip: r[4], bl: r[5], kid: true, sex: 'K' };
      d.arm = r[1] * 0.33; d.wrist = 11 + r[1] * 0.02; d.rise = r[1] * 0.18; d.inseam = r[1] * 0.43;
      SIZES.K.push(d);
    });
  [['3', 62, 42, 42, 44, 17], ['6', 68, 44, 44, 46, 18.5], ['9', 74, 46, 45, 48, 20], ['12', 80, 48, 46, 50, 21],
   ['18', 86, 50, 47, 52, 22.5], ['24', 92, 52, 48, 54, 24]]
    .forEach(function (r) {
      var d = { key: r[0], lbl: r[0] + ' mesi · ' + r[1] + ' cm', h: r[1], chest: r[2], waist: r[3], hip: r[4], bl: r[5], kid: true, baby: true, sex: 'B' };
      d.arm = r[1] * 0.31; d.wrist = 9 + r[1] * 0.02; d.rise = r[1] * 0.17; d.inseam = r[1] * 0.34;
      SIZES.B.push(d);
    });

  /* ---------------------------------------------------------------- busto / corpo */
  function neckSpec(kind, nw, fdBase) {
    /* devuelve {nw, fd, cb, front:function(path) } */
    var s = { nw: nw, fd: nw + 2, cb: 2 };
    if (kind === 'rotondo') { s.fd = nw + 2; }
    else if (kind === 'alto') { s.fd = nw * 0.55 + 0.5; s.nw = nw - 0.4; }
    else if (kind === 'profondo') { s.fd = nw + 7; s.nw = nw + 0.8; }
    else if (kind === 'V') { s.fd = nw + 9.5; s.vee = true; }
    else if (kind === 'barca') { s.nw = nw + 5.5; s.fd = 3.6; s.cb = 1.6; }
    else if (kind === 'quadrato') { s.fd = nw + 5.5; s.nw = nw + 1.2; s.sq = true; }
    return s;
  }

  function neckPtsBack(s) {
    var P = new Path(0, s.cb);
    P.b([s.nw * 0.35, s.cb], [s.nw * 0.75, s.cb * 0.35], [s.nw, 0]);
    return P;
  }
  function frontNeckPts(s) {
    /* desde SNP hasta CF; devuelve lista de puntos sin el primero (SNP) */
    var snp = [s.nw, 0], cf = [0, s.fd];
    if (s.vee) return [[s.nw * 0.55, s.fd * 0.55], cf];
    if (s.sq) return [[s.nw - 1.0, s.fd], cf];
    return bez(snp, [s.nw * 0.92, s.fd * 0.5], [s.nw * 0.5, s.fd], cf, 14);
  }
  function armholeCurve(sh, sd, hc, ad, front, tank) {
    var SP = [sh, sd], U = [hc, ad];
    var c1 = [sh - (front ? 2.6 : 2.0), sd + (ad - sd) * 0.36], c2 = [hc - (front ? 5.8 : 4.6), ad - 5.2];
    return { SP: SP, U: U, c1: c1, c2: c2 };
  }

  /* devuelve {pieces, info} */
  function bodice(d, p) {
    var sleeveless = p.sleeve === 'none';
    var shape = p.shape || 'semi';
    var ease = p.ease !== undefined ? p.ease : (shape === 'fitted' ? 6 : (shape === 'boxy' ? 12 : 8));
    if (d.kid) ease = Math.max(ease, 8);
    var hc = (d.chest + ease) / 4;
    var nw0 = d.chest / 20 + 3;
    var ns = neckSpec(p.neck || 'rotondo', nw0);
    if (d.baby) ns.fd = Math.min(ns.fd, ns.nw + 1.5);
    var sh = d.chest * 0.215 + 0.5 + (p.shoulderAdd || 0), sd = d.chest * 0.045;
    var kk = d.kid ? 0.92 : 1;
    var ad = (d.chest * 0.2 + 4) * kk;
    if (sleeveless) sh = Math.max(ns.nw + 4, sh - (p.tank ? 4.5 : 2.6));
    var uX = hc - (sleeveless ? 1.3 : 0);
    var yW = 2 + d.bl;
    var yWF = yW + (shape === 'fitted' && !d.kid ? 1.0 : 0);
    var yH = yW + (p.len !== undefined ? p.len : 20);
    var hipD = d.bl * 0.5;
    var xW, dW = 0;
    if (shape === 'boxy') xW = hc;
    else if (shape === 'semi') xW = hc - 1.2;
    else { dW = Math.max(0.6, Math.min(4.5, hc - 1.0 - (d.waist + 4) / 4)); xW = (d.waist + 4) / 4 + dW; }
    var xH = Math.max((d.hip + (p.hipEase || 6)) / 4, xW);
    if (shape === 'boxy') xH = Math.max(hc, (d.hip + 8) / 4);
    var flare = p.flare || 0;
    var yHip = yW + hipD;
    flare = yH > yHip ? Math.min(flare, 0.4 * (yH - yHip)) : 0;
    function nodes(yHm) {
      var arr = [[ad, uX], [yW, xW], [yHip, xH]];
      var slopeLen = Math.max(yHm - yHip, 1);
      var out = [];
      var all = arr.concat([[yHip + 200, xH + flare * 200 / slopeLen]]);
      function xAt(y) {
        for (var i = 1; i < all.length; i++) if (y <= all[i][0]) {
          var a = all[i - 1], b = all[i], t = (y - a[0]) / (b[0] - a[0]); return a[1] + t * (b[1] - a[1]);
        }
        return all[all.length - 1][1];
      }
      arr.forEach(function (n) { if (n[0] < yHm - 0.01) out.push([n[1], n[0]]); });
      out.push([xAt(yHm), yHm]);
      return out;
    }
    var pieces = [], armF = armholeCurve(sh, sd, uX, ad, true), armB = armholeCurve(sh, sd, uX, ad, false);
    var aLenF = plen([armF.SP].concat(bez(armF.SP, armF.c1, armF.c2, armF.U)));
    var aLenB = plen([armB.SP].concat(bez(armB.SP, armB.c1, armB.c2, armB.U)));
    var AH = aLenF + aLenB;
    var open = !!p.open;
    var hemF = yH + (yWF - yW), hemB = yH;
    var sideB = nodes(hemB), sideF = nodes(hemF);
    /* largo de escote (aprox) */
    var nb = new Path(0, ns.cb); nb.b([ns.nw * 0.35, ns.cb], [ns.nw * 0.75, ns.cb * 0.35], [ns.nw, 0]);
    var neckBack = plen(nb.p), neckFront = plen([[ns.nw, 0]].concat(frontNeckPts(ns)));
    var NECK = (neckBack + neckFront) * 2;

    /* DIETRO */
    var B = new Path(0, ns.cb);
    B.b([ns.nw * 0.35, ns.cb], [ns.nw * 0.75, ns.cb * 0.35], [ns.nw, 0]);
    B.l(sh, sd);
    B.b(armB.c1, armB.c2, armB.U);
    sideB.forEach(function (n) { B.l(n[0], n[1]); });
    B.l(0, hemB, HEM);
    var pb = B.close(p.cbSeam ? 1.5 : 0);
    // el borde del dobladillo es el ultimo segmento antes de close: ajustar sa
    pb.sa[pb.sa.length - 2] = HEM;
    var marksB = [];
    if (shape === 'fitted') {
      var bx = hc * 0.52;
      marksB.push({ t: 'dart', pts: [[bx - 1.1, yW], [bx, ad - 3], [bx + 1.1, yW]] });
    }
    var backName = p.cbSeam ? 'Dietro' : 'Dietro';
    pieces.push(makePiece(backName, pb, p.cbSeam ? { qty: 2, marks: marksB, note: 'Taglia 2 · con cucitura al centro' } : { fold: true, marks: marksB, note: 'Taglia 1 sul doppio' }));

    /* DAVANTI */
    var F = new Path(0, ns.fd);
    frontNeckPts(ns).slice().reverse().forEach(function (q) { });
    var fn = frontNeckPts(ns);
    /* de CF a SNP: invertir lista (SNP incluido) */
    var chain = [[ns.nw, 0]].concat(fn);
    var rev = chain.slice().reverse();
    for (var i = 1; i < rev.length; i++) F.l(rev[i][0], rev[i][1]);
    F.l(sh, sd);
    F.b(armF.c1, armF.c2, armF.U);
    sideF.forEach(function (n) { F.l(n[0], n[1]); });
    F.l(0, hemF, HEM);
    var pf = F.close(open ? 1.5 : 0);
    pf.sa[pf.sa.length - 2] = HEM;
    var marksF = [];
    if (shape === 'fitted') {
      var fx = d.chest / 8 + 1.2, bust = ad - 2.5;
      marksF.push({ t: 'dart', pts: [[fx - dW / 2, yWF], [fx, bust], [fx + dW / 2, yWF]] });
    }
    pieces.push(makePiece('Davanti', pf, open ? { qty: 2, marks: marksF, note: 'Taglia 2 (1 specchiato) · apertura davanti' } : { fold: true, marks: marksF, note: 'Taglia 1 sul doppio' }));

    var extra = { AH: AH, NECK: NECK, ad: ad, hc: hc, ease: ease };
    /* MANICA */
    if (!sleeveless) pieces.push(sleevePiece(d, p, AH, ad));
    if (p.binding !== false) {
      pieces.push(rect('Sbieco per lo scollo', NECK + 4, 3.6, 1, 'Striscia in sbieco · taglia 1'));
      if (sleeveless) pieces.push(rect('Sbieco per i giromanica', AH * 2 + 4, 3.6, 1, 'Striscia in sbieco · taglia 1 (o 2 strisce)'));
    }
    if (p.collar) pieces.push(rect('Fascia del colletto', NECK / 2 + 3, 4.5, 2, 'Taglia 2 (1 con tela termoadesiva)'));
    if (p.pocket) pieces.push(rect('Tasca', 12, 13, 1, 'Taglia 1'));
    if (p.cuffs) pieces.push(rect('Polsino', d.wrist + 9, 6.5, 2, 'Taglia 2'));
    if (p.waistband) pieces.push(rect('Fascia elastica / bordo', d.waist + 6, 6, 1, 'Taglia 1'));
    return { pieces: pieces, info: extra };
  }

  function sleevePiece(d, p, AH, ad) {
    var kind = p.sleeve;
    var bic = d.chest * 0.3 + (d.kid ? 5 : 6);
    var puff = (kind === 'puff');
    var W = puff ? bic * 1.4 : bic;
    var ulen = d.arm - 0.75 * ad;
    var frac = { cap: 0.1, short: 0.42, '3/4': 0.74, long: 1, puff: 0.36, bell: 0.7, 'long-puff': 1 }[kind];
    if (frac === undefined) frac = 0.42;
    var L = ulen * frac;
    var target = AH + (puff ? 9 : 2);
    function cap(capH) {
      var l = bez([-W / 2, capH], [-W * 0.44, capH * 0.55], [-W * 0.30, 0.04 * capH], [0, 0], 14);
      var r = bez([0, 0], [W * 0.28, 0.02 * capH], [W * 0.42, capH * 0.62], [W / 2, capH], 14);
      return { l: l, r: r, len: plen([[-W / 2, capH]].concat(l, r)) };
    }
    var lo = 2, hi = Math.max(AH * 0.5, 6);
    for (var it = 0; it < 40; it++) {
      var mid = (lo + hi) / 2;
      if (cap(mid).len < target) lo = mid; else hi = mid;
    }
    var capH = (lo + hi) / 2, c = cap(capH);
    var Wh;
    if (kind === 'long' || kind === 'long-puff') Wh = Math.max(d.wrist + 7, W * 0.62);
    else if (kind === '3/4') Wh = W * 0.82;
    else if (kind === 'short') Wh = W * 0.94;
    else if (kind === 'cap') Wh = W * 0.98;
    else if (kind === 'puff') Wh = W * 0.8;
    else if (kind === 'bell') Wh = W + 16;
    else Wh = W * 0.9;
    var yHem = capH + L;
    var P = new Path(-W / 2, capH);
    P.l(-Wh / 2, yHem);
    P.l(Wh / 2, yHem, HEM);
    P.l(W / 2, capH);
    var rr = c.r.slice().reverse();
    for (var i = 1; i < rr.length; i++) P.l(rr[i][0], rr[i][1]);
    P.l(0, 0);
    for (i = c.l.length - 2; i >= 0; i--) P.l(c.l[i][0], c.l[i][1]);
    var path = P.close();
    var marks = [
      { t: 'dash', pts: [[-W / 2, capH], [W / 2, capH]] },
      { t: 'dart', pts: [[0, 0.3], [0, 2.2]] }
    ];
    if (puff || kind === 'long-puff') marks.push({ t: 'dash', pts: [[-Wh / 2 + 1, yHem - 3], [Wh / 2 - 1, yHem - 3]] });
    var pc = makePiece('Manica', path, { qty: 2, marks: marks, note: 'Taglia 2 (1 destra, 1 sinistra)' });
    pc.capLen = c.len;
    return pc;
  }

  /* ---------------------------------------------------------------- gonne */
  function skirt(d, p) {
    var pieces = [], type = p.type, len = p.len;
    var hq = (d.hip + 4) / 4, wq = (d.waist + 2) / 4;
    var hipD = d.bl * 0.45;
    var out = { pieces: pieces, info: {} };
    var waistband = (p.waist === undefined) ? 'cintura' : p.waist;
    if (type === 'circle') {
      var th = (p.angle || 360) * PI / 180, pieceAng = (p.angle === 180 ? 90 : 90) * PI / 180;
      var count = (p.angle === 180) ? 2 : 4;
      var tot = (p.angle === 180) ? PI : (p.angle === 270 ? 1.5 * PI : 2 * PI);
      var rin = (d.waist + 2) / tot, rout = rin + len;
      var pa = tot / count;
      var P = new Path(0, rin);
      var steps = 28, i;
      for (i = 1; i <= steps; i++) { var a = pa * i / steps; P.l(rin * Math.sin(a), rin * Math.cos(a)); }
      P.l(rout * Math.sin(pa), rout * Math.cos(pa));
      for (i = steps - 1; i >= 0; i--) { var a2 = pa * i / steps; P.l(rout * Math.sin(a2), rout * Math.cos(a2), i === steps - 1 ? 1 : HEM); }
      var pth = P.close(1);
      /* el borde exterior es el dobladillo */
      for (i = 0; i < pth.sa.length; i++) pth.sa[i] = SA;
      var n0 = steps + 1;
      for (i = n0; i < n0 + steps; i++) pth.sa[i] = HEM;
      pieces.push(makePiece('Quarto di cerchio', pth, { qty: count, note: 'Taglia ' + count + ' · il filo dritto segue il lato verticale' }));
      out.info.rin = rin;
    } else if (type === 'tiers') {
      var n = p.tiers || 3, base = d.hip + 8, h = len / n;
      for (var t = 0; t < n; t++) {
        var wt = base * Math.pow(1.55, t) + 6;
        pieces.push(rect('Balza ' + (t + 1), wt, h + 4, 1, 'Taglia 1 · larghezza ' + Math.round(wt) + ' cm (froncia sulla balza sopra)'));
      }
    } else {
      var flare = { straight: 0, pencil: -3.5, a: 7, flared: 15 }[type];
      var dartW = Math.max(0.6, Math.min(4.2, hq - wq - 1.2));
      var yEnd = len;
      function sideX(y) {
        var x0 = hq - dartW - wq + wq; // x al waist
        var xw = wq + dartW;
        if (y <= hipD) return xw + (hq - xw) * (y / hipD);
        var s = hq + flare * ((y - hipD) / Math.max(len - hipD, 1));
        return s;
      }
      function skirtPiece(front) {
        var xw = wq + dartW;
        var Pp = new Path(0, 0);
        Pp.l(xw, front ? 0.9 : 1.1);
        Pp.l(hq, hipD);
        Pp.l(hq + flare, yEnd, SA);
        Pp.l(0, yEnd, HEM);
        var ph = Pp.close(front ? 0 : (p.zip ? 1.5 : 0));
        ph.sa[ph.sa.length - 2] = HEM;
        var dx = (front ? xw * 0.5 : xw * 0.48) - 0;
        var dart = { t: 'dart', pts: [[dx - dartW / 2, 0.5], [dx, front ? 11 : 14], [dx + dartW / 2, 0.5]] };
        return makePiece(front ? 'Davanti' : 'Dietro', ph, p.zip && !front ? { qty: 2, marks: [dart], note: 'Taglia 2 · cerniera al centro' } : { fold: true, marks: [dart], note: 'Taglia 1 sul doppio' });
      }
      pieces.push(skirtPiece(true), skirtPiece(false));
    }
    if (waistband === 'cintura') pieces.push(rect('Cintura', d.waist + 6, 8, 1, 'Taglia 1 · con tela termoadesiva'));
    else if (waistband === 'elastico') pieces.push(rect('Guaina per elastico', d.waist + 5, 6, 1, 'Taglia 1 · elastico da 3 cm'));
    return out;
  }

  /* ---------------------------------------------------------------- pantaloni */
  function trousers(d, p) {
    var pieces = [];
    var Hq = (d.hip + 4) / 4, Wq = (d.waist + 2) / 4;
    var R = d.rise + 1.5, hipY = d.bl * 0.5;
    var lenIn = p.inseam !== undefined ? p.inseam : d.inseam;
    var hemW = p.hem || 20;
    var hemWk = hemW * (d.kid ? 0.7 : 1);
    var fx = d.hip / 20 + 0.3, bx = d.hip / 12;
    if (d.kid) { fx *= 0.9; bx *= 0.9; }
    var kneeW = Math.max(hemWk, p.knee || hemWk + 1);
    var yHem = R + lenIn;
    var yKnee = R + lenIn * 0.45;
    function leg(front) {
      var ext = front ? fx : bx, Wc = Hq + ext, cx = Wc / 2;
      /* eje del pliegue en x=0; borde exterior en -cx */
      var xo = -cx, xcf = xo + Hq;              // linea CF/CB a la altura de cadera
      var waistW = Wq + (front ? 2.2 : 2.8);
      var xs = xcf - waistW;                    // lado exterior en cintura (simple)
      var xsw = Math.max(xs, xo + 0.5);
      var P, ci = cx;                           // x del punto de entrepierna
      if (front) {
        P = new Path(xcf, 0);
        P.l(xsw, 0.8);
        P.l(xo, hipY);
        P.l(-kneeW / 2, yKnee);
        P.l(-hemWk / 2, yHem);
        P.l(hemWk / 2, yHem, HEM);
        P.l(kneeW / 2, yKnee);
        var cr = bez([ci, R], [ci - 0.2, R - 3.5], [xcf + 2.2, R - 6.5], [xcf, R - 9], 12);
        cr.forEach(function (q) { P.l(q[0], q[1]); });
        P.l(xcf, 0);
      } else {
        var cbx = xcf - 2.6;
        P = new Path(cbx, -2.2);
        P.l(xsw, 0.2);
        P.l(xo, hipY);
        P.l(-kneeW / 2, yKnee);
        P.l(-hemWk / 2, yHem);
        P.l(hemWk / 2, yHem, HEM);
        P.l(kneeW / 2, yKnee);
        var cr2 = bez([ci, R], [ci - 0.3, R - 3.0], [xcf + 1.0, R - 3.8], [xcf, R - 9.0], 12);
        cr2.forEach(function (q) { P.l(q[0], q[1]); });
        P.l(cbx, -2.2);
      }
      var path = P.close();
      var marks = [{ t: 'dash', pts: [[xo - 0.5, R], [ci + 0.5, R]] }, { t: 'dash', pts: [[xo, hipY], [xcf, hipY]] }];
      /* piega al centro (linea del filo) */
      var dartX = (xcf + xsw) / 2 + (front ? 0.2 : 0.4);
      marks.push({ t: 'dart', pts: [[dartX - 0.9, front ? 0.9 : 0.2], [dartX, front ? 9.5 : 13], [dartX + 0.9, front ? 0.9 : 0.2]] });
      var pc = makePiece(front ? 'Davanti' : 'Dietro', path, { qty: 2, marks: marks, note: 'Taglia 2 (1 destra, 1 sinistra)' });
      /* el hilo dritto al centro (crease) */
      return pc;
    }
    var fr = leg(true), bk = leg(false);
    /* filo dritto sobre el pliegue: x=0 original */
    [fr, bk].forEach(function (pc) {
      var minx = bbox(pc.cut).x0; /* cut ya normalizado: bbox x0=0 */
    });
    pieces.push(fr, bk);
    if (p.waistband === 'elastico') pieces.push(rect('Guaina per elastico', d.waist + 5, 6, 1, 'Taglia 1 · elastico da 3 cm'));
    else if (p.waistband !== 'none') pieces.push(rect('Cintura', d.waist + 6, 8, 1, 'Taglia 1 · con tela termoadesiva'));
    if (p.pocket) pieces.push(rect('Tasca', 14, 16, 2, 'Taglia 2'));
    if (p.cuffs) pieces.push(rect('Polsino', hemWk * 2 - 4, 8, 2, 'Taglia 2'));
    return { pieces: pieces, info: { R: R } };
  }

  /* ---------------------------------------------------------------- altri */
  function kimono(d, p) {
    var pieces = [];
    var w = (d.chest + 18) / 2, len = p.len || (d.bl + 42), sl = p.sleeveLen || (d.arm * 0.5);
    var half = w / 2, nw = d.chest / 20 + 4;
    var P = new Path(0, 0);
    P.l(nw, 0, SA); P.l(nw, 2.0); P.l(0, 2.0 + 2.5);
    var pth = new Path(0, 0);
    pth.l(nw, 0); pth.l(half + sl, 0); pth.l(half + sl, 20); pth.l(half, 20); pth.l(half, len, HEM); pth.l(0, len, HEM);
    var path = pth.close(0);
    path.sa[path.sa.length - 2] = HEM;
    pieces.push(makePiece('Corpo e manica', path, { fold: true, qty: 2, note: 'Taglia 2 (davanti e dietro) sul doppio' }));
    pieces.push(rect('Sbieco per lo scollo', (nw + 4) * 4, 3.6, 1, 'Striscia in sbieco'));
    return { pieces: pieces, info: {} };
  }

  function bib(d, p) {
    var r = p.r || 8;
    var P = new Path(0, 0);
    var pts = [];
    var w = p.w || 13, h = p.h || 20;
    P.l(w, 0);
    P.l(w, h - 4);
    var cp = bez([w, h - 4], [w, h], [w * 0.6, h], [0, h], 10); cp.forEach(function (q) { P.l(q[0], q[1]); });
    var path = P.close(0);
    var marks = [];
    return { pieces: [makePiece('Bavaglino', path, { fold: true, qty: 2, note: 'Taglia 2 (1 stoffa, 1 spugna)' }), rect('Laccetto', 40, 3, 2, 'Taglia 2 · chiusura con bottone')], info: {} };
  }

  function hat(d, p) {
    var c = d.chest * 0.8 + 4; // circonferenza testa approssimata
    var head = d.baby ? 34 + (d.h - 62) * 0.15 : 48 + (d.h - 92) * 0.07;
    var wq = (head + 2) / 2, hh = head * 0.42;
    return { pieces: [rect('Pannello cappello', wq, hh + 2, 2, 'Taglia 2'), rect('Fascia di bordo', head + 2, 6, 1, 'Taglia 1')], info: {} };
  }

  /* ---------------------------------------------------------------- impaginazione */
  function packRows(items, maxW, gap) {
    var sorted = items.slice().sort(function (a, b) { return b.h - a.h; });
    var x = 0, y = 0, rowH = 0, W = 0;
    sorted.forEach(function (it) {
      if (x > 0 && x + it.w > maxW) { x = 0; y += rowH + gap; rowH = 0; }
      it.px = x; it.py = y; x += it.w + gap; rowH = Math.max(rowH, it.h); W = Math.max(W, x - gap);
    });
    return { items: sorted, w: W, h: y + rowH };
  }
  function layout(pieces, maxW) {
    var items = pieces.map(function (pc) { return { pc: pc, w: pc.w, h: pc.h }; });
    var r = packRows(items, maxW, 3);
    return r;
  }
  function thumbLayout(pieces) {
    var best = null, tot = pieces.reduce(function (s, p) { return s + p.w * p.h; }, 0);
    var minW = Math.max.apply(null, pieces.map(function (p) { return p.w; }));
    for (var W = Math.max(minW, 30); W <= 260; W += 15) {
      var r = layout(pieces, W), asp = r.w / r.h;
      var score = Math.abs(Math.log(asp / 1.1)) + r.w * r.h / (tot + 1) * 0.15;
      if (!best || score < best.score) { best = { r: r, score: score }; }
    }
    return best.r;
  }

  /* ---------------------------------------------------------------- SVG */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pathD(pts) { return 'M' + pts.map(function (p) { return p[0].toFixed(2) + ' ' + p[1].toFixed(2); }).join('L') + 'Z'; }
  function toSvg(pieces, o) {
    o = o || {};
    var lay = o.thumb ? thumbLayout(pieces) : layout(pieces, o.maxW || 160);
    var pad = 3, W = lay.w + pad * 2, H = lay.h + pad * 2, out = [];
    var stroke = o.stroke || '#382b2a', fill = o.fill || '#f6e3e6', fs = o.thumb ? 0 : 2.6, tsw = Math.max(0.45, Math.max(W, H) / 150);
    lay.items.forEach(function (it) {
      var pc = it.pc, ox = it.px + pad, oy = it.py + pad;
      var g = '<g transform="translate(' + ox.toFixed(2) + ' ' + oy.toFixed(2) + ')">';
      if (pc.diagram) {
        g += '<rect width="' + pc.w + '" height="' + pc.h + '" fill="none" stroke="' + stroke + '" stroke-width="0.5" stroke-dasharray="1.5 1"/>';
      } else {
        g += '<path d="' + pathD(pc.pts) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (o.thumb ? tsw : 0.5) + '" stroke-linejoin="round"/>';
        if (!o.thumb && !pc.noSew) g += '<path d="' + pathD(pc.cut) + '" fill="none" stroke="' + stroke + '" stroke-width="0.25" stroke-dasharray="1.2 0.8"/>';
        pc.marks.forEach(function (m) {
          g += '<polyline points="' + m.pts.map(function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join(' ') + '" fill="none" stroke="' + stroke + '" stroke-width="' + (o.thumb ? tsw * 0.7 : 0.3) + '"' + (m.t === 'dash' ? ' stroke-dasharray="1 1"' : '') + '/>';
        });
        if (pc.grain && !o.thumb) g += '<line x1="' + pc.grain.x + '" y1="' + pc.grain.y1 + '" x2="' + pc.grain.x + '" y2="' + pc.grain.y2 + '" stroke="' + stroke + '" stroke-width="0.3"/>';
      }
      if (!o.thumb) g += '<text x="' + pc.label.x.toFixed(1) + '" y="' + pc.label.y.toFixed(1) + '" font-size="' + fs + '" text-anchor="middle" fill="' + stroke + '" font-family="Poppins,Arial,sans-serif">' + esc(pc.name) + '</text>';
      g += '</g>';
      out.push(g);
    });
    return { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W.toFixed(1) + ' ' + H.toFixed(1) + '" preserveAspectRatio="xMidYMid meet">' + out.join('') + '</svg>', w: lay.w, h: lay.h };
  }

  /* ---------------------------------------------------------------- tela necesaria */
  function fabricMeters(pieces, fabW) {
    fabW = fabW || 140;
    var items = [];
    pieces.forEach(function (pc) {
      var w = pc.diagram ? pc.rectW : pc.w, h = pc.diagram ? pc.rectH : pc.h;
      var q = pc.qty;
      if (pc.fold) { w = w * 2; }
      for (var i = 0; i < q; i++) items.push({ w: Math.min(w, fabW), h: h });
    });
    var r = packRows(items, fabW, 1);
    return Math.ceil((r.h * 1.1) / 10) / 10;
  }

  /* ---------------------------------------------------------------- PDF (jsPDF) */
  function inkInTile(sheet, tx, ty, tw, th) {
    var hit = false;
    sheet.items.forEach(function (it) {
      if (hit) return;
      var pc = it.pc, ox = it.px, oy = it.py;
      if (ox > tx + tw || ox + pc.w < tx || oy > ty + th || oy + pc.h < ty) return;
      var P = pc.cut;
      for (var i = 0; i < P.length && !hit; i++) {
        var a = P[i], b = P[(i + 1) % P.length], n = Math.max(1, Math.ceil(dist(a, b) / 1.0));
        for (var k = 0; k <= n; k++) {
          var x = ox + a[0] + (b[0] - a[0]) * k / n, y = oy + a[1] + (b[1] - a[1]) * k / n;
          if (x >= tx && x <= tx + tw && y >= ty && y <= ty + th) { hit = true; break; }
        }
      }
      if (!hit) { /* tile dentro de la pieza? */
        var cx = tx + tw / 2 - ox, cy = ty + th / 2 - oy, inside = false;
        for (var i2 = 0, j = P.length - 1; i2 < P.length; j = i2++) {
          if (((P[i2][1] > cy) !== (P[j][1] > cy)) && (cx < (P[j][0] - P[i2][0]) * (cy - P[i2][1]) / (P[j][1] - P[i2][1]) + P[i2][0])) inside = !inside;
        }
        if (inside) hit = true;
      }
    });
    return hit;
  }

  function bestLayout(pieces) {
    var minW = Math.max.apply(null, pieces.map(function (p) { return p.w; })), best = null;
    for (var W = Math.max(minW, 38); W <= 190; W += 4) {
      var r = layout(pieces, W);
      var pages = Math.max(1, Math.ceil((r.w * 10 - 10) / 180)) * Math.max(1, Math.ceil((r.h * 10 - 10) / 267));
      if (!best || pages < best.pages) best = { r: r, pages: pages };
    }
    return best.r;
  }
  function pageCount(pieces) {
    var sh = bestLayout(pieces), n = 0;
    var cols = Math.max(1, Math.ceil((sh.w * 10 - 10) / 180)), rows = Math.max(1, Math.ceil((sh.h * 10 - 10) / 267));
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) if (inkInTile(sh, c * 18 - 1, r * 26.7 - 1, 21, 29.7)) n++;
    return n;
  }

  function buildPdf(jsPDF, design, d) {
    var res = design.gen(d), pieces = res.pieces;
    var sheet = bestLayout(pieces);
    var doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    var M = 10, STEP_X = 180, STEP_Y = 267, PW = 190, PH = 277;
    var ink = [56, 43, 42], rose = [169, 95, 112], soft = [109, 89, 86];
    function T(txt, x, y, size, bold, color, o) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor.apply(doc, color || ink);
      doc.text(String(txt), x, y, o || {});
    }
    function dash(a, b) { try { doc.setLineDashPattern(a ? [a, b] : [], 0); } catch (e) { } }
    function poly(pts, ox, oy, closed) {
      var rel = [];
      for (var i = 1; i < pts.length; i++) rel.push([(pts[i][0] - pts[i - 1][0]) * 10, (pts[i][1] - pts[i - 1][1]) * 10]);
      doc.lines(rel, pts[0][0] * 10 + ox, pts[0][1] * 10 + oy, [1, 1], 'S', !!closed);
    }
    var cols = Math.max(1, Math.ceil((sheet.w * 10 - (PW - STEP_X)) / STEP_X));
    var rows = Math.max(1, Math.ceil((sheet.h * 10 - (PH - STEP_Y)) / STEP_Y));
    var tiles = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      if (inkInTile(sheet, c * STEP_X / 10 - 1, r * STEP_Y / 10 - 1, PW / 10 + 2, PH / 10 + 2)) tiles.push([c, r]);
    }
    var nPages = tiles.length;

    /* ---------- pagina 1: istruzioni ---------- */
    T('CARTAMODELLI DI CUCITO', M, 16, 9, true, rose);
    T(design.name, M, 26, 17, true);
    T('Taglia ' + d.lbl, M, 33, 11, false, soft);
    var y = 44;
    T('Quadrato di controllo', M, y, 9, true); T('deve misurare esattamente 10 x 10 cm', M + 38, y, 9, false, soft);
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.4); dash(0);
    doc.rect(M, y + 4, 100, 100);
    T('10 cm', M + 50, y + 56, 9, false, soft, { align: 'center' });
    T('Se non misura 10 cm, ristampa al 100% (senza "adatta alla pagina").', M, y + 112, 8, false, soft);
    var rowsInfo = [
      ['Pezzi', pieces.map(function (p) { return p.name + (p.qty > 1 ? ' x' + p.qty : ''); }).join(', ')],
      ['Tessuto', design.fabric],
      ['Metratura', fabricMeters(pieces) + ' m circa (tessuto alto 140 cm)'],
      ['Fogli A4', nPages + ' fogli da incollare (+ questa pagina)']
    ];
    var iy = y + 122;
    rowsInfo.forEach(function (ri) {
      T(ri[0], M, iy, 9, true);
      var lines = doc.splitTextToSize(ri[1], 140);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor.apply(doc, ink);
      doc.text(lines, M + 28, iy);
      iy += 5 * lines.length + 2;
    });
    /* mappa di montaggio a destra */
    var mx = 125, my = 44;
    T('Mappa di montaggio', mx, my, 9, true);
    var cs = Math.min(14, 70 / Math.max(cols, rows)), pgn = {};
    tiles.forEach(function (t, i) { pgn[t[0] + ',' + t[1]] = i + 1; });
    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
      var has = pgn[c + ',' + r];
      doc.setLineWidth(0.2); doc.setDrawColor(109, 89, 86);
      if (has) doc.setFillColor(246, 227, 230); else doc.setFillColor(255, 255, 255);
      doc.rect(mx + c * cs, my + 5 + r * cs, cs, cs, has ? 'FD' : 'S');
      if (has) T(String.fromCharCode(65 + r) + (c + 1), mx + c * cs + cs / 2, my + 5 + r * cs + cs / 2 + 1.5, 7, true, ink, { align: 'center' });
    }
    var gy = my + 5 + rows * cs + 10;
    T('Come si monta', mx, gy, 9, true);
    var how = ['1. Stampa tutte le pagine al 100%.', '2. Controlla il quadrato di 10 cm.', '3. Ritaglia il bordo bianco dei fogli', '    (non la linea tratteggiata).', '4. Unisci i fogli seguendo la mappa:', '    A1 con A2, A1 con B1, e cosi via.', '5. Fai combaciare le linee e incolla.', '6. Taglia sulla linea continua.'];
    how.forEach(function (ln, i) { T(ln, mx, gy + 6 + i * 4.6, 8, false, soft); });
    var ky = Math.max(iy + 8, gy + 52);
    T('Come leggere il cartamodello', M, ky, 9, true);
    var key = ['Linea continua = taglio (margine di cucitura di 1 cm e orlo di 2,5 cm gia inclusi).',
      'Linea tratteggiata = linea di cucitura.', 'Freccia = filo dritto del tessuto (parallelo al cimosa).',
      'Triangolo stretto = pince (piega e cuci).', 'Rettangoli con misure = taglia direttamente sul tessuto.',
      'Prova sempre su un tessuto di prova prima di tagliare quello definitivo.'];
    key.forEach(function (ln, i) { T(ln, M, ky + 6 + i * 4.6, 8, false, soft); });

    /* ---------- fogli ---------- */
    function labelOf(pc, sizeLbl) {
      var q = pc.qty > 1 ? 'Taglia ' + pc.qty : 'Taglia 1';
      return { name: pc.name, sub: pc.note || q, size: sizeLbl };
    }
    tiles.forEach(function (t, idx) {
      var c = t[0], r = t[1];
      doc.addPage();
      var ox = M - c * STEP_X, oy = M - r * STEP_Y; /* sheet cm*10 -> page mm */
      var id = String.fromCharCode(65 + r) + (c + 1);
      /* cuadro de impresion */
      doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.15); dash(1, 1.2);
      doc.rect(M, M, PW, PH); dash(0);
      /* cruces de ensamble */
      [[M, M], [M + PW, M], [M, M + PH], [M + PW, M + PH]].forEach(function (p) {
        doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2);
        doc.line(p[0] - 3, p[1], p[0] + 3, p[1]); doc.line(p[0], p[1] - 3, p[0], p[1] + 3);
      });
      sheet.items.forEach(function (it) {
        var pc = it.pc, bx = it.px * 10 + ox, by = it.py * 10 + oy;
        if (bx > 210 + 5 || bx + pc.w * 10 < -5 || by > 297 + 5 || by + pc.h * 10 < -5) return;
        doc.setDrawColor.apply(doc, ink);
        /* contorno de corte */
        if (pc.diagram) {
          doc.setLineWidth(0.3); dash(2, 1.5); doc.rect(bx, by, pc.w * 10, pc.h * 10); dash(0);
        } else {
          doc.setLineWidth(0.5); dash(0); poly(pc.cut, bx, by, true);
          if (!pc.noSew) { doc.setLineWidth(0.18); dash(1.6, 1.2); poly(pc.pts, bx, by, true); dash(0); }
        }
        pc.marks.forEach(function (m) {
          doc.setLineWidth(0.25); dash(m.t === 'dash' ? 1.5 : 0, 1.2); poly(m.pts, bx, by, false); dash(0);
        });
        if (pc.grain) {
          var gx = pc.grain.x * 10 + bx, g1 = pc.grain.y1 * 10 + by, g2 = pc.grain.y2 * 10 + by;
          doc.setLineWidth(0.35); doc.line(gx, g1, gx, g2);
          doc.line(gx, g1, gx - 1.6, g1 + 3.5); doc.line(gx, g1, gx + 1.6, g1 + 3.5);
          doc.line(gx, g2, gx - 1.6, g2 - 3.5); doc.line(gx, g2, gx + 1.6, g2 - 3.5);
        }
        var lx = pc.label.x * 10 + bx, ly = pc.label.y * 10 + by;
        if (lx > -20 && lx < 230 && ly > -20 && ly < 320) {
          if (pc.diagram) {
            T(pc.name, lx, ly - 2, 9, true, ink, { align: 'center' });
            T(pc.rectW + ' x ' + pc.rectH + ' cm', lx, ly + 3, 8, false, ink, { align: 'center' });
            T(pc.note, lx, ly + 7, 6.5, false, soft, { align: 'center' });
          } else if (pc.noSew) {
            T(pc.name, lx, ly - 2, 9, true, ink, { align: 'center' });
            T(pc.rectW === undefined ? Math.round(pc.w * 10) / 10 + ' x ' + Math.round(pc.h * 10) / 10 + ' cm' : pc.rectW + ' x ' + pc.rectH + ' cm', lx, ly + 3, 8, false, ink, { align: 'center' });
            T(pc.note, lx, ly + 7, 6.5, false, soft, { align: 'center' });
          } else {
            T(pc.name, lx, ly - 5, 11, true, ink, { align: 'center' });
            T(pc.note || ('Taglia ' + pc.qty), lx, ly, 8, false, ink, { align: 'center' });
            T('Taglia ' + d.key, lx, ly + 4.5, 8, false, soft, { align: 'center' });
          }
        }
        if (pc.fold) {
          var fx = bx + 3;
          T('PIEGA', fx, by + pc.h * 5, 8, true, rose, { angle: 90, align: 'center' });
        }
      });
      /* etiquetas de pagina */
      T(id, M + PW / 2, M - 3, 9, true, rose, { align: 'center' });
      T('Foglio ' + (idx + 1) + ' di ' + nPages + ' · ' + design.name + ' · ' + d.lbl, M, 296, 6.5, false, soft);
      if (pgn[(c + 1) + ',' + r]) T(String.fromCharCode(65 + r) + (c + 2) + ' >>', M + PW - 1, M + PH / 2, 7, true, rose, { align: 'right' });
      if (pgn[c + ',' + (r + 1)]) T('v ' + String.fromCharCode(65 + r + 1) + (c + 1), M + PW / 2, M + PH - 1.5, 7, true, rose, { align: 'center' });
    });
    return { doc: doc, pages: nPages + 1, sheet: sheet };
  }

  return {
    SIZES: SIZES, bodice: bodice, skirt: skirt, trousers: trousers, kimono: kimono, bib: bib, hat: hat,
    rect: rect, layout: layout, toSvg: toSvg, fabricMeters: fabricMeters, buildPdf: buildPdf, pageCount: pageCount,
    plen: plen, bbox: bbox, _bez: bez
  };
});
