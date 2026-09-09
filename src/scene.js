(() => {
  'use strict';

  if (!window.THREE) throw new Error('Three.js did not initialize.');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCompact = Math.min(window.innerWidth, window.innerHeight) < 640;
  const TAU = Math.PI * 2;
  const clamp = THREE.MathUtils.clamp;
  const smoothstep = (t) => t * t * (3 - 2 * t);
  const seeded = (() => {
    let state = 0x5eeda11;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  })();

  const metrics = {
    meshes: 0,
    outlinedMeshes: 0,
    products: 0,
    shelves: 0,
    rainDrops: 0,
    roofDrips: 0,
    puddleRipples: 0,
    lightSources: 0,
    interiorZones: [
      '货架', '饮料柜', '便当饭团区', '收银台', '咖啡机', '杂志架',
      '冰柜', '关东煮台', '地面导视', '储物柜与后场门',
    ],
    exteriorFeatures: [
      '玻璃橱窗', '自动门', '屋檐雨棚', '门口地垫', '自动贩卖机', '自行车',
      '雨伞架', '垃圾桶', '路灯', '电线杆与电线', '路牌', '街角护栏',
      '停车位', '排水沟', '积水路面', '反光斑马线', '小巷入口',
      '空调外机', '公告海报栏', '交通信号灯',
    ],
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07101f);
  scene.fog = new THREE.FogExp2(0x081322, 0.025);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCompact ? 1.35 : 1.7));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;
  renderer.physicallyCorrectLights = false;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '可自由旋转缩放的雨夜日式便利店街角三维微缩模型');
  document.body.appendChild(renderer.domElement);

  const initialAspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(initialAspect < 0.72 ? 58 : 39, initialAspect, 0.1, 120);
  camera.position.set(22.5, 13.2, 25.5);

  const gradientData = new Uint8Array([28, 86, 158, 225]);
  const gradientMap = new THREE.DataTexture(gradientData, 4, 1, THREE.LuminanceFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;

  const makeToon = (color, extra = {}) => new THREE.MeshToonMaterial({
    color,
    gradientMap,
    ...extra,
  });
  const makePhong = (color, extra = {}) => new THREE.MeshPhongMaterial({ color, ...extra });
  const materials = {
    outline: new THREE.LineBasicMaterial({ color: 0x172137, transparent: true, opacity: 0.72 }),
    darkOutline: new THREE.LineBasicMaterial({ color: 0x080d18, transparent: true, opacity: 0.86 }),
    base: makeToon(0x182238),
    baseEdge: makeToon(0x0d1424),
    asphalt: makePhong(0x142333, { specular: 0x8fc8d5, shininess: 92 }),
    wetSidewalk: makePhong(0x50606b, { specular: 0xa7d8dc, shininess: 72 }),
    curb: makeToon(0x9aa3a5),
    white: makeToon(0xe7e5db),
    warmWhite: makeToon(0xfff0ce),
    wall: makeToon(0xe6e2d7),
    wallShadow: makeToon(0xa6adb0),
    roof: makeToon(0x26354a),
    frame: makeToon(0x293544),
    black: makeToon(0x111827),
    steel: makeToon(0x7c8793),
    guard: makeToon(0xd7d9d5),
    yellow: makeToon(0xffd35c),
    red: makeToon(0xe75f68),
    blue: makeToon(0x4d98d6),
    teal: makeToon(0x48b8ab),
    green: makeToon(0x68b883),
    orange: makeToon(0xe69a55),
    brown: makeToon(0x76584c),
    floor: makePhong(0xd7c4a2, { specular: 0xffefd1, shininess: 38, emissive: 0x211308, emissiveIntensity: 0.24 }),
    roadMark: makePhong(0xd9ddd5, { transparent: true, opacity: 0.72, specular: 0xffffff, shininess: 80 }),
    glass: makePhong(0x9cd5e8, {
      transparent: true,
      opacity: 0.13,
      specular: 0xffffff,
      shininess: 130,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    freezerGlass: makePhong(0xc9eff7, {
      transparent: true,
      opacity: 0.22,
      specular: 0xffffff,
      shininess: 140,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    puddle: new THREE.MeshPhongMaterial({
      color: 0x24465d,
      transparent: true,
      opacity: 0.34,
      specular: 0xbff4ff,
      shininess: 150,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  };

  const world = new THREE.Group();
  world.name = '雨夜便利店街角微缩世界';
  scene.add(world);

  function applyShadow(mesh, cast = true, receive = true) {
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    return mesh;
  }

  function addEdges(mesh, dark = false, opacity = 1) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, 28),
      (dark ? materials.darkOutline : materials.outline).clone(),
    );
    edges.material.opacity *= opacity;
    edges.renderOrder = 3;
    mesh.add(edges);
    metrics.outlinedMeshes += 1;
    return mesh;
  }

  function box(name, size, position, material, parent = world, options = {}) {
    const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    if (options.rotation) mesh.rotation.set(options.rotation[0], options.rotation[1], options.rotation[2]);
    applyShadow(mesh, options.cast !== false, options.receive !== false);
    parent.add(mesh);
    if (options.edges !== false) addEdges(mesh, options.darkEdges, options.edgeOpacity ?? 1);
    metrics.meshes += 1;
    return mesh;
  }

  function cylinder(name, radiusTop, radiusBottom, height, position, material, parent = world, options = {}) {
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, options.segments || 12);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    if (options.rotation) mesh.rotation.set(options.rotation[0], options.rotation[1], options.rotation[2]);
    applyShadow(mesh, options.cast !== false, options.receive !== false);
    parent.add(mesh);
    if (options.edges) addEdges(mesh, options.darkEdges, options.edgeOpacity ?? 1);
    metrics.meshes += 1;
    return mesh;
  }

  function plane(name, width, height, position, material, parent = world, rotation = [0, 0, 0]) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.receiveShadow = true;
    parent.add(mesh);
    metrics.meshes += 1;
    return mesh;
  }

  function tubeBetween(name, start, end, radius, material, parent = world, segments = 8) {
    const a = new THREE.Vector3(start[0], start[1], start[2]);
    const b = new THREE.Vector3(end[0], end[1], end[2]);
    const midpoint = a.clone().add(b).multiplyScalar(0.5);
    const mesh = cylinder(name, radius, radius, a.distanceTo(b), [midpoint.x, midpoint.y, midpoint.z], material, parent, { segments, edges: false });
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return mesh;
  }

  function canvasTexture(width, height, draw, options = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    draw(ctx, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texture.wrapS = options.wrapS ?? THREE.ClampToEdgeWrapping;
    texture.wrapT = options.wrapT ?? THREE.ClampToEdgeWrapping;
    if (options.repeat) texture.repeat.set(options.repeat[0], options.repeat[1]);
    texture.needsUpdate = true;
    return texture;
  }

  function labelMaterial(texture, extra = {}) {
    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      toneMapped: false,
      ...extra,
    });
  }

  function makeSignTexture(side = false) {
    return canvasTexture(side ? 256 : 1024, 256, (ctx, width, height) => {
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#fff8d9');
      gradient.addColorStop(0.55, '#ffffff');
      gradient.addColorStop(1, '#e8f8ff');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#55b9ab';
      ctx.fillRect(0, 0, width, height * 0.18);
      ctx.fillStyle = '#ef6b70';
      ctx.fillRect(0, height * 0.82, width, height * 0.18);
      ctx.fillStyle = '#17334a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (side) {
        ctx.font = '900 92px sans-serif';
        ctx.fillText('M', width / 2, height * 0.52);
      } else {
        ctx.font = '900 76px sans-serif';
        ctx.fillText('まどり MART', width / 2, height * 0.53);
        ctx.font = '700 26px sans-serif';
        ctx.fillText('いつもの灯り、いつもの角で。', width / 2, height * 0.72);
      }
    });
  }

  function makePosterTexture(title, subtitle, colors) {
    return canvasTexture(320, 480, (ctx, width, height) => {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, colors[0]);
      gradient.addColorStop(1, colors[1]);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.fillRect(18, 18, width - 36, height - 36);
      ctx.fillStyle = colors[0];
      ctx.beginPath();
      ctx.arc(width * 0.5, height * 0.31, width * 0.28, 0, TAU);
      ctx.fill();
      ctx.fillStyle = colors[1];
      ctx.beginPath();
      ctx.arc(width * 0.59, height * 0.27, width * 0.16, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1f3140';
      ctx.textAlign = 'center';
      ctx.font = '900 44px sans-serif';
      ctx.fillText(title, width / 2, height * 0.68);
      ctx.font = '700 25px sans-serif';
      ctx.fillText(subtitle, width / 2, height * 0.78);
      ctx.fillStyle = '#ef6b70';
      ctx.fillRect(width * 0.25, height * 0.84, width * 0.5, 14);
    });
  }

  function makeGlassRainTexture() {
    return canvasTexture(256, 512, (ctx, width, height) => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < 55; i += 1) {
        const x = seeded() * width;
        const y = seeded() * height;
        const length = 12 + seeded() * 86;
        const alpha = 0.07 + seeded() * 0.18;
        const grad = ctx.createLinearGradient(x, y, x + 3, y + length);
        grad.addColorStop(0, `rgba(220,247,255,${alpha * 0.15})`);
        grad.addColorStop(0.55, `rgba(220,247,255,${alpha})`);
        grad.addColorStop(1, 'rgba(220,247,255,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1 + seeded() * 1.8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x - 2, y + length * 0.3, x + 4, y + length * 0.72, x + 2, y + length);
        ctx.stroke();
        ctx.fillStyle = `rgba(230,250,255,${alpha * 0.8})`;
        ctx.beginPath();
        ctx.ellipse(x, y, 1.2 + seeded() * 2.2, 2.8 + seeded() * 4.5, 0, 0, TAU);
        ctx.fill();
      }
    }, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, repeat: [1.7, 1.2] });
  }

  class OrbitRig {
    constructor(cameraObject, element) {
      this.camera = cameraObject;
      this.element = element;
      const portraitMode = isCompact && initialAspect < 0.72;
      this.target = new THREE.Vector3(0, portraitMode ? 2.15 : 2.9, -0.7);
      this.radius = portraitMode ? 42 : 29.5;
      this.theta = 0.72;
      this.phi = 1.34;
      this.goalRadius = this.radius;
      this.goalTheta = this.theta;
      this.goalPhi = this.phi;
      this.pointer = null;
      this.pointers = new Map();
      this.lastPinch = null;
      this.lastInteraction = performance.now();
      this.rotating = false;
      this.bind();
      this.update(1);
    }

    bind() {
      this.element.addEventListener('contextmenu', (event) => event.preventDefault());
      this.element.addEventListener('pointerdown', (event) => {
        this.element.focus({ preventScroll: true });
        this.element.setPointerCapture(event.pointerId);
        this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, button: event.button });
        this.pointer = { x: event.clientX, y: event.clientY, button: event.button };
        this.rotating = true;
        this.lastInteraction = performance.now();
      });
      this.element.addEventListener('pointermove', (event) => {
        if (!this.pointers.has(event.pointerId)) return;
        const previous = this.pointers.get(event.pointerId);
        this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, button: previous.button });
        this.lastInteraction = performance.now();

        if (this.pointers.size === 1) {
          const dx = event.clientX - previous.x;
          const dy = event.clientY - previous.y;
          if (previous.button === 2 || previous.button === 1 || event.shiftKey) this.pan(dx, dy);
          else this.rotate(dx, dy);
        } else if (this.pointers.size === 2) {
          const points = [...this.pointers.values()];
          const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
          const center = { x: (points[0].x + points[1].x) * 0.5, y: (points[0].y + points[1].y) * 0.5 };
          if (this.lastPinch) {
            this.goalRadius *= this.lastPinch.distance / Math.max(20, distance);
            this.pan(center.x - this.lastPinch.center.x, center.y - this.lastPinch.center.y);
          }
          this.lastPinch = { distance, center };
        }
      });
      const release = (event) => {
        this.pointers.delete(event.pointerId);
        if (this.pointers.size < 2) this.lastPinch = null;
        if (this.pointers.size === 0) this.rotating = false;
        this.lastInteraction = performance.now();
      };
      this.element.addEventListener('pointerup', release);
      this.element.addEventListener('pointercancel', release);
      this.element.addEventListener('wheel', (event) => {
        event.preventDefault();
        this.goalRadius *= Math.exp(event.deltaY * 0.0009);
        this.goalRadius = clamp(this.goalRadius, 13.5, 48);
        this.lastInteraction = performance.now();
      }, { passive: false });
      window.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', '+', '=', '-', '_', 'w', 'a', 's', 'd'].includes(key)) {
          event.preventDefault();
          this.lastInteraction = performance.now();
        }
        if (key === 'arrowleft') this.goalTheta -= 0.12;
        if (key === 'arrowright') this.goalTheta += 0.12;
        if (key === 'arrowup') this.goalPhi -= 0.09;
        if (key === 'arrowdown') this.goalPhi += 0.09;
        if (key === '+' || key === '=') this.goalRadius *= 0.9;
        if (key === '-' || key === '_') this.goalRadius *= 1.1;
        if (key === 'a') this.pan(34, 0);
        if (key === 'd') this.pan(-34, 0);
        if (key === 'w') this.pan(0, 34);
        if (key === 's') this.pan(0, -34);
        this.goalRadius = clamp(this.goalRadius, 13.5, 48);
      });
    }

    rotate(dx, dy) {
      this.goalTheta -= dx * 0.006;
      this.goalPhi -= dy * 0.005;
      this.goalPhi = clamp(this.goalPhi, 0.38, 1.46);
    }

    pan(dx, dy) {
      const scale = this.goalRadius * 0.00145;
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
      this.target.addScaledVector(right, dx * scale);
      this.target.addScaledVector(forward, -dy * scale);
      this.target.x = clamp(this.target.x, -4.5, 5.5);
      this.target.y = clamp(this.target.y, 1.5, 5.2);
      this.target.z = clamp(this.target.z, -4.5, 4.5);
    }

    update(dt) {
      const idle = performance.now() - this.lastInteraction > 7000;
      if (idle && !reducedMotion) this.goalTheta += dt * 0.018;
      const blend = 1 - Math.pow(0.001, dt);
      this.theta += (this.goalTheta - this.theta) * blend;
      this.phi += (this.goalPhi - this.phi) * blend;
      this.radius += (this.goalRadius - this.radius) * blend;
      this.goalPhi = clamp(this.goalPhi, 0.38, 1.46);
      this.goalRadius = clamp(this.goalRadius, 13.5, 48);
      const sinPhi = Math.sin(this.phi);
      this.camera.position.set(
        this.target.x + this.radius * sinPhi * Math.sin(this.theta),
        this.target.y + this.radius * Math.cos(this.phi),
        this.target.z + this.radius * sinPhi * Math.cos(this.theta),
      );
      this.camera.lookAt(this.target);
    }
  }

  const controls = new OrbitRig(camera, renderer.domElement);

  const animated = {
    doorLeft: null,
    doorRight: null,
    doorClosedX: [0, 0],
    signMaterials: [],
    glassTextures: [],
    rain: null,
    roofDrips: null,
    ripples: [],
    reflectionPlanes: [],
    trafficLamps: {},
    hangingCables: [],
  };

  function createLighting() {
    const hemi = new THREE.HemisphereLight(0x7897c8, 0x182031, 0.3);
    scene.add(hemi);

    const moon = new THREE.DirectionalLight(0xa6c8ff, 0.44);
    moon.position.set(8, 18, 11);
    moon.castShadow = true;
    moon.shadow.mapSize.set(isCompact ? 1024 : 2048, isCompact ? 1024 : 2048);
    moon.shadow.camera.left = -17;
    moon.shadow.camera.right = 17;
    moon.shadow.camera.top = 17;
    moon.shadow.camera.bottom = -17;
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 42;
    moon.shadow.bias = -0.00035;
    scene.add(moon);
    metrics.lightSources += 2;

    const storeGlow = new THREE.PointLight(0xff9f50, 1.95, 14, 1.62);
    storeGlow.position.set(-1.8, 4.1, -1.55);
    scene.add(storeGlow);
    const storeFill = new THREE.PointLight(0xffc46e, 1.8, 13, 1.75);
    storeFill.position.set(-4.7, 3.3, -3.7);
    scene.add(storeFill);
    const checkoutGlow = new THREE.PointLight(0xffa34f, 1.22, 8, 1.8);
    checkoutGlow.position.set(2.2, 3.5, -1.1);
    scene.add(checkoutGlow);
    metrics.lightSources += 3;
  }

  function createBaseAndRoad() {
    const base = box('完整正方形收藏底座', [24, 1.0, 24], [0, 0, 0], materials.base, world, { darkEdges: true });
    box('底座下缘', [23.2, 0.26, 23.2], [0, -0.58, 0], materials.baseEdge, world, { edges: false });

    const top = plane('湿润沥青总地面', 23.55, 23.55, [0, 0.51, 0], materials.asphalt, world, [-Math.PI / 2, 0, 0]);
    top.receiveShadow = true;

    // Store apron and L-shaped sidewalk establish the corner turn.
    box('便利店正面人行道', [14.4, 0.28, 2.0], [-2.0, 0.69, 1.9], materials.wetSidewalk, world, { cast: false });
    box('便利店侧面人行道', [2.05, 0.28, 10.1], [5.22, 0.69, -2.15], materials.wetSidewalk, world, { cast: false });
    box('正面路缘石', [14.4, 0.32, 0.25], [-2.0, 0.75, 2.91], materials.curb, world, { cast: false });
    box('侧面路缘石', [0.25, 0.32, 10.1], [6.24, 0.75, -2.15], materials.curb, world, { cast: false });

    // Fine drainage channels with grate bars.
    box('正面排水沟', [14.4, 0.05, 0.38], [-2.0, 0.56, 3.18], materials.black, world, { cast: false, edges: false });
    for (let i = 0; i < 29; i += 1) {
      box(`正面排水沟格栅${i + 1}`, [0.035, 0.055, 0.31], [-8.8 + i * 0.49, 0.595, 3.18], materials.steel, world, { cast: false, edges: false });
    }
    box('侧面排水沟', [0.38, 0.05, 9.6], [6.52, 0.56, -2.15], materials.black, world, { cast: false, edges: false });
    for (let i = 0; i < 20; i += 1) {
      box(`侧面排水沟格栅${i + 1}`, [0.31, 0.055, 0.035], [6.52, 0.595, -6.75 + i * 0.48], materials.steel, world, { cast: false, edges: false });
    }

    // Parking bay and wheel stops.
    for (let i = 0; i < 3; i += 1) {
      const x = -8.8 + i * 3.25;
      box(`停车位左线${i + 1}`, [0.08, 0.035, 5.4], [x, 0.59, 7.55], materials.roadMark, world, { cast: false, edges: false });
      box(`停车位止车器${i + 1}`, [1.55, 0.18, 0.3], [x + 1.45, 0.69, 9.7], materials.curb, world, { cast: false });
    }
    box('停车位右线', [0.08, 0.035, 5.4], [0.95, 0.59, 7.55], materials.roadMark, world, { cast: false, edges: false });

    // Reflective zebra crossing across the side road.
    for (let i = 0; i < 7; i += 1) {
      const stripe = box(`反光斑马线${i + 1}`, [4.4, 0.035, 0.48], [8.75, 0.6, 3.35 + i * 0.76], materials.roadMark, world, { cast: false, edges: false });
      stripe.material = materials.roadMark.clone();
      stripe.material.opacity = 0.56 + (i % 2) * 0.08;
    }

    // Direction arrows and a wet manhole.
    const arrowTexture = canvasTexture(256, 512, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(225,231,222,.55)';
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.05);
      ctx.lineTo(w * 0.86, h * 0.38);
      ctx.lineTo(w * 0.64, h * 0.38);
      ctx.lineTo(w * 0.64, h * 0.9);
      ctx.lineTo(w * 0.36, h * 0.9);
      ctx.lineTo(w * 0.36, h * 0.38);
      ctx.lineTo(w * 0.14, h * 0.38);
      ctx.closePath();
      ctx.fill();
    });
    plane('道路方向箭头', 1.25, 2.5, [3.2, 0.61, 7.3], labelMaterial(arrowTexture, { opacity: 0.72 }), world, [-Math.PI / 2, 0, 0]);

    const manhole = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.06, 32), makePhong(0x273847, { specular: 0xa0d8e5, shininess: 82 }));
    manhole.name = '湿润井盖';
    manhole.position.set(4.5, 0.6, 7.7);
    manhole.receiveShadow = true;
    world.add(manhole);
    addEdges(manhole, true, 0.7);
    metrics.meshes += 1;

    createWetReflections();
    return base;
  }

  function createWetReflections() {
    const puddles = [
      [-5.8, 4.2, 2.7, 1.0], [-1.9, 4.7, 1.7, 0.8], [2.2, 5.3, 2.1, 0.9],
      [8.2, -0.8, 1.55, 3.0], [9.1, -6.0, 1.3, 2.5], [5.0, 9.3, 2.0, 0.72],
    ];
    puddles.forEach((entry, index) => {
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 34), materials.puddle.clone());
      mesh.name = `积水反光${index + 1}`;
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(entry[0], 0.625 + index * 0.0004, entry[1]);
      mesh.scale.set(entry[2], entry[3], 1);
      world.add(mesh);
      animated.reflectionPlanes.push(mesh);
      metrics.meshes += 1;
    });

    const reflectionSpecs = [
      { x: -5.5, z: 5.2, w: 0.75, h: 4.2, c: 0xffd599, o: 0.12 },
      { x: -3.8, z: 5.0, w: 0.35, h: 3.6, c: 0x5ed4c3, o: 0.13 },
      { x: -2.9, z: 5.6, w: 0.25, h: 4.6, c: 0xf06b76, o: 0.13 },
      { x: 7.9, z: 0.2, w: 0.45, h: 4.8, c: 0x7fbbff, o: 0.11 },
      { x: 9.0, z: 5.7, w: 0.3, h: 3.5, c: 0xf4c85f, o: 0.1 },
    ];
    reflectionSpecs.forEach((spec, index) => {
      const material = new THREE.MeshBasicMaterial({ color: spec.c, transparent: true, opacity: spec.o, depthWrite: false, blending: THREE.AdditiveBlending });
      const reflection = plane(`霓虹湿地反射${index + 1}`, spec.w, spec.h, [spec.x, 0.634 + index * 0.0004, spec.z], material, world, [-Math.PI / 2, 0, 0]);
      reflection.userData.baseOpacity = spec.o;
      animated.reflectionPlanes.push(reflection);
    });
  }

  function createConvenienceStore() {
    const store = new THREE.Group();
    store.name = 'まどりMART便利店主体';
    world.add(store);

    box('店内地板', [13.0, 0.28, 7.7], [-2.0, 0.86, -3.0], materials.floor, store, { cast: false });
    box('后墙', [13.4, 6.1, 0.34], [-2.0, 3.78, -7.05], materials.wall, store);
    box('左侧墙', [0.34, 6.1, 8.2], [-8.7, 3.78, -3.0], materials.wallShadow, store);
    box('前檐主梁', [13.4, 1.1, 0.38], [-2.0, 6.15, 1.08], materials.wall, store);
    box('右侧上梁', [0.38, 1.1, 8.2], [4.7, 6.15, -3.0], materials.wall, store);
    box('平屋顶', [13.9, 0.44, 8.8], [-2.0, 6.92, -3.15], materials.roof, store, { darkEdges: true });
    box('屋顶女儿墙前缘', [14.1, 0.42, 0.32], [-2.0, 7.3, 1.15], materials.frame, store);
    box('屋顶女儿墙侧缘', [0.32, 0.42, 8.75], [4.88, 7.3, -3.15], materials.frame, store);
    createRooftopDetails(store);

    // Right wall alternates glass and service wall.
    box('右后实体墙', [0.36, 5.0, 3.15], [4.7, 3.45, -5.43], materials.wall, store);
    box('右侧窗下墙', [0.36, 0.45, 3.9], [4.7, 1.15, -0.9], materials.wallShadow, store);

    createInterior(store);
    createStorefront(store);
    createCanopy(store);
    return store;
  }

  function createRooftopDetails(store) {
    const rooftop = new THREE.Group();
    rooftop.name = '屋顶机电与雨水细节';
    store.add(rooftop);
    box('屋顶空调机组', [2.8, 0.82, 1.45], [-4.7, 7.63, -3.65], materials.wallShadow, rooftop);
    [-5.45, -3.95].forEach((x, index) => {
      const fan = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.045, 8, 24), materials.frame);
      fan.name = `屋顶机组风扇${index + 1}`;
      fan.position.set(x, 8.06, -3.65);
      fan.rotation.x = Math.PI / 2;
      rooftop.add(fan);
      metrics.meshes += 1;
      for (let blade = 0; blade < 4; blade += 1) {
        const mesh = box('屋顶风扇叶片', [0.08, 0.035, 0.38], [x, 8.07, -3.65], materials.steel, rooftop, { cast: false, edges: false });
        mesh.rotation.y = blade * Math.PI / 2;
      }
    });
    [
      [1.55, -5.25, 0.22], [2.35, -5.6, 0.16], [0.7, -5.65, 0.14],
    ].forEach((vent, index) => {
      cylinder(`屋顶排气管${index + 1}`, vent[2], vent[2] * 1.12, 0.75 + index * 0.12, [vent[0], 7.62, vent[1]], materials.steel, rooftop, { segments: 12, edges: true });
      cylinder(`屋顶排气帽${index + 1}`, vent[2] * 1.5, vent[2] * 1.25, 0.22, [vent[0], 8.05 + index * 0.06, vent[1]], materials.roof, rooftop, { segments: 12, edges: true });
    });
    const roofPuddle = new THREE.Mesh(new THREE.CircleGeometry(1, 32), materials.puddle.clone());
    roofPuddle.name = '屋顶浅积水';
    roofPuddle.rotation.x = -Math.PI / 2;
    roofPuddle.position.set(-0.4, 7.16, -3.0);
    roofPuddle.scale.set(2.1, 0.68, 1);
    rooftop.add(roofPuddle);
    animated.reflectionPlanes.push(roofPuddle);
    metrics.meshes += 1;
  }

  function createInterior(store) {
    const interior = new THREE.Group();
    interior.name = '明亮充实的便利店内部';
    store.add(interior);

    const warmAmbientMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8c42,
      transparent: true,
      opacity: 0.115,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    plane('店内后墙暖光层', 11.6, 4.75, [-2.25, 3.55, -6.79], warmAmbientMaterial, interior);
    plane('店内侧墙暖光层', 5.35, 4.55, [4.5, 3.45, -4.45], warmAmbientMaterial.clone(), interior, [0, Math.PI / 2, 0]);

    const productMaterials = [
      makeToon(0xf3cf6a), makeToon(0xef7778), makeToon(0x64b7cf), makeToon(0x76bd86),
      makeToon(0xae83c8), makeToon(0xf1a460), makeToon(0xe7e3ce), makeToon(0x536f9f),
    ];

    const lightPanelMaterial = new THREE.MeshBasicMaterial({ color: 0xffcf87, toneMapped: false });
    for (let x = -7.0; x <= 3.1; x += 2.55) {
      box('店内天花灯箱', [1.75, 0.06, 0.42], [x, 6.62, -2.8], lightPanelMaterial, interior, { cast: false, edges: false });
      box('店内后排天花灯箱', [1.75, 0.06, 0.42], [x, 6.62, -5.2], lightPanelMaterial, interior, { cast: false, edges: false });
    }

    // Back-room access, lockers and staff storage.
    box('后场门', [1.55, 3.55, 0.12], [2.95, 2.75, -6.82], materials.frame, interior);
    box('后场门内板', [1.28, 3.18, 0.08], [2.95, 2.72, -6.73], materials.wallShadow, interior, { edges: false });
    box('后场门观察窗', [0.66, 0.7, 0.06], [2.95, 3.35, -6.66], materials.freezerGlass, interior, { cast: false, edges: false });
    cylinder('后场门把手', 0.055, 0.055, 0.16, [3.49, 2.55, -6.57], materials.steel, interior, { rotation: [Math.PI / 2, 0, 0], segments: 10 });
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        box(`储物柜${row * 2 + col + 1}`, [0.62, 0.78, 0.32], [1.2 + col * 0.68, 1.35 + row * 0.83, -6.72], materials.wallShadow, interior);
        cylinder('储物柜把手', 0.025, 0.025, 0.12, [1.42 + col * 0.68, 1.35 + row * 0.83, -6.52], materials.frame, interior, { rotation: [Math.PI / 2, 0, 0], segments: 8 });
      }
    }

    createDrinkFridges(interior, productMaterials);
    createShelfUnit(interior, '饭团便当主货架', -5.05, -3.7, Math.PI / 2, 4.5, 0.86, 4, productMaterials, 'bento');
    createShelfUnit(interior, '零食主货架', -2.45, -3.55, Math.PI / 2, 4.55, 0.86, 4, productMaterials, 'snack');
    createShelfUnit(interior, '日用品短货架', 0.0, -4.05, Math.PI / 2, 3.45, 0.78, 3, productMaterials, 'daily');
    createCheckout(interior, productMaterials);
    createMagazineRack(interior, productMaterials);
    createChestFreezer(interior, productMaterials);
    createFloorGuides(interior);

    // Warm hanging category lightboxes.
    const categoryLabels = [
      { text: 'おにぎり  ·  お弁当', x: -5.0, z: -2.1, color: '#e9696f' },
      { text: 'お菓子  ·  Snacks', x: -2.45, z: -2.0, color: '#55aeb1' },
      { text: 'レジ  ·  Coffee', x: 2.2, z: -1.7, color: '#e2a447' },
    ];
    categoryLabels.forEach((item, index) => {
      const texture = canvasTexture(512, 128, (ctx, w, h) => {
        ctx.fillStyle = '#fff8de';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = item.color;
        ctx.fillRect(0, 0, 18, h);
        ctx.fillStyle = '#21374a';
        ctx.font = '800 38px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.text, w / 2, h / 2);
      });
      box(`店内分类灯箱框${index + 1}`, [2.35, 0.68, 0.12], [item.x, 4.75, item.z], materials.frame, interior);
      plane(`店内分类灯箱${index + 1}`, 2.15, 0.5, [item.x, 4.75, item.z + 0.071], labelMaterial(texture), interior);
      tubeBetween('灯箱吊杆左', [item.x - 0.82, 5.08, item.z], [item.x - 0.82, 6.55, item.z], 0.018, materials.frame, interior, 6);
      tubeBetween('灯箱吊杆右', [item.x + 0.82, 5.08, item.z], [item.x + 0.82, 6.55, item.z], 0.018, materials.frame, interior, 6);
    });
  }

  function createShelfUnit(parent, name, x, z, rotationY, length, depth, levels, productMaterials, kind) {
    const group = new THREE.Group();
    group.name = name;
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;
    parent.add(group);
    metrics.shelves += 1;

    box(`${name}底座`, [length, 0.18, depth], [0, 1.02, 0], materials.frame, group);
    const topHeight = 1.24 + levels * 0.62;
    box(`${name}左立柱`, [0.09, topHeight - 0.94, depth], [-length / 2 + 0.05, (topHeight + 0.94) / 2, 0], materials.frame, group);
    box(`${name}右立柱`, [0.09, topHeight - 0.94, depth], [length / 2 - 0.05, (topHeight + 0.94) / 2, 0], materials.frame, group);
    for (let level = 0; level < levels; level += 1) {
      const y = 1.2 + level * 0.62;
      box(`${name}层板${level + 1}`, [length, 0.08, depth], [0, y, 0], materials.warmWhite, group, { cast: false });
      box(`${name}价签条${level + 1}`, [length, 0.1, 0.035], [0, y + 0.08, depth / 2 + 0.01], materials.yellow, group, { cast: false, edges: false });
      box(`${name}背面价签条${level + 1}`, [length, 0.1, 0.035], [0, y + 0.08, -depth / 2 - 0.01], materials.yellow, group, { cast: false, edges: false });

      const count = Math.floor(length / 0.33) - 1;
      for (let side = -1; side <= 1; side += 2) {
        for (let index = 0; index < count; index += 1) {
          if ((index + level + (side > 0 ? 1 : 0)) % 11 === 0 && seeded() > 0.45) continue;
          const px = -length / 2 + 0.3 + index * ((length - 0.6) / Math.max(1, count - 1));
          const material = productMaterials[(index + level * 3 + (side > 0 ? 2 : 0)) % productMaterials.length];
          const height = kind === 'bento' && level < 2 ? 0.2 : 0.26 + seeded() * 0.18;
          const width = 0.18 + seeded() * 0.08;
          const product = box(
            `${kind}商品`,
            [width, height, kind === 'bento' && level < 2 ? 0.29 : 0.18],
            [px, y + 0.08 + height / 2, side * (depth * 0.5 - 0.16)],
            material,
            group,
            { cast: false, receive: false, edges: false },
          );
          product.rotation.y = side < 0 ? Math.PI : 0;
          metrics.products += 1;
        }
      }
    }
    box(`${name}顶部分类板`, [length + 0.06, 0.33, 0.09], [0, topHeight + 0.14, 0], kind === 'snack' ? materials.teal : (kind === 'bento' ? materials.red : materials.blue), group);
  }

  function createDrinkFridges(parent, productMaterials) {
    const fridges = new THREE.Group();
    fridges.name = '后墙饮料冷藏柜';
    parent.add(fridges);
    const startX = -7.75;
    const bayWidth = 1.63;
    for (let bay = 0; bay < 4; bay += 1) {
      const x = startX + bay * (bayWidth + 0.07) + bayWidth / 2;
      box(`饮料柜体${bay + 1}`, [bayWidth, 3.65, 0.55], [x, 2.87, -6.5], materials.frame, fridges);
      const coolGlow = new THREE.MeshBasicMaterial({ color: bay % 2 ? 0xcff6ff : 0xe7fbff, toneMapped: false });
      box(`饮料柜内灯${bay + 1}`, [bayWidth - 0.18, 3.35, 0.035], [x, 2.86, -6.18], coolGlow, fridges, { cast: false, edges: false });
      for (let level = 0; level < 5; level += 1) {
        const y = 1.35 + level * 0.55;
        box('饮料柜层板', [bayWidth - 0.22, 0.035, 0.33], [x, y, -6.07], materials.steel, fridges, { cast: false, edges: false });
        for (let item = 0; item < 6; item += 1) {
          const mat = productMaterials[(bay * 2 + level + item) % productMaterials.length];
          const can = cylinder('饮料瓶罐', 0.075, 0.075, 0.28 + (item % 2) * 0.05, [x - 0.62 + item * 0.245, y + 0.17, -5.99], mat, fridges, { segments: 9, cast: false });
          if ((item + level) % 3 === 0) cylinder('饮料瓶盖', 0.045, 0.045, 0.025, [can.position.x, can.position.y + 0.17, -5.99], materials.white, fridges, { segments: 9, cast: false });
          metrics.products += 1;
        }
      }
      plane(`饮料柜玻璃门${bay + 1}`, bayWidth - 0.12, 3.42, [x, 2.86, -5.87], materials.freezerGlass, fridges);
      box(`饮料柜门框左${bay + 1}`, [0.045, 3.46, 0.05], [x - bayWidth / 2 + 0.08, 2.86, -5.84], materials.frame, fridges, { cast: false, edges: false });
      box(`饮料柜门框右${bay + 1}`, [0.045, 3.46, 0.05], [x + bayWidth / 2 - 0.08, 2.86, -5.84], materials.frame, fridges, { cast: false, edges: false });
      cylinder('饮料柜门把手', 0.025, 0.025, 0.68, [x + bayWidth * 0.3, 2.85, -5.79], materials.steel, fridges, { segments: 8, cast: false });
    }
  }

  function createCheckout(parent, productMaterials) {
    const checkout = new THREE.Group();
    checkout.name = '收银与热食咖啡区';
    parent.add(checkout);

    box('L形收银主柜台', [3.15, 1.05, 0.9], [2.42, 1.48, -0.95], materials.warmWhite, checkout);
    box('收银台品牌色条', [3.17, 0.24, 0.07], [2.42, 1.55, -0.47], materials.teal, checkout, { cast: false, edges: false });
    box('收银机底座', [0.72, 0.18, 0.55], [1.52, 2.12, -0.95], materials.frame, checkout);
    box('收银机屏幕', [0.65, 0.62, 0.12], [1.52, 2.48, -1.05], materials.black, checkout, { rotation: [-0.13, 0, 0] });
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x8fe7d3, toneMapped: false });
    plane('收银机发光屏', 0.48, 0.38, [1.52, 2.5, -0.98], screenMat, checkout, [-0.13, 0, 0]);
    box('条码扫描器', [0.48, 0.08, 0.32], [2.16, 2.05, -0.73], materials.black, checkout, { rotation: [0, 0.1, 0] });

    // Coffee machine with cups and illuminated buttons.
    box('咖啡机主体', [0.76, 1.12, 0.52], [3.28, 2.58, -1.18], materials.frame, checkout);
    plane('咖啡机显示屏', 0.42, 0.24, [3.28, 2.82, -0.905], screenMat.clone(), checkout);
    cylinder('咖啡机出液嘴', 0.035, 0.035, 0.25, [3.28, 2.44, -0.86], materials.steel, checkout, { rotation: [Math.PI / 2, 0, 0], segments: 8 });
    for (let i = 0; i < 4; i += 1) {
      const cup = cylinder('纸咖啡杯', 0.09, 0.07, 0.22, [2.75 + i * 0.22, 2.18, -0.68], productMaterials[(i + 2) % productMaterials.length], checkout, { segments: 14, cast: false });
      cylinder('咖啡杯盖', 0.095, 0.095, 0.025, [cup.position.x, 2.30, -0.68], materials.white, checkout, { segments: 14, cast: false });
      metrics.products += 1;
    }

    // Oden warmer with partitioned broth trays.
    box('关东煮加热台', [1.05, 0.26, 0.62], [0.78, 2.16, -0.91], materials.steel, checkout);
    const brothMat = makePhong(0x9a6848, { specular: 0xffddb0, shininess: 65 });
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        box('关东煮汤格', [0.27, 0.035, 0.22], [0.48 + col * 0.3, 2.315, -1.06 + row * 0.26], brothMat, checkout, { cast: false, edges: false });
        cylinder('关东煮食材', 0.055 + (col % 2) * 0.018, 0.055, 0.08, [0.48 + col * 0.3, 2.37, -1.06 + row * 0.26], productMaterials[(row * 3 + col) % productMaterials.length], checkout, { segments: 10, cast: false });
      }
    }
    box('关东煮透明罩', [1.12, 0.6, 0.66], [0.78, 2.55, -0.91], materials.freezerGlass, checkout, { cast: false, edges: true, edgeOpacity: 0.45 });
  }

  function createMagazineRack(parent, productMaterials) {
    const rack = new THREE.Group();
    rack.name = '临窗杂志架';
    rack.position.set(-7.15, 0, 0.12);
    parent.add(rack);
    box('杂志架底柜', [2.2, 0.72, 0.45], [0, 1.27, 0], materials.frame, rack);
    for (let row = 0; row < 3; row += 1) {
      box(`杂志架层板${row + 1}`, [2.15, 0.055, 0.5], [0, 1.7 + row * 0.52, -0.1 - row * 0.03], materials.warmWhite, rack, { rotation: [-0.25, 0, 0], cast: false });
      for (let item = 0; item < 7; item += 1) {
        const magazine = box('杂志', [0.24, 0.38, 0.025], [-0.87 + item * 0.29, 1.93 + row * 0.52, 0.12], productMaterials[(item + row * 2) % productMaterials.length], rack, { rotation: [-0.08, 0, 0], cast: false, edges: false });
        magazine.position.z += (item % 2) * 0.015;
        metrics.products += 1;
      }
    }
  }

  function createChestFreezer(parent, productMaterials) {
    const freezer = new THREE.Group();
    freezer.name = '冰淇淋卧式冰柜';
    parent.add(freezer);
    box('冰柜主体', [2.0, 0.9, 1.0], [-6.42, 1.38, -5.42], materials.white, freezer);
    box('冰柜品牌色带', [2.02, 0.22, 1.02], [-6.42, 1.42, -5.42], materials.blue, freezer, { cast: false, edges: false });
    const lidA = plane('冰柜玻璃滑盖左', 0.92, 0.9, [-6.9, 1.86, -5.42], materials.freezerGlass, freezer, [-Math.PI / 2, 0, 0]);
    const lidB = plane('冰柜玻璃滑盖右', 0.92, 0.9, [-5.94, 1.86, -5.42], materials.freezerGlass, freezer, [-Math.PI / 2, 0, 0]);
    lidA.position.y += 0.01;
    lidB.position.y += 0.015;
    for (let i = 0; i < 8; i += 1) {
      box('冰淇淋包装', [0.17, 0.11, 0.34], [-7.2 + (i % 4) * 0.42, 1.84, -5.62 + Math.floor(i / 4) * 0.38], productMaterials[(i + 3) % productMaterials.length], freezer, { cast: false, edges: false });
      metrics.products += 1;
    }
  }

  function createFloorGuides(parent) {
    const guideTexture = canvasTexture(512, 256, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(71,176,164,.72)';
      ctx.beginPath();
      ctx.roundRect(6, 18, w - 12, h - 36, 38);
      ctx.fill();
      ctx.fillStyle = '#fffbea';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 52px sans-serif';
      ctx.fillText('入口  →  レジ', w / 2, h / 2);
    });
    plane('店内地面导视一', 2.5, 1.05, [1.8, 1.015, 0.05], labelMaterial(guideTexture, { opacity: 0.83 }), parent, [-Math.PI / 2, 0, 0]);
    plane('店内地面导视二', 2.2, 0.92, [-3.7, 1.018, -0.45], labelMaterial(guideTexture, { opacity: 0.62 }), parent, [-Math.PI / 2, 0, Math.PI]);
  }

  function createStorefront(store) {
    const storefront = new THREE.Group();
    storefront.name = '大面积玻璃橱窗与自动门';
    store.add(storefront);
    const rainTexture = makeGlassRainTexture();
    const rainMaterial = labelMaterial(rainTexture, { opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending });
    animated.glassTextures.push(rainTexture);
    const warmWindowGlow = new THREE.MeshBasicMaterial({
      color: 0xff873d,
      transparent: true,
      opacity: 0.075,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const frontWarmth = plane('正面橱窗内暖光层', 9.28, 4.25, [-3.86, 3.34, 0.985], warmWindowGlow, storefront);
    frontWarmth.renderOrder = 1;
    const doorWarmth = plane('自动门内暖光层', 3.5, 4.1, [2.72, 3.2, 0.99], warmWindowGlow.clone(), storefront);
    doorWarmth.renderOrder = 1;

    const windowY = 3.32;
    const windowHeight = 4.35;
    const paneCenters = [-7.55, -5.45, -3.35, -1.25, 0.28];
    const paneWidths = [1.75, 1.95, 1.95, 1.95, 0.82];
    paneCenters.forEach((x, index) => {
      box(`正面玻璃橱窗${index + 1}`, [paneWidths[index], windowHeight, 0.06], [x, windowY, 1.095], materials.glass, storefront, { cast: false, edges: false });
      plane(`正面玻璃雨痕${index + 1}`, paneWidths[index] - 0.05, windowHeight - 0.08, [x, windowY, 1.135], rainMaterial.clone(), storefront);
    });
    [-8.48, -6.55, -4.4, -2.3, -0.22, 0.78].forEach((x, index) => {
      box(`正面窗框${index + 1}`, [0.09, 4.55, 0.12], [x, 3.34, 1.15], materials.frame, storefront, { cast: false });
    });
    box('正面橱窗下槛', [9.35, 0.22, 0.16], [-3.86, 1.13, 1.15], materials.frame, storefront, { cast: false });

    // Sliding automatic door.
    box('自动门上机箱', [3.8, 0.38, 0.35], [2.72, 5.45, 1.14], materials.frame, storefront);
    box('自动门左门框', [0.12, 4.45, 0.18], [0.86, 3.25, 1.16], materials.frame, storefront);
    box('自动门右门框', [0.12, 4.45, 0.18], [4.57, 3.25, 1.16], materials.frame, storefront);
    const doorLeft = box('自动门左扇', [1.72, 4.05, 0.07], [1.78, 3.16, 1.17], materials.glass.clone(), storefront, { cast: false, edges: true, edgeOpacity: 0.8 });
    const doorRight = box('自动门右扇', [1.72, 4.05, 0.07], [3.66, 3.16, 1.17], materials.glass.clone(), storefront, { cast: false, edges: true, edgeOpacity: 0.8 });
    box('左门中框', [0.08, 4.05, 0.12], [0.84, 0, 0.03], materials.frame, doorLeft, { cast: false, edges: false });
    box('右门中框', [0.08, 4.05, 0.12], [-0.84, 0, 0.03], materials.frame, doorRight, { cast: false, edges: false });
    const doorRainA = plane('自动门左雨痕', 1.62, 3.95, [0, 0, 0.05], rainMaterial.clone(), doorLeft);
    const doorRainB = plane('自动门右雨痕', 1.62, 3.95, [0, 0, 0.05], rainMaterial.clone(), doorRight);
    doorRainA.renderOrder = 4;
    doorRainB.renderOrder = 4;
    animated.doorLeft = doorLeft;
    animated.doorRight = doorRight;
    animated.doorClosedX = [doorLeft.position.x, doorRight.position.x];

    box('门口吸水地垫', [2.5, 0.08, 1.15], [2.72, 0.92, 1.74], materials.black, storefront, { cast: false });
    const matStripe = box('地垫品牌线', [1.8, 0.012, 0.08], [2.72, 0.965, 1.74], materials.teal, storefront, { cast: false, edges: false });
    matStripe.material = materials.teal.clone();

    // Side windows are equally transparent and show the checkout/freezer zone.
    [-1.15, 0.45].forEach((z, index) => {
      const warmth = plane(`右侧窗内暖光层${index + 1}`, 1.42, 4.15, [4.65, 3.35, z], warmWindowGlow.clone(), storefront, [0, Math.PI / 2, 0]);
      warmth.renderOrder = 1;
      plane(`右侧玻璃窗${index + 1}`, 1.48, 4.25, [4.72, 3.35, z], materials.glass, storefront, [0, Math.PI / 2, 0]);
      plane(`右侧玻璃雨痕${index + 1}`, 1.42, 4.15, [4.755, 3.35, z], rainMaterial.clone(), storefront, [0, Math.PI / 2, 0]);
    });
    [-2.0, -0.3, 1.2].forEach((z, index) => box(`右侧窗框${index + 1}`, [0.13, 4.55, 0.09], [4.76, 3.34, z], materials.frame, storefront, { cast: false }));

    // Window posters and door stickers.
    const posterA = makePosterTexture('あったか', '冬のおでん', ['#e76168', '#f2a14b']);
    const posterB = makePosterTexture('雨の日', 'Coffee 20円引', ['#4d9fc1', '#6ac3aa']);
    plane('橱窗关东煮海报', 0.82, 1.2, [-0.95, 2.55, 1.18], labelMaterial(posterA, { opacity: 0.95 }), storefront);
    plane('橱窗咖啡海报', 0.82, 1.2, [-7.55, 2.65, 1.18], labelMaterial(posterB, { opacity: 0.95 }), storefront);
    const doorSticker = canvasTexture(256, 128, (ctx, w, h) => {
      ctx.fillStyle = '#fffbea';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#4bafa4';
      ctx.font = '900 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('自動ドア', w / 2, h / 2);
    });
    plane('自动门提示贴', 0.64, 0.3, [0, 0.3, 0.06], labelMaterial(doorSticker), doorLeft);
  }

  function createCanopy(store) {
    const canopy = new THREE.Group();
    canopy.name = '屋檐雨棚与发光招牌';
    store.add(canopy);
    box('正面屋檐雨棚', [13.85, 0.28, 1.58], [-2.0, 5.52, 1.82], materials.roof, canopy, { darkEdges: true });
    box('雨棚前缘青色带', [13.9, 0.22, 0.08], [-2.0, 5.55, 2.63], materials.teal, canopy, { cast: false, edges: false });
    box('雨棚前缘红色带', [13.9, 0.08, 0.09], [-2.0, 5.39, 2.64], materials.red, canopy, { cast: false, edges: false });

    const signMaterial = labelMaterial(makeSignTexture(false), { opacity: 0.98 });
    plane('便利店正面发光招牌', 11.95, 1.02, [-2.15, 6.17, 1.295], signMaterial, canopy);
    animated.signMaterials.push(signMaterial);
    const sideSignMaterial = labelMaterial(makeSignTexture(true), { opacity: 0.98 });
    plane('便利店侧面发光招牌', 1.05, 1.05, [4.92, 6.15, -3.25], sideSignMaterial, canopy, [0, Math.PI / 2, 0]);
    animated.signMaterials.push(sideSignMaterial);

    const soffitMat = new THREE.MeshBasicMaterial({ color: 0xffe6b6, toneMapped: false });
    for (let i = 0; i < 5; i += 1) {
      box(`雨棚暖光灯${i + 1}`, [1.15, 0.025, 0.25], [-7.5 + i * 2.75, 5.36, 2.04], soffitMat, canopy, { cast: false, edges: false });
    }
    const canopyLight = new THREE.PointLight(0xffa54e, 1.06, 8.5, 1.8);
    canopyLight.position.set(-1.7, 5.12, 2.05);
    canopy.add(canopyLight);
    metrics.lightSources += 1;
  }

  function createStreetDetails() {
    createVendingMachine();
    createBicycle();
    createUmbrellaRack();
    createTrashBins();
    createStreetLamp();
    createUtilityPole();
    createPowerLines();
    createRoadSigns();
    createGuardrails();
    createAlleyAndServiceArea();
    createTrafficSignal();
  }

  function createVendingMachine() {
    const machine = new THREE.Group();
    machine.name = '侧墙发光自动贩卖机';
    machine.position.set(5.36, 0, -4.6);
    machine.rotation.y = Math.PI / 2;
    world.add(machine);
    box('贩卖机主体', [1.25, 2.8, 0.98], [0, 2.16, 0], materials.white, machine, { darkEdges: true });
    box('贩卖机顶灯箱框', [1.08, 0.48, 0.06], [0, 3.15, 0.52], materials.frame, machine);
    const vendingTitle = canvasTexture(512, 160, (ctx, w, h) => {
      const gradient = ctx.createLinearGradient(0, 0, w, 0);
      gradient.addColorStop(0, '#5ab5d0');
      gradient.addColorStop(1, '#66c2a9');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.font = '900 60px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DRINKS 24h', w / 2, h / 2);
    });
    const vendingTitleMat = labelMaterial(vendingTitle, { opacity: 0.96 });
    plane('贩卖机发光灯箱', 0.96, 0.36, [0, 3.15, 0.556], vendingTitleMat, machine);
    animated.signMaterials.push(vendingTitleMat);

    const displayGlow = new THREE.MeshBasicMaterial({ color: 0xdaf8ff, toneMapped: false });
    box('贩卖机商品橱窗', [1.04, 1.18, 0.06], [0, 2.25, 0.53], displayGlow, machine, { cast: false, edges: false });
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const palette = [materials.red, materials.blue, materials.green, materials.orange, materials.teal];
        cylinder('贩卖机饮料样品', 0.06, 0.06, 0.23, [-0.4 + col * 0.2, 1.92 + row * 0.35, 0.58], palette[(row + col) % palette.length], machine, { segments: 9, cast: false });
        box('贩卖机价格按钮', [0.15, 0.035, 0.025], [-0.4 + col * 0.2, 1.76 + row * 0.35, 0.585], materials.yellow, machine, { cast: false, edges: false });
        metrics.products += 1;
      }
    }
    box('贩卖机支付面板', [0.36, 0.58, 0.08], [0.31, 1.24, 0.54], materials.frame, machine);
    plane('贩卖机支付屏', 0.2, 0.13, [0.31, 1.38, 0.59], new THREE.MeshBasicMaterial({ color: 0x74e0c4, toneMapped: false }), machine);
    box('贩卖机取货口', [0.55, 0.25, 0.09], [-0.18, 1.12, 0.54], materials.black, machine);
    const vendingLight = new THREE.PointLight(0x9de8ff, 0.55, 5.5, 1.8);
    vendingLight.position.set(0, 2.2, 1.0);
    machine.add(vendingLight);
    metrics.lightSources += 1;
  }

  function createBicycle() {
    const bicycle = new THREE.Group();
    bicycle.name = '停在门外的城市自行车';
    bicycle.position.set(-6.55, 0.76, 2.05);
    bicycle.rotation.y = -0.08;
    world.add(bicycle);
    const tireMat = makeToon(0x11151d);
    const rimMat = makeToon(0x9aadb4);
    [-0.92, 0.92].forEach((x, wheelIndex) => {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.055, 8, 24), tireMat);
      tire.name = `自行车轮胎${wheelIndex + 1}`;
      tire.position.set(x, 0.62, 0);
      bicycle.add(tire);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.018, 6, 24), rimMat);
      rim.position.copy(tire.position);
      bicycle.add(rim);
      for (let spoke = 0; spoke < 8; spoke += 1) {
        const angle = spoke / 8 * TAU;
        tubeBetween('自行车辐条', [x, 0.62, 0], [x + Math.cos(angle) * 0.39, 0.62 + Math.sin(angle) * 0.39, 0], 0.008, rimMat, bicycle, 5);
      }
      metrics.meshes += 2;
    });
    const frameMat = makeToon(0x5ca8a4);
    tubeBetween('自行车下管', [-0.78, 0.68, 0], [0.05, 1.12, 0], 0.04, frameMat, bicycle);
    tubeBetween('自行车座管', [0.05, 1.12, 0], [0.4, 0.68, 0], 0.04, frameMat, bicycle);
    tubeBetween('自行车底管', [-0.78, 0.68, 0], [0.4, 0.68, 0], 0.04, frameMat, bicycle);
    tubeBetween('自行车上管', [-0.42, 1.15, 0], [0.05, 1.12, 0], 0.04, frameMat, bicycle);
    tubeBetween('自行车后撑', [-0.78, 0.68, 0], [-0.42, 1.15, 0], 0.035, frameMat, bicycle);
    tubeBetween('自行车前叉', [0.92, 0.62, 0], [0.46, 1.35, 0], 0.035, frameMat, bicycle);
    tubeBetween('自行车车把杆', [0.46, 1.35, 0], [0.42, 1.57, 0], 0.03, rimMat, bicycle);
    tubeBetween('自行车车把', [0.29, 1.57, -0.16], [0.55, 1.57, 0.16], 0.025, rimMat, bicycle);
    box('自行车坐垫', [0.36, 0.08, 0.18], [-0.43, 1.28, 0], materials.black, bicycle, { rotation: [0, 0, -0.06] });
    box('自行车前筐', [0.5, 0.34, 0.42], [0.72, 1.32, 0], materials.steel, bicycle, { edges: true, edgeOpacity: 0.55 });
    tubeBetween('自行车脚撑', [-0.15, 0.66, 0.03], [-0.3, 0.05, 0.24], 0.018, materials.frame, bicycle, 6);
  }

  function createUmbrellaRack() {
    const rack = new THREE.Group();
    rack.name = '门口雨伞架';
    rack.position.set(0.05, 0, 2.05);
    world.add(rack);
    box('雨伞架底座', [1.1, 0.12, 0.46], [0, 0.88, 0], materials.steel, rack);
    box('雨伞架上框', [1.1, 0.1, 0.46], [0, 1.52, 0], materials.steel, rack);
    for (let index = 0; index < 5; index += 1) {
      const x = -0.4 + index * 0.2;
      const color = [materials.blue, materials.yellow, materials.red, materials.teal, materials.warmWhite][index];
      tubeBetween('长柄雨伞杆', [x, 0.86, 0], [x + (index % 2 ? 0.05 : -0.03), 1.93 - index * 0.035, 0], 0.018, materials.steel, rack, 6);
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.33, 8, 1, true), color);
      canopy.name = '收拢雨伞布';
      canopy.position.set(x + (index % 2 ? 0.05 : -0.03), 1.18, 0);
      canopy.rotation.z = Math.PI;
      rack.add(canopy);
      metrics.meshes += 1;
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 6, 12, Math.PI), materials.steel);
      handle.position.set(x + 0.09, 1.92 - index * 0.035, 0);
      handle.rotation.z = Math.PI;
      rack.add(handle);
      metrics.meshes += 1;
    }
  }

  function createTrashBins() {
    const bins = new THREE.Group();
    bins.name = '分类垃圾桶';
    bins.position.set(4.95, 0, -0.95);
    world.add(bins);
    const colors = [materials.teal, materials.orange];
    for (let i = 0; i < 2; i += 1) {
      box(`分类垃圾桶${i + 1}`, [0.58, 1.08, 0.52], [0, 1.36, i * 0.64], colors[i], bins);
      box(`垃圾桶投口${i + 1}`, [0.38, 0.15, 0.08], [0.01, 1.6, i * 0.64 + 0.27], materials.black, bins, { cast: false });
      const label = canvasTexture(160, 96, (ctx, w, h) => {
        ctx.fillStyle = '#fffbe4';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#253b4a';
        ctx.font = '800 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i === 0 ? 'PET' : '一般', w / 2, h / 2);
      });
      plane(`垃圾分类标识${i + 1}`, 0.35, 0.22, [0, 1.25, i * 0.64 + 0.265], labelMaterial(label), bins);
    }
  }

  function createStreetLamp() {
    const lamp = new THREE.Group();
    lamp.name = '暖光社区路灯';
    lamp.position.set(-9.65, 0, 4.05);
    world.add(lamp);
    cylinder('路灯基座', 0.35, 0.42, 0.35, [0, 0.78, 0], materials.frame, lamp, { segments: 12, edges: true });
    cylinder('路灯杆', 0.085, 0.12, 6.5, [0, 4.0, 0], materials.frame, lamp, { segments: 12, edges: true });
    tubeBetween('路灯弯臂', [0, 7.05, 0], [0.72, 7.05, 0], 0.07, materials.frame, lamp, 10);
    box('路灯灯罩', [0.78, 0.28, 0.52], [0.78, 6.9, 0], materials.roof, lamp, { rotation: [0, 0, -0.08] });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd79a, toneMapped: false });
    box('路灯发光面', [0.58, 0.05, 0.35], [0.79, 6.74, 0], bulbMat, lamp, { cast: false, edges: false });
    const light = new THREE.PointLight(0xffbd72, 1.15, 10, 1.72);
    light.position.set(0.78, 6.65, 0);
    lamp.add(light);
    metrics.lightSources += 1;
  }

  function createUtilityPole() {
    const pole = new THREE.Group();
    pole.name = '街角电线杆';
    pole.position.set(9.15, 0, -8.45);
    world.add(pole);
    cylinder('电线杆水泥柱', 0.16, 0.23, 9.0, [0, 5.05, 0], makeToon(0x626c73), pole, { segments: 14, edges: true });
    box('电线杆横担一', [2.1, 0.16, 0.15], [0, 8.55, 0], materials.brown, pole);
    box('电线杆横担二', [1.45, 0.14, 0.14], [0, 7.9, 0], materials.brown, pole);
    [-0.86, 0, 0.86].forEach((x, index) => {
      cylinder(`电线绝缘子${index + 1}`, 0.08, 0.1, 0.32, [x, 8.83, 0], materials.warmWhite, pole, { segments: 10, edges: true });
    });
    cylinder('柱上变压器', 0.42, 0.42, 1.0, [0.0, 7.05, 0.3], materials.steel, pole, { segments: 16, edges: true });
    box('电线杆编号牌', [0.38, 0.52, 0.06], [0.18, 4.9, 0.2], materials.yellow, pole, { rotation: [0, 0.18, 0], cast: false });
  }

  function createCable(name, points, radius = 0.028) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, radius, 5, false), makeToon(0x10151d));
    mesh.name = name;
    mesh.castShadow = true;
    world.add(mesh);
    metrics.meshes += 1;
    animated.hangingCables.push(mesh);
    return mesh;
  }

  function createPowerLines() {
    for (let lane = -1; lane <= 1; lane += 1) {
      const offset = lane * 0.42;
      createCable(`主电线${lane + 2}`, [
        [9.15 + offset, 8.84, -8.45],
        [5.0 + offset * 0.45, 7.95 - Math.abs(lane) * 0.08, -6.8],
        [0.8 + offset * 0.15, 8.25, -7.1],
        [-4.8 + offset * 0.2, 7.85, -6.4],
        [-10.1 + offset, 8.2, -7.8],
      ], 0.025);
    }
    createCable('便利店引入线一', [[9.15, 7.92, -8.45], [7.0, 6.95, -6.7], [4.75, 6.82, -5.3]], 0.022);
    createCable('便利店引入线二', [[9.35, 7.9, -8.45], [7.1, 6.8, -6.4], [4.76, 6.65, -4.95]], 0.022);
  }

  function createRoadSigns() {
    const signs = new THREE.Group();
    signs.name = '街道路牌组';
    signs.position.set(6.0, 0, 2.15);
    world.add(signs);
    cylinder('路牌杆', 0.065, 0.08, 3.8, [0, 2.7, 0], materials.steel, signs, { segments: 10, edges: true });
    const streetTexture = canvasTexture(512, 180, (ctx, w, h) => {
      ctx.fillStyle = '#315f82';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#edf8ff';
      ctx.lineWidth = 12;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = '#fff';
      ctx.font = '900 56px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('星見町 七丁目', w / 2, h / 2);
    });
    plane('蓝色街道路牌', 2.25, 0.78, [0, 4.15, 0.06], labelMaterial(streetTexture), signs);

    const stopTexture = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#e6535f';
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const angle = -Math.PI / 8 + i * Math.PI / 4;
        const x = w / 2 + Math.cos(angle) * w * 0.44;
        const y = h / 2 + Math.sin(angle) * h * 0.44;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 11;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '900 58px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('止まれ', w / 2, h / 2);
    });
    plane('日式停车标志', 1.05, 1.05, [0, 3.15, 0.07], labelMaterial(stopTexture), signs);
  }

  function createGuardrails() {
    const rail = new THREE.Group();
    rail.name = '街角白色护栏';
    world.add(rail);
    const points = [[4.15, 2.62], [4.85, 2.62], [5.55, 2.62], [5.92, 2.1], [5.92, 1.38], [5.92, 0.66]];
    points.forEach((point, index) => {
      cylinder(`护栏立柱${index + 1}`, 0.055, 0.065, 1.0, [point[0], 1.28, point[1]], materials.guard, rail, { segments: 10, edges: true });
      cylinder(`护栏脚座${index + 1}`, 0.16, 0.2, 0.08, [point[0], 0.81, point[1]], materials.guard, rail, { segments: 10 });
    });
    for (let i = 0; i < 2; i += 1) {
      tubeBetween('前街护栏横杆', [4.15, 1.5 - i * 0.42, 2.62], [5.55, 1.5 - i * 0.42, 2.62], 0.045, materials.guard, rail, 10);
      tubeBetween('侧街护栏横杆', [5.92, 1.5 - i * 0.42, 2.1], [5.92, 1.5 - i * 0.42, 0.66], 0.045, materials.guard, rail, 10);
    }
  }

  function createAlleyAndServiceArea() {
    const alley = new THREE.Group();
    alley.name = '便利店左侧小巷与后勤区域';
    world.add(alley);
    box('小巷湿地', [2.3, 0.12, 8.2], [-10.02, 0.62, -3.0], makePhong(0x1c2b35, { specular: 0x8db9c2, shininess: 78 }), alley, { cast: false });
    box('小巷边界矮墙', [0.3, 3.4, 8.4], [-11.35, 2.25, -3.1], makeToon(0x3d4752), alley);
    box('小巷入口横梁', [2.4, 0.28, 0.24], [-10.02, 4.15, 0.88], materials.frame, alley);
    tubeBetween('小巷入口左柱', [-11.12, 0.76, 0.88], [-11.12, 4.15, 0.88], 0.065, materials.frame, alley, 10);
    tubeBetween('小巷入口右柱', [-8.92, 0.76, 0.88], [-8.92, 4.15, 0.88], 0.065, materials.frame, alley, 10);
    const alleySign = canvasTexture(480, 128, (ctx, w, h) => {
      ctx.fillStyle = '#20364b';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c8eef0';
      ctx.font = '800 46px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('星見町  路地裏', w / 2, h / 2);
    });
    plane('小巷入口牌', 1.85, 0.48, [-10.02, 4.13, 1.02], labelMaterial(alleySign, { opacity: 0.86 }), alley);

    // Outdoor AC units attached to the store side wall.
    [-4.5, -6.0].forEach((z, index) => {
      box(`空调外机${index + 1}`, [0.52, 1.05, 1.3], [-8.98, 1.48, z], materials.wallShadow, alley);
      const fan = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 8, 24), materials.frame);
      fan.name = `空调风扇圈${index + 1}`;
      fan.position.set(-9.27, 1.49, z);
      fan.rotation.y = Math.PI / 2;
      alley.add(fan);
      metrics.meshes += 1;
      for (let blade = 0; blade < 4; blade += 1) {
        const angle = blade * Math.PI / 2;
        const mesh = box('空调风扇叶片', [0.035, 0.34, 0.12], [-9.31, 1.49, z], materials.steel, alley, { rotation: [angle, 0, 0], cast: false, edges: false });
        mesh.rotation.x = angle;
      }
      box('空调支架', [0.75, 0.08, 1.5], [-9.0, 0.9, z], materials.steel, alley);
    });

    // Notice and poster board on the alley boundary.
    box('社区公告栏框', [0.12, 2.05, 2.45], [-11.16, 2.35, -1.45], materials.brown, alley);
    const noticeTexture = canvasTexture(512, 420, (ctx, w, h) => {
      ctx.fillStyle = '#d6c7a8';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff9e7';
      const notes = [
        [25, 28, 205, 150, '#4f84a2'], [266, 38, 216, 120, '#d56767'],
        [48, 212, 172, 172, '#5a9b78'], [250, 190, 218, 190, '#c28a4b'],
      ];
      notes.forEach((note, index) => {
        ctx.fillStyle = note[4];
        ctx.fillRect(note[0], note[1], note[2], 16);
        ctx.fillStyle = '#fffaf0';
        ctx.fillRect(note[0], note[1] + 16, note[2], note[3] - 16);
        ctx.fillStyle = '#344958';
        ctx.font = '700 23px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(['夏祭り', 'ごみの日', '迷い猫', '町内会'][index], note[0] + note[2] / 2, note[1] + 58);
        for (let line = 0; line < 3; line += 1) ctx.fillRect(note[0] + 26, note[1] + 82 + line * 20, note[2] - 52, 4);
      });
    });
    plane('社区公告海报', 2.18, 1.78, [-11.09, 2.35, -1.45], labelMaterial(noticeTexture), alley, [0, Math.PI / 2, 0]);

    // Crates and a small service light enrich the alley depth.
    box('饮料周转箱一', [0.82, 0.48, 0.62], [-10.25, 1.02, -6.1], materials.blue, alley);
    box('饮料周转箱二', [0.82, 0.48, 0.62], [-10.25, 1.52, -6.1], materials.teal, alley);
    box('小巷壁灯罩', [0.45, 0.28, 0.38], [-9.0, 3.5, -3.1], materials.roof, alley);
    const alleyBulb = new THREE.MeshBasicMaterial({ color: 0xffcf8c, toneMapped: false });
    box('小巷壁灯', [0.28, 0.12, 0.22], [-9.22, 3.39, -3.1], alleyBulb, alley, { cast: false, edges: false });
    const light = new THREE.PointLight(0xffb968, 0.55, 5, 1.9);
    light.position.set(-9.35, 3.25, -3.1);
    alley.add(light);
    metrics.lightSources += 1;
  }

  function createTrafficSignal() {
    const signal = new THREE.Group();
    signal.name = '远端微弱交通信号灯';
    signal.position.set(10.35, 0, -1.75);
    world.add(signal);
    cylinder('信号灯杆', 0.075, 0.1, 5.0, [0, 3.25, 0], materials.frame, signal, { segments: 10, edges: true });
    tubeBetween('信号灯横臂', [0, 5.45, 0], [-1.6, 5.45, 0], 0.065, materials.frame, signal, 10);
    box('信号灯箱', [0.62, 1.72, 0.45], [-1.58, 4.75, 0], materials.black, signal, { darkEdges: true });
    const lampSpecs = [
      { key: 'red', y: 5.23, color: 0xef5a65 },
      { key: 'yellow', y: 4.75, color: 0xf0c755 },
      { key: 'green', y: 4.27, color: 0x5fc98a },
    ];
    lampSpecs.forEach((spec) => {
      const material = new THREE.MeshPhongMaterial({ color: spec.color, emissive: spec.color, emissiveIntensity: 0.1, shininess: 110, toneMapped: false });
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10, 0, TAU, 0, Math.PI / 2), material);
      lens.name = `交通灯${spec.key}`;
      lens.position.set(-1.58, spec.y, 0.25);
      lens.rotation.x = Math.PI / 2;
      signal.add(lens);
      metrics.meshes += 1;
      animated.trafficLamps[spec.key] = material;
    });
  }

  function createRainSystem() {
    const dropCount = isCompact ? 620 : 1020;
    const positions = new Float32Array(dropCount * 2 * 3);
    const speeds = new Float32Array(dropCount);
    const lengths = new Float32Array(dropCount);
    for (let index = 0; index < dropCount; index += 1) {
      const x = -12 + seeded() * 24;
      const y = 0.7 + seeded() * 15;
      const z = -12 + seeded() * 24;
      const length = 0.28 + seeded() * 0.62;
      const offset = index * 6;
      positions[offset] = x;
      positions[offset + 1] = y;
      positions[offset + 2] = z;
      positions[offset + 3] = x + 0.09;
      positions[offset + 4] = y - length;
      positions[offset + 5] = z + 0.035;
      speeds[index] = 8.5 + seeded() * 8.0;
      lengths[index] = length;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: 0xb7d8e8,
      transparent: true,
      opacity: reducedMotion ? 0.14 : 0.27,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const rain = new THREE.LineSegments(geometry, material);
    rain.name = '持续降雨';
    rain.frustumCulled = false;
    rain.renderOrder = 8;
    rain.userData.speeds = speeds;
    rain.userData.lengths = lengths;
    world.add(rain);
    animated.rain = rain;
    metrics.rainDrops = dropCount;
    return rain;
  }

  function createRoofDrips() {
    const dripCount = 38;
    const positions = new Float32Array(dripCount * 2 * 3);
    const phases = new Float32Array(dripCount);
    const anchors = [];
    for (let index = 0; index < dripCount; index += 1) {
      let x;
      let z;
      if (index < 28) {
        x = -8.75 + index * (13.5 / 27);
        z = 2.68;
      } else {
        x = 4.92;
        z = 0.8 - (index - 28) * 0.78;
      }
      anchors.push([x, z]);
      phases[index] = seeded();
      const offset = index * 6;
      positions[offset] = x;
      positions[offset + 1] = 5.34;
      positions[offset + 2] = z;
      positions[offset + 3] = x + 0.02;
      positions[offset + 4] = 5.1;
      positions[offset + 5] = z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const drips = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
      color: 0xcbeaf4,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    drips.name = '屋檐滴水';
    drips.userData.anchors = anchors;
    drips.userData.phases = phases;
    drips.renderOrder = 9;
    world.add(drips);
    animated.roofDrips = drips;
    metrics.roofDrips = dripCount;
    return drips;
  }

  function createPuddleRipples() {
    const positions = [
      [-5.8, 4.25], [-4.7, 4.0], [-2.2, 4.75], [-1.55, 4.45], [2.15, 5.4],
      [2.85, 5.02], [8.2, -1.3], [8.65, -0.3], [9.25, -5.5], [8.75, -6.2],
      [4.65, 9.15], [5.55, 9.3], [7.6, 4.7], [9.3, 6.2], [-8.1, 8.7],
      [-10.05, -2.3], [-9.9, -4.9], [0.1, 8.1], [3.4, 9.0], [6.9, -8.1],
    ];
    positions.forEach((position, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 4 === 0 ? 0xbfefff : 0x78b5c7,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.9, 28), material);
      ring.name = `积水雨滴波纹${index + 1}`;
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(position[0], 0.648 + index * 0.0003, position[1]);
      ring.scale.setScalar(0.05);
      ring.userData.phase = seeded();
      ring.userData.speed = 0.28 + seeded() * 0.3;
      ring.userData.maxScale = 0.32 + seeded() * 0.42;
      world.add(ring);
      animated.ripples.push(ring);
      metrics.meshes += 1;
    });
    metrics.puddleRipples = animated.ripples.length;
  }

  function updateRain(dt) {
    if (!animated.rain) return;
    const positions = animated.rain.geometry.attributes.position.array;
    const speeds = animated.rain.userData.speeds;
    const lengths = animated.rain.userData.lengths;
    const motionScale = reducedMotion ? 0.2 : 1;
    for (let index = 0; index < speeds.length; index += 1) {
      const offset = index * 6;
      let y = positions[offset + 1] - speeds[index] * dt * motionScale;
      let x = positions[offset] + dt * 0.55 * motionScale;
      if (y < 0.64) {
        y = 13 + seeded() * 4;
        x = -12 + seeded() * 24;
        positions[offset + 2] = -12 + seeded() * 24;
      }
      if (x > 12) x = -12;
      positions[offset] = x;
      positions[offset + 1] = y;
      positions[offset + 3] = x + 0.09;
      positions[offset + 4] = y - lengths[index];
      positions[offset + 5] = positions[offset + 2] + 0.035;
    }
    animated.rain.geometry.attributes.position.needsUpdate = true;
  }

  function updateRoofDrips(time) {
    if (!animated.roofDrips) return;
    const positions = animated.roofDrips.geometry.attributes.position.array;
    const phases = animated.roofDrips.userData.phases;
    const anchors = animated.roofDrips.userData.anchors;
    for (let index = 0; index < phases.length; index += 1) {
      const phase = (time * (0.72 + (index % 5) * 0.09) + phases[index]) % 1;
      const y = 5.32 - phase * 1.15;
      const visibleLength = 0.08 + (1 - phase) * 0.26;
      const offset = index * 6;
      positions[offset] = anchors[index][0];
      positions[offset + 1] = y;
      positions[offset + 2] = anchors[index][1];
      positions[offset + 3] = anchors[index][0] + 0.02;
      positions[offset + 4] = y - visibleLength;
      positions[offset + 5] = anchors[index][1];
    }
    animated.roofDrips.geometry.attributes.position.needsUpdate = true;
  }

  function updateRipples(time) {
    animated.ripples.forEach((ring) => {
      const phase = (time * ring.userData.speed + ring.userData.phase) % 1;
      const eased = smoothstep(phase);
      const scale = 0.06 + eased * ring.userData.maxScale;
      ring.scale.setScalar(scale);
      ring.material.opacity = Math.sin(phase * Math.PI) * (reducedMotion ? 0.08 : 0.25);
    });
  }

  function animateAutomaticDoor(time) {
    if (!animated.doorLeft || !animated.doorRight) return 0;
    let amount = 0;
    if (!reducedMotion) {
      const cycle = time % 16;
      if (cycle >= 6 && cycle < 7.25) amount = smoothstep((cycle - 6) / 1.25);
      else if (cycle >= 7.25 && cycle < 10.1) amount = 1;
      else if (cycle >= 10.1 && cycle < 11.35) amount = 1 - smoothstep((cycle - 10.1) / 1.25);
    }
    animated.doorLeft.position.x = animated.doorClosedX[0] - amount * 0.79;
    animated.doorRight.position.x = animated.doorClosedX[1] + amount * 0.79;
    return amount;
  }

  function updateLightAnimations(time) {
    const rareDip = Math.pow(Math.max(0, Math.sin(time * 7.7) - 0.985) / 0.015, 2);
    animated.signMaterials.forEach((material, index) => {
      const gentlePulse = Math.sin(time * (1.4 + index * 0.19) + index) * 0.012;
      material.opacity = reducedMotion ? 0.96 : 0.965 + gentlePulse - rareDip * (index === 0 ? 0.1 : 0.045);
    });

    animated.glassTextures.forEach((texture, index) => {
      texture.offset.y = -(time * (reducedMotion ? 0.004 : 0.018) + index * 0.13) % 1;
    });

    animated.reflectionPlanes.forEach((mesh, index) => {
      if (mesh.material.userData.reflectionBase === undefined) {
        mesh.material.userData.reflectionBase = mesh.material.opacity;
      }
      const base = mesh.material.userData.reflectionBase;
      mesh.material.opacity = base * (0.94 + Math.sin(time * 1.7 + index * 0.8) * (reducedMotion ? 0.01 : 0.06));
    });

    const cycle = time % 18;
    const active = cycle < 7.2 ? 'green' : (cycle < 9 ? 'yellow' : 'red');
    Object.entries(animated.trafficLamps).forEach(([key, material]) => {
      material.emissiveIntensity = key === active ? 1.85 : 0.035;
      material.opacity = key === active ? 1 : 0.45;
    });
    return active;
  }

  createLighting();
  createBaseAndRoad();
  createConvenienceStore();
  createStreetDetails();
  createRainSystem();
  createRoofDrips();
  createPuddleRipples();

  scene.updateMatrixWorld(true);
  metrics.sceneObjects = (() => {
    let count = 0;
    scene.traverse(() => { count += 1; });
    return count;
  })();
  renderer.domElement.dataset.sceneReady = 'true';
  renderer.domElement.dataset.people = '0';
  renderer.domElement.dataset.visibleUi = '0';
  renderer.domElement.dataset.rainDrops = String(metrics.rainDrops);
  renderer.domElement.dataset.products = String(metrics.products);
  renderer.domElement.dataset.sceneObjects = String(metrics.sceneObjects);

  const clock = new THREE.Clock();
  let elapsed = 0;
  let renderedFrames = 0;
  let currentSignal = 'green';
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    controls.update(dt);
    updateRain(dt);
    updateRoofDrips(elapsed * (reducedMotion ? 0.22 : 1));
    updateRipples(elapsed * (reducedMotion ? 0.22 : 1));
    animateAutomaticDoor(elapsed);
    currentSignal = updateLightAnimations(elapsed);
    renderer.render(scene, camera);
    renderedFrames += 1;
    if (renderedFrames % 10 === 0) {
      renderer.domElement.dataset.renderedFrames = String(renderedFrames);
      renderer.domElement.dataset.camera = camera.position.toArray().map((value) => value.toFixed(3)).join(',');
      renderer.domElement.dataset.cameraDistance = camera.position.distanceTo(controls.target).toFixed(3);
      renderer.domElement.dataset.doorOpen = animateAutomaticDoor(elapsed).toFixed(3);
      renderer.domElement.dataset.trafficSignal = currentSignal;
    }
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = camera.aspect < 0.72 ? 58 : 39;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Math.min(window.innerWidth, window.innerHeight) < 640 ? 1.35 : 1.7));
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  window.__RAINY_KONBINI__ = {
    ready: true,
    version: '1.0.0',
    offline: true,
    visibleUIElements: 0,
    people: 0,
    reducedMotion,
    metrics,
    getState: () => ({
      renderedFrames,
      elapsedSeconds: Number(elapsed.toFixed(2)),
      cameraDistance: Number(camera.position.distanceTo(controls.target).toFixed(2)),
      cameraTarget: controls.target.toArray().map((value) => Number(value.toFixed(2))),
      automaticDoorOpenAmount: Number(animateAutomaticDoor(elapsed).toFixed(3)),
      trafficSignal: currentSignal,
      rendererSize: renderer.getSize(new THREE.Vector2()).toArray(),
      pixelRatio: renderer.getPixelRatio(),
    }),
  };

  animate();
})();
