(function () {
  if (customElements.get('dio-3d')) return;
  let threeP = null;
  const loadThree = () => threeP || (threeP = import('https://esm.sh/three@0.160.0'));
  const ATTRS = ['view', 'vis', 'yaw', 'zoom', 'focus', 'mark', 'interactive'];
  const UP_W = [8.6, 6.6, 7.6, 7.0, 6.6, 10.2, 9.0, 8.5];
  const LO_W = [5.4, 5.9, 6.9, 7.0, 7.2, 11.2, 10.5, 10.0];
  const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

  function makeArch(T, Rx, Rz, bx, bz) {
    const pts = [];
    for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI / 2; pts.push(new T.Vector3(Rx * Math.sin(a), 0, Rz * Math.cos(a))); }
    for (let i = 1; i <= 24; i++) { const t = i / 24; pts.push(new T.Vector3(Rx + (bx - Rx) * t, 0, -bz * t)); }
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const len = cum[cum.length - 1], up = new T.Vector3(0, 1, 0);
    const at = (s, side) => {
      s = Math.max(0, Math.min(len, s));
      let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
      const f = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      const p = pts[i - 1].clone().lerp(pts[i], f), t = pts[i].clone().sub(pts[i - 1]).normalize();
      if (side < 0) { p.x = -p.x; t.x = -t.x; t.multiplyScalar(-1); }
      return { p, t, n: new T.Vector3().crossVectors(t, up).normalize() };
    };
    return { len, at };
  }

  function smoothNormals(T, g) {
    g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal, map = new Map();
    for (let i = 0; i < p.count; i++) {
      const k = p.getX(i).toFixed(3) + ',' + p.getY(i).toFixed(3) + ',' + p.getZ(i).toFixed(3);
      const e = map.get(k); if (e) e.push(i); else map.set(k, [i]);
    }
    const v = new T.Vector3();
    map.forEach(ids => { if (ids.length < 2) return; v.set(0, 0, 0); ids.forEach(i => v.add(new T.Vector3(n.getX(i), n.getY(i), n.getZ(i)))); v.normalize(); ids.forEach(i => n.setXYZ(i, v.x, v.y, v.z)); });
    n.needsUpdate = true; return g;
  }

  function sweep(T, frames, profile, M) {
    const pos = [], idx = [], N = frames.length;
    frames.forEach((fr, i) => {
      const pr = profile(fr, i);
      for (let j = 0; j < M; j++) { const [no, y] = pr[j]; pos.push(fr.p.x + fr.n.x * no, y, fr.p.z + fr.n.z * no); }
    });
    for (let i = 0; i < N - 1; i++) for (let j = 0; j < M; j++) {
      const a = i * M + j, b = i * M + (j + 1) % M, c = (i + 1) * M + (j + 1) % M, d = (i + 1) * M + j;
      idx.push(a, d, b, b, d, c);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  function archFrames(arch, steps) {
    const out = [];
    for (let i = steps; i >= 1; i--) { const s = arch.len * i / steps; out.push({ ...arch.at(s, -1), f: i / steps }); }
    for (let i = 0; i <= steps; i++) { const s = arch.len * i / steps; out.push({ ...arch.at(s, 1), f: i / steps }); }
    return out;
  }

  function loop(M, fn) { const r = []; for (let j = 0; j < M; j++) { const a = (j / M) * Math.PI * 2; r.push(fn(Math.cos(a), Math.sin(a))); } return r; }

  function crownGeo(T, e, taper, dir) {
    const g = new T.SphereGeometry(0.5, 40, 28), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) * 2, y = p.getY(i) * 2, z = p.getZ(i) * 2;
      x = sp(x, e); y = sp(y, e * 1.05); z = sp(z, e);
      const occl = -dir * y;
      if (taper) z *= 1 - taper * Math.max(0, occl);
      p.setXYZ(i, x * 0.5, y * 0.5, z * 0.5);
    }
    return smoothNormals(T, g);
  }

  function buildTooth(T, mat, k, width, upper) {
    const dir = upper ? 1 : -1, g = new T.Group();
    const type = k <= 2 ? 'inc' : k === 3 ? 'can' : k <= 5 ? 'pre' : 'mol';
    const w = width * 0.9;
    const d = { inc: upper ? 6.8 : 6, can: 8, pre: 8.8, mol: upper ? 10.6 : 10.2 }[type];
    const h = { inc: upper ? 10 : 9, can: 10.5, pre: 8.2, mol: 7 }[type];
    const e = { inc: 0.85, can: 0.9, pre: 0.72, mol: 0.55 }[type];
    const crown = new T.Mesh(crownGeo(T, e, type === 'inc' ? 0.55 : type === 'can' ? 0.3 : 0, dir), mat);
    crown.scale.set(w, h, d); crown.position.y = dir * (0.4 + h / 2); g.add(crown);
    const rootL = { inc: upper ? 13 : 12.5, can: 17, pre: 14, mol: k === 8 ? 11 : 13 }[type];
    const roots = [];
    if (type === 'mol') {
      roots.push([-w * 0.24, d * 0.16, w * 0.17, -0.12], [w * 0.24, d * 0.16, w * 0.17, 0.12]);
      if (upper) roots.push([0, -d * 0.26, w * 0.19, 0]);
    } else if (type === 'pre' && upper && k === 4) {
      roots.push([0, d * 0.2, w * 0.22, 0], [0, -d * 0.2, w * 0.22, 0]);
    } else roots.push([0, 0, Math.min(w, d) * 0.3, 0]);
    roots.forEach(([x, z, r, sp]) => {
      const rg = new T.CylinderGeometry(r * 0.42, r * 0.92, rootL, 18, 4);
      const m = new T.Mesh(rg, mat.userData.root || mat);
      m.position.set(x, dir * (0.4 + h * 0.85 + rootL / 2), z);
      if (!upper) m.rotation.z = Math.PI;
      m.rotation.z += sp * dir;
      g.add(m);
    });
    const tilt = type === 'inc' ? 0.24 : type === 'can' ? 0.14 : type === 'pre' ? 0.06 : 0;
    g.rotation.x = -dir * tilt;
    g.userData = { h, d, dir };
    return g;
  }

  class Dio3D extends HTMLElement {
    static get observedAttributes() { return ATTRS; }
    constructor() { super(); this._p = { view: 'full', vis: 'maxila,mandibula,dentes,canal', yaw: '0', zoom: '1', focus: '', mark: '', interactive: '1' }; }
    connectedCallback() {
      Object.assign(this.style, { display: 'block', position: this.style.position || 'relative', width: this.style.width || '100%', height: this.style.height || '100%', overflow: 'hidden' });
      loadThree().then(T => { if (this.isConnected && !this._ready) this._init(T); });
    }
    disconnectedCallback() {
      cancelAnimationFrame(this._raf); this._ro && this._ro.disconnect();
      if (this._r) { this._r.dispose(); this._r.forceContextLoss && this._r.forceContextLoss(); this._r.domElement.remove(); }
      this._label && this._label.remove();
      this._ready = false; this._r = null;
    }
    attributeChangedCallback(n, o, v) { this._set(n, v); }
    _set(n, v) {
      if (v == null) return; v = String(v);
      if (this._p[n] === v && this._ready) return;
      this._p[n] = v;
      if (!this._ready) return;
      if (n === 'yaw') { this.st.yawT = +v || 0; this.st.pitchT = 8; }
      else if (n === 'zoom') this.st.zoomT = Math.max(0.5, Math.min(3, +v || 1));
      else if (n === 'view') this._frame();
      else if (n === 'interactive') this._r.domElement.style.cursor = v === '0' ? '' : 'grab';
      this._applyVis(); this.dirty = true;
    }
    _init(T) {
      this.T = T; this._ready = true;
      const r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setClearColor(0x000000, 0);
      r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
      Object.assign(r.domElement.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none', cursor: this._p.interactive === '0' ? '' : 'grab' });
      this.appendChild(r.domElement); this._r = r;
      const lab = document.createElement('div');
      Object.assign(lab.style, { position: 'absolute', left: '0', top: '0', padding: '3px 10px', background: '#f2b84b', color: '#1a1406', font: '600 14px IBM Plex Sans, sans-serif', borderRadius: '4px', pointerEvents: 'none', display: 'none', transform: 'translate(-50%,-100%)', whiteSpace: 'nowrap' });
      this.appendChild(lab); this._label = lab;
      const sc = new T.Scene(); this.scene = sc;
      this.cam = new T.PerspectiveCamera(30, 1, 1, 3000);
      sc.add(new T.HemisphereLight(0xe4ecff, 0x1a1e24, 0.85));
      const key = new T.DirectionalLight(0xffffff, 1.7); key.position.set(70, 90, 140); sc.add(key);
      const fill = new T.DirectionalLight(0xa9c0ff, 0.55); fill.position.set(-110, 10, 70); sc.add(fill);
      const rim = new T.DirectionalLight(0xffffff, 0.7); rim.position.set(0, 60, -160); sc.add(rim);
      this.rig = new T.Group(); sc.add(this.rig);
      this.model = new T.Group(); this.rig.add(this.model);
      this._build(T);
      const s = this.st = { yaw: 0, yawT: +this._p.yaw || 0, pitch: 8, pitchT: 8, zoom: 1, zoomT: +this._p.zoom || 1, dist: 175, distT: 175, base: 0, baseT: 0, tgt: new T.Vector3(), tgtT: new T.Vector3() };
      this._frame(true); this._applyVis();
      const el = r.domElement;
      el.addEventListener('pointerdown', e => {
        if (this._p.interactive === '0') return;
        e.stopPropagation(); el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing';
        let x0 = e.clientX, y0 = e.clientY;
        const mv = ev => { s.yawT += (ev.clientX - x0) * 0.45; s.pitchT = Math.max(-50, Math.min(50, s.pitchT + (ev.clientY - y0) * 0.3)); x0 = ev.clientX; y0 = ev.clientY; this.dirty = true; };
        const upf = () => {
          el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', upf); el.removeEventListener('pointercancel', upf); el.style.cursor = 'grab';
          let a = ((s.yawT + 180) % 360 + 360) % 360 - 180; s.yawT = a; s.yaw = a + (s.yaw - Math.round(s.yaw / 360) * 360 - s.yaw) ; s.yaw = ((s.yaw + 180) % 360 + 360) % 360 - 180;
          if (Math.abs(s.yaw - s.yawT) > 180) s.yaw += s.yawT > s.yaw ? 360 : -360;
          this._p.yaw = String(Math.round(a));
          window.__dio3dRotate && window.__dio3dRotate(Math.round(a));
        };
        el.addEventListener('pointermove', mv); el.addEventListener('pointerup', upf); el.addEventListener('pointercancel', upf);
      });
      el.addEventListener('wheel', e => {
        if (this._p.interactive === '0') return;
        e.preventDefault(); s.zoomT = Math.max(0.6, Math.min(2.5, s.zoomT * Math.exp(-e.deltaY * 0.0012))); this.dirty = true;
        clearTimeout(this._zt); this._zt = setTimeout(() => { const z = +s.zoomT.toFixed(2); this._p.zoom = String(z); window.__dio3dZoom && window.__dio3dZoom(z); }, 160);
      }, { passive: false });
      this._ro = new ResizeObserver(() => this._resize()); this._ro.observe(this); this._resize();
      const tick = () => {
        this._raf = requestAnimationFrame(tick);
        const L = (a, b) => a + (b - a) * 0.16; let moving = false;
        for (const [c, t] of [['yaw', 'yawT'], ['pitch', 'pitchT'], ['zoom', 'zoomT'], ['dist', 'distT'], ['base', 'baseT']]) { if (Math.abs(s[c] - s[t]) > 0.002) { s[c] = L(s[c], s[t]); moving = true; } else s[c] = s[t]; }
        if (s.tgt.distanceTo(s.tgtT) > 0.01) { s.tgt.lerp(s.tgtT, 0.16); moving = true; } else s.tgt.copy(s.tgtT);
        if (!moving && !this.dirty) return;
        this.dirty = false;
        this.model.position.copy(s.tgt).multiplyScalar(-1);
        this.rig.rotation.set(s.pitch * Math.PI / 180, (s.yaw + s.base) * Math.PI / 180, 0, 'XYZ');
        this.cam.position.set(0, 0, s.dist / s.zoom * (this.cam.aspect < 1.1 ? 1.3 : 1)); this.cam.lookAt(0, 0, 0);
        r.render(sc, this.cam);
        this._placeLabel();
      };
      tick();
    }
    _resize() {
      if (!this._r) return;
      const w = Math.max(1, this.clientWidth), h = Math.max(1, this.clientHeight);
      this._r.setSize(w, h, false); this.cam.aspect = w / h;
      this.cam.fov = w / h < 1.1 ? 38 : 30; this.cam.updateProjectionMatrix(); this.dirty = true;
    }
    _frame(snap) {
      const T = this.T, s = this.st, reg = this._p.view === 'dente';
      if (reg) { const t = new T.Vector3(); this.t26.getWorldPosition(t); this.model.worldToLocal(t); s.tgtT.copy(t).add(new T.Vector3(0, 9, 0)); s.distT = 125; s.baseT = -58; }
      else { s.tgtT.set(0, 0, -6); s.distT = 178; s.baseT = 0; }
      if (snap) { s.tgt.copy(s.tgtT); s.dist = s.distT; s.base = s.baseT; s.yaw = s.yawT; s.zoom = s.zoomT; s.pitch = s.pitchT; }
      this.dirty = true;
    }
    _build(T) {
      const M = this.model, shell = (c, o) => new T.MeshStandardMaterial({ color: c, transparent: true, opacity: o, roughness: 0.65, metalness: 0, depthWrite: false, side: T.DoubleSide });
      this.mats = { maxila: shell(0xc9c56a, 0.3), mandibula: shell(0xa78fd6, 0.34), seio: shell(0x63bcd4, 0.32), canal: new T.MeshStandardMaterial({ color: 0xe5484d, roughness: 0.4, emissive: 0x5a0d10, transparent: true, opacity: 1 }) };
      const upArch = makeArch(T, 23, 27, 26, 28), loArch = makeArch(T, 21, 25, 27, 34);
      // maxilla
      const fmx = archFrames(upArch, 46);
      const mx = new T.Mesh(sweep(T, fmx, fr => { const f = fr.f, top = 28 + 9 * Math.pow(f, 1.2), bot = 8.6, yc = (top + bot) / 2, hh = (top - bot) / 2, bu = 6.2, li = 6.5 + 7 * f; return loop(30, (c, s) => [(c >= 0 ? bu : li) * sp(c, 0.8), yc + hh * sp(s, 0.75)]); }, 30), this.mats.maxila);
      mx.renderOrder = 3; M.add(mx);
      const inner = []; for (let i = 0; i <= 40; i++) { const s = upArch.len * i / 40, a = upArch.at(s, 1); inner.push(new T.Vector2(a.p.x - a.n.x * 6, a.p.z - a.n.z * 6)); }
      const shp = new T.Shape([...inner.slice().reverse().map(v => new T.Vector2(-v.x, v.y)), ...inner]);
      const pg = new T.ShapeGeometry(shp, 24); pg.rotateX(Math.PI / 2);
      const pp = pg.attributes.position; for (let i = 0; i < pp.count; i++) { const x = pp.getX(i); pp.setY(i, 15 + 5 * Math.max(0, 1 - (x / 17) * (x / 17))); }
      pg.computeVertexNormals();
      const pal = new T.Mesh(pg, this.mats.maxila); pal.renderOrder = 3; M.add(pal);
      this.parts = { maxila: [mx, pal], mandibula: [], seio: [], canal: [], dsup: [], dinf: [] };
      // mandible
      const fmd = archFrames(loArch, 46);
      const md = new T.Mesh(sweep(T, fmd, fr => { const f = fr.f, top = -7, bot = -33 + 4 * f, yc = (top + bot) / 2, hh = (top - bot) / 2, bu = 5.5 + 1.5 * f, li = 5 + f, chin = 2.6 * Math.pow(1 - f, 3); return loop(30, (c, s) => [-0.5 + (c >= 0 ? bu : li) * sp(c, 0.8) + (s < 0 && c > -0.2 ? chin * -s : 0), yc + hh * sp(s, 0.72)]); }, 30), this.mats.mandibula);
      md.renderOrder = 3; M.add(md); this.parts.mandibula.push(md);
      const ram = new T.Shape(); [[-27, -31], [-38, -30.5], [-42.5, -25], [-42, -6], [-41, 14], [-42.5, 20], [-39.5, 24], [-35.5, 21.5], [-35, 13], [-31, 8.5], [-27, 16.5], [-25, 15.5], [-24.5, 4], [-24, -9]].forEach(([z, y], i) => i ? ram.lineTo(z, y) : ram.moveTo(z, y)); ram.closePath();
      [1, -1].forEach(side => {
        const g = new T.ExtrudeGeometry(ram, { depth: 6, bevelEnabled: true, bevelThickness: 1.6, bevelSize: 1.4, bevelSegments: 4, curveSegments: 6 });
        g.translate(0, 0, -3); g.rotateY(-Math.PI / 2);
        const m = new T.Mesh(g, this.mats.mandibula); m.position.x = side * 29.5; m.rotation.y = side * 0.1; m.renderOrder = 3; M.add(m); this.parts.mandibula.push(m);
        const cv = new T.CatmullRomCurve3([[27.5, -3, -37], [26.5, -13, -31], [25, -21, -20], [23, -23.5, -8], [20.5, -21.5, 3], [18.5, -18, 12]].map(([x, y, z]) => new T.Vector3(side * x, y, z)));
        const c = new T.Mesh(new T.TubeGeometry(cv, 64, 1.25, 14), this.mats.canal); M.add(c); this.parts.canal.push(c);
        const si = new T.Mesh(new T.SphereGeometry(1, 40, 28), this.mats.seio); si.scale.set(7, 6.5, 10.5); si.position.set(side * 18, 27.5, -6); si.renderOrder = 2; M.add(si); this.parts.seio.push(si);
      });
      // teeth
      this.teeth = {};
      const place = (arch, widths, upper, q) => {
        let s = 0.15;
        widths.forEach((w, i) => {
          const k = i + 1, c = s + w / 2; s += w + 0.25;
          [1, -1].forEach(side => {
            const fdi = (upper ? (side > 0 ? 2 : 1) : (side > 0 ? 3 : 4)) * 10 + k;
            const mat = new T.MeshPhysicalMaterial({ color: upper ? 0xe3a66d : 0xecebe6, roughness: 0.36, clearcoat: 0.35, clearcoatRoughness: 0.45, transparent: true, opacity: 1 });
            mat.userData.root = new T.MeshStandardMaterial({ color: upper ? 0xc98d5a : 0xd6d2c8, roughness: 0.6, transparent: true, opacity: 0.85, depthWrite: false });
            const a = arch.at(c, side), outer = new T.Group();
            outer.position.copy(a.p);
            outer.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(a.t, new T.Vector3(0, 1, 0), a.n));
            const tooth = buildTooth(T, mat, k, w, upper); outer.add(tooth); M.add(outer);
            this.teeth[fdi] = { g: outer, inner: tooth, mat, upper };
            (upper ? this.parts.dsup : this.parts.dinf).push(outer);
          });
        });
      };
      place(upArch, UP_W, true); place(loArch, LO_W, false);
      const t26 = this.teeth[26]; this.t26 = new T.Object3D(); this.t26.position.y = 0.4 + t26.inner.userData.h / 2; t26.inner.add(this.t26);
      const ring = new T.Mesh(new T.TorusGeometry(6.2, 0.38, 12, 72), new T.MeshBasicMaterial({ color: 0xf2b84b, depthTest: false, transparent: true }));
      ring.position.set(0, 0.4 + t26.inner.userData.h / 2, t26.inner.userData.d / 2 + 1.5); ring.renderOrder = 10; t26.inner.add(ring); this.ring = ring;
      this.model.updateMatrixWorld(true);
    }
    _applyVis() {
      if (!this._ready) return;
      const p = this._p, vis = new Set((p.vis || '').split(',').filter(Boolean)), reg = p.view === 'dente', focus = p.focus || '';
      const fade = k => focus && focus !== k;
      const show = (arr, on) => arr.forEach(o => { o.visible = on; });
      show(this.parts.maxila, vis.has('maxila'));
      show(this.parts.mandibula, !reg && vis.has('mandibula'));
      show(this.parts.canal, !reg && vis.has('canal'));
      show(this.parts.seio, reg && vis.has('seio'));
      show(this.parts.dsup, vis.has('dentes'));
      show(this.parts.dinf, !reg && vis.has('dentes'));
      const m = this.mats;
      m.maxila.opacity = focus === 'maxila' ? 0.62 : fade('maxila') ? 0.1 : reg ? 0.24 : 0.3;
      m.mandibula.opacity = focus === 'mandibula' ? 0.66 : fade('mandibula') ? 0.1 : 0.34;
      m.canal.opacity = fade('canal') ? 0.25 : 1; m.canal.depthWrite = m.canal.opacity === 1;
      const local = [24, 25, 26, 27, 28];
      Object.entries(this.teeth).forEach(([fdi, t]) => {
        let o = 1;
        if (reg && !local.includes(+fdi)) o = 0.2;
        if (fade('dentes')) o = Math.min(o, 0.3);
        t.mat.opacity = o; t.mat.depthWrite = o === 1; t.mat.userData.root.opacity = o * 0.85; t.g.renderOrder = o === 1 ? 0 : 4;
      });
      const mk = p.mark === '26' && vis.has('dentes');
      this.ring.visible = mk; this._label.style.display = mk ? 'block' : 'none'; this._label.textContent = '26';
      this.dirty = true;
    }
    _placeLabel() {
      if (!this.ring.visible) return;
      const T = this.T, v = new T.Vector3(); this.ring.getWorldPosition(v); v.project(this.cam);
      const w = this.clientWidth, h = this.clientHeight;
      this._label.style.left = ((v.x + 1) / 2 * w + 34) + 'px'; this._label.style.top = ((1 - v.y) / 2 * h - 22) + 'px';
    }
  }
  ATTRS.forEach(k => Object.defineProperty(Dio3D.prototype, k, { get() { return this._p[k]; }, set(v) { this._set(k, v); }, configurable: true }));
  customElements.define('dio-3d', Dio3D);
})();
