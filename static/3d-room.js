/**
 * 3D Room — Three.js параметрическая комната для Interio
 */
const Room3D = (() => {
    let scene, camera, renderer, controls, raycaster, mouse, tooltip;
    let roomGroup, furnitureGroup, interactables = [];
    let currentParams = {};

    const STYLES = {
        'Современный': { wall: 0xf0f0f0, floor: 0x8B7355, accent: 0x4a6cf7 },
        'Минимализм': { wall: 0xffffff, floor: 0xd4c5a9, accent: 0x333333 },
        'Скандинавский': { wall: 0xfaf8f5, floor: 0xc4a882, accent: 0x6b8e5a },
        'Классический': { wall: 0xf5e6d3, floor: 0x6b4226, accent: 0x8b0000 },
        'Лофт': { wall: 0x8b7355, floor: 0x555555, accent: 0xff6600 },
        'Японский': { wall: 0xf0ead6, floor: 0xc8b89a, accent: 0x2d5016 },
        'Арт-деко': { wall: 0x1a1a2e, floor: 0x2d2d2d, accent: 0xffd700 },
    };
    const COLORS = {
        'Белый': { w: 0xffffff, f: 0xf5f5f5 }, 'Тёмный': { w: 0x333333, f: 0x222222 },
        'Деревянный': { w: 0xd4a574, f: 0x8b6914 }, 'Синий': { w: 0x4a6fa5, f: 0x3a5f8a },
        'Зелёный': { w: 0x6b8e5a, f: 0x4a6f3a }, 'Жёлтый': { w: 0xf0e68c, f: 0xd4c5a9 },
        'Розовый': { w: 0xf0b0c0, f: 0xe0a0b0 }, 'Разноцветный': { w: 0x7eb8b8, f: 0xb87eb8 }
    };
    const BUDGET = { 'До 500 000 ₽': 1, '500 000 – 1 000 000 ₽': 2, '1 000 000 – 2 000 000 ₽': 3, 'От 2 000 000 ₽': 4, 'Пока не знаю': 2 };
    const ZONES = {
        'Кухня': ['counter','fridge'], 'Гостиная': ['sofa','tv'], 'Спальня': ['bed','nightstand'],
        'Детская': ['bed_kids','desk'], 'Санузел': ['bathtub','sink'], 'Прихожая': ['wardrobe','mirror'],
        'Кабинет': ['desk','bookshelf'], 'Гардеробная': ['wardrobe_big'], 'Балкон / лоджия': ['plant','chair'],
        'Всё помещение': ['sofa','bed','counter','desk']
    };

    function init(container) {
        if (!container) return;
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);
        camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(5, 4, 6); camera.lookAt(0, 1, 0);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.dampingFactor = 0.05;
        controls.maxPolarAngle = Math.PI / 2.1; controls.minDistance = 3; controls.maxDistance = 12;
        scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(5, 8, 3); dl.castShadow = true;
        dl.shadow.mapSize.set(2048, 2048); scene.add(dl);
        scene.add(new THREE.PointLight(0x4a6cf7, 0.3).translateX(-3).translateY(3).translateZ(-2));
        roomGroup = new THREE.Group(); furnitureGroup = new THREE.Group();
        scene.add(roomGroup); scene.add(furnitureGroup);
        raycaster = new THREE.Raycaster(); mouse = new THREE.Vector2();
        tooltip = document.createElement('div');
        tooltip.style.cssText = 'position:absolute;display:none;background:rgba(0,0,0,0.85);color:#fff;padding:8px 12px;border-radius:8px;font-size:13px;pointer-events:none;z-index:1000;max-width:200px;';
        container.style.position = 'relative'; container.appendChild(tooltip);
        renderer.domElement.addEventListener('mousemove', e => {
            const r = renderer.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
            mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const hits = raycaster.intersectObjects(interactables, true);
            if (hits.length && hits[0].object.userData) {
                const d = hits[0].object.userData;
                tooltip.style.display = 'block';
                tooltip.style.left = (e.clientX - r.left + 15) + 'px';
                tooltip.style.top = (e.clientY - r.top - 10) + 'px';
                tooltip.innerHTML = `<strong>${d.label}</strong>${d.detail ? '<br><small style="opacity:0.7">' + d.detail + '</small>' : ''}`;
                renderer.domElement.style.cursor = 'pointer';
            } else { tooltip.style.display = 'none'; renderer.domElement.style.cursor = 'grab'; }
        });
        window.addEventListener('resize', () => {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        });
        (function anim() { requestAnimationFrame(anim); controls.update(); renderer.render(scene, camera); })();
    }

    function update(params) {
        currentParams = { ...currentParams, ...params };
        while (roomGroup.children.length) roomGroup.remove(roomGroup.children[0]);
        while (furnitureGroup.children.length) furnitureGroup.remove(furnitureGroup.children[0]);
        interactables = [];
        const style = currentParams.style || 'Современный';
        const colors = currentParams.colors || [];
        const area = currentParams.area || 60;
        const sc = STYLES[style] || STYLES['Современный'];
        let wc = sc.wall, fc = sc.floor;
        if (colors.length && COLORS[colors[0]]) { wc = COLORS[colors[0]].w; fc = COLORS[colors[0]].f; }
        const s = Math.max(0.6, Math.min(1.8, area / 100));
        // Floor
        const fl = mk(new THREE.BoxGeometry(6*s, 0.15, 6*s), new THREE.MeshStandardMaterial({ color: fc, roughness: 0.8 }), [0, -0.075, 0], 'Пол', `Площадь: ${area} м²`);
        roomGroup.add(fl); interactables.push(fl);
        // Walls
        const bw = mk(new THREE.BoxGeometry(6*s, 3.5, 0.15), new THREE.MeshStandardMaterial({ color: wc, roughness: 0.6 }), [0, 1.75, -3*s], 'Стена', `Стиль: ${style}`);
        roomGroup.add(bw); interactables.push(bw);
        const lw = mk(new THREE.BoxGeometry(0.15, 3.5, 6*s), new THREE.MeshStandardMaterial({ color: wc }), [-3*s, 1.75, 0]); roomGroup.add(lw);
        const rw = mk(new THREE.BoxGeometry(0.15, 3.5, 6*s), new THREE.MeshStandardMaterial({ color: wc, transparent: true, opacity: 0.3 }), [3*s, 1.75, 0]); roomGroup.add(rw);
        const cl = mk(new THREE.BoxGeometry(6*s, 0.1, 6*s), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 }), [0, 3.5, 0]); roomGroup.add(cl);
        // Accent line
        const al = mk(new THREE.BoxGeometry(6*s, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: sc.accent, emissive: sc.accent, emissiveIntensity: 0.3 }), [0, 1.5, -3*s+0.08]); roomGroup.add(al);
        // Budget items
        const bl = BUDGET[currentParams.budget] || 2;
        if (bl >= 3) { const ch = mk(new THREE.SphereGeometry(0.3, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.5 }), [0, 3.2, 0], 'Люстра', `Бюджет: ${currentParams.budget||'—'}`); roomGroup.add(ch); interactables.push(ch); }
        if (bl >= 4) { const pa = mk(new THREE.BoxGeometry(1.2, 0.8, 0.05), new THREE.MeshStandardMaterial({ color: sc.accent }), [1.5*s, 2, -3*s+0.1], 'Картина', 'Премиум декор'); roomGroup.add(pa); interactables.push(pa); }
        // Window
        const wv = { 'Квартира': 'city', 'Частный дом': 'nature', 'Офис': 'office' }[currentParams.room_type] || 'city';
        const wn = mk(new THREE.PlaneGeometry(2, 1.5), new THREE.MeshStandardMaterial({ color: wv === 'nature' ? 0x4a8f4a : 0x87ceeb, emissive: 0x334455, emissiveIntensity: 0.2 }), [0, 1.8, -2.92], 'Окно', `Вид: ${currentParams.room_type||'—'}`); roomGroup.add(wn); interactables.push(wn);
        // Furniture
        const allF = new Set();
        (currentParams.zones || []).forEach(z => (ZONES[z] || []).forEach(f => allF.add(f)));
        let idx = 0;
        allF.forEach(item => {
            const x = -1.5 + (idx % 3) * 1.2, z = -1 + Math.floor(idx / 3) * 1.5;
            let m, label, detail;
            switch(item) {
                case 'sofa': m = mk(new THREE.BoxGeometry(1.5, 0.5, 0.7), new THREE.MeshStandardMaterial({ color: sc.accent, roughness: 0.7 }), [x, 0.35, z], 'Диван', `Стиль: ${style}`); break;
                case 'bed': m = mk(new THREE.BoxGeometry(1.2, 0.4, 1.8), new THREE.MeshStandardMaterial({ color: 0xf0f0f0 }), [x, 0.3, z], 'Кровать', 'Зона: Спальня'); break;
                case 'counter': m = mk(new THREE.BoxGeometry(1.8, 0.8, 0.5), new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.3 }), [x, 0.4, z], 'Кухня', 'Зона: Кухня'); break;
                case 'desk': m = mk(new THREE.BoxGeometry(1, 0.7, 0.6), new THREE.MeshStandardMaterial({ color: 0x8B7355 }), [x, 0.45, z], 'Стол', 'Зона: Кабинет'); break;
                case 'fridge': m = mk(new THREE.BoxGeometry(0.5, 1.5, 0.5), new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.2 }), [x, 0.75, z], 'Холодильник', 'Зона: Кухня'); break;
                case 'tv': m = mk(new THREE.BoxGeometry(1, 0.6, 0.05), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x222222 }), [x, 1.2, z], 'Телевизор', 'Зона: Гостиная'); break;
                case 'wardrobe': m = mk(new THREE.BoxGeometry(1.2, 2, 0.5), new THREE.MeshStandardMaterial({ color: 0x6b4226 }), [x, 1, z], 'Шкаф', 'Зона: Прихожая'); break;
                case 'wardrobe_big': m = mk(new THREE.BoxGeometry(2, 2.2, 0.6), new THREE.MeshStandardMaterial({ color: 0x8b6914 }), [x, 1.1, z], 'Гардероб', 'Зона: Гардеробная'); break;
                case 'bathtub': m = mk(new THREE.BoxGeometry(1.5, 0.5, 0.7), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 }), [x, 0.35, z], 'Ванна', 'Зона: Санузел'); break;
                case 'sink': m = mk(new THREE.CylinderGeometry(0.25, 0.25, 0.15, 16), new THREE.MeshStandardMaterial({ color: 0xeeeeee }), [x, 0.8, z], 'Раковина', 'Зона: Санузел'); break;
                case 'nightstand': m = mk(new THREE.BoxGeometry(0.4, 0.5, 0.4), new THREE.MeshStandardMaterial({ color: 0x8B7355 }), [x, 0.35, z], 'Тумбочка', 'Зона: Спальня'); break;
                case 'bed_kids': m = mk(new THREE.BoxGeometry(1, 0.35, 1.5), new THREE.MeshStandardMaterial({ color: 0xff9999 }), [x, 0.27, z], 'Детская кровать', 'Зона: Детская'); break;
                case 'bookshelf': m = mk(new THREE.BoxGeometry(0.8, 1.8, 0.3), new THREE.MeshStandardMaterial({ color: 0x5c4033 }), [x, 0.9, z], 'Книжный шкаф', 'Зона: Кабинет'); break;
                case 'plant': m = mk(new THREE.CylinderGeometry(0.15, 0.2, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0x4a8f4a }), [x, 0.4, z], 'Растение', 'Зона: Балкон'); break;
                case 'chair': m = mk(new THREE.BoxGeometry(0.4, 0.5, 0.4), new THREE.MeshStandardMaterial({ color: sc.accent }), [x, 0.35, z], 'Кресло', `Стиль: ${style}`); break;
                case 'mirror': m = mk(new THREE.PlaneGeometry(0.6, 0.8), new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.05, metalness: 0.9 }), [x, 1.5, z], 'Зеркало', 'Зона: Прихожая'); m.rotation.y = Math.PI/2; break;
                default: m = mk(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: sc.accent }), [x, 0.35, z], item, '');
            }
            if(m) { furnitureGroup.add(m); interactables.push(m); }
            idx++;
        });
        if(allF.size === 0) {
            const sf = mk(new THREE.BoxGeometry(1.5, 0.5, 0.7), new THREE.MeshStandardMaterial({ color: sc.accent }), [0, 0.35, 0], 'Диван', `Стиль: ${style}`);
            furnitureGroup.add(sf); interactables.push(sf);
        }
    }

    function mk(geo, mat, pos, label, detail) {
        const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.castShadow = true; m.receiveShadow = true;
        if(label) m.userData = { label, detail: detail||'' };
        return m;
    }

    function screenshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); }

    return { init, update, screenshot };
})();
