/**
 * 3D Room Visualization — Three.js
 * Параметрическая комната, реагирующая на ответы квиза.
 */

const Room3D = (() => {
    let scene, camera, renderer, controls;
    let roomGroup, furnitureGroup;
    let currentParams = {};
    let raycaster, mouse, tooltip;
    let interactables = [];

    // Палитры стилей
    const STYLE_CONFIGS = {
        'Современный': {
            wallColor: 0xf0f0f0, floorColor: 0x8B7355, accentColor: 0x4a6cf7,
            furnitureStyle: 'modern', windowStyle: 'city'
        },
        'Минимализм': {
            wallColor: 0xffffff, floorColor: 0xd4c5a9, accentColor: 0x333333,
            furnitureStyle: 'minimal', windowStyle: 'abstract'
        },
        'Скандинавский': {
            wallColor: 0xfaf8f5, floorColor: 0xc4a882, accentColor: 0x6b8e5a,
            furnitureStyle: 'scandi', windowStyle: 'nature'
        },
        'Классический': {
            wallColor: 0xf5e6d3, floorColor: 0x6b4226, accentColor: 0x8b0000,
            furnitureStyle: 'classic', windowStyle: 'garden'
        },
        'Лофт': {
            wallColor: 0x8b7355, floorColor: 0x555555, accentColor: 0xff6600,
            furnitureStyle: 'loft', windowStyle: 'industrial'
        },
        'Японский': {
            wallColor: 0xf0ead6, floorColor: 0xc8b89a, accentColor: 0x2d5016,
            furnitureStyle: 'japanese', windowStyle: 'zen'
        },
        'Арт-деко': {
            wallColor: 0x1a1a2e, floorColor: 0x2d2d2d, accentColor: 0xffd700,
            furnitureStyle: 'artdeco', windowStyle: 'night'
        }
    };

    const COLOR_PALETTES = {
        'Белый': { wall: 0xffffff, floor: 0xf5f5f5 },
        'Тёмный': { wall: 0x333333, floor: 0x222222 },
        'Деревянный': { wall: 0xd4a574, floor: 0x8b6914 },
        'Синий': { wall: 0x4a6fa5, floor: 0x3a5f8a },
        'Зелёный': { wall: 0x6b8e5a, floor: 0x4a6f3a },
        'Жёлтый': { wall: 0xf0e68c, floor: 0xd4c5a9 },
        'Розовый': { wall: 0xf0b0c0, floor: 0xe0a0b0 },
        'Разноцветный': { wall: 0x7eb8b8, floor: 0xb87eb8 }
    };

    const BUDGET_LEVELS = {
        'До 500 000 ₽': 1,
        '500 000 – 1 000 000 ₽': 2,
        '1 000 000 – 2 000 000 ₽': 3,
        'От 2 000 000 ₽': 4,
        'Пока не знаю': 2
    };

    const ROOM_TYPES = {
        'Квартира': 'city', 'Частный дом': 'nature',
        'Офис': 'office', 'Коммерческое': 'commercial',
        'Студия': 'studio', 'Другое': 'abstract'
    };

    const ZONES_FURNITURE = {
        'Кухня': ['counter', 'fridge'], 'Гостиная': ['sofa', 'tv'],
        'Спальня': ['bed', 'nightstand'], 'Детская': ['bed_kids', 'desk'],
        'Санузел': ['bathtub', 'sink'], 'Прихожая': ['wardrobe', 'mirror'],
        'Кабинет': ['desk', 'bookshelf'], 'Гардеробная': ['wardrobe_big'],
        'Балкон / лоджия': ['plant', 'chair'], 'Всё помещение': ['sofa', 'bed', 'counter', 'desk']
    };

    function init(container) {
        if (!container) return;

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);

        camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(5, 4, 6);
        camera.lookAt(0, 1, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        // OrbitControls
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxPolarAngle = Math.PI / 2.1;
        controls.minDistance = 3;
        controls.maxDistance = 12;

        // Освещение
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(5, 8, 3);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        scene.add(mainLight);

        const fillLight = new THREE.PointLight(0x4a6cf7, 0.3);
        fillLight.position.set(-3, 3, -2);
        scene.add(fillLight);

        // Группы объектов
        roomGroup = new THREE.Group();
        furnitureGroup = new THREE.Group();
        scene.add(roomGroup);
        scene.add(furnitureGroup);

        // Raycaster для тултипов
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();

        // Тултип
        tooltip = document.createElement('div');
        tooltip.className = 'room3d-tooltip';
        tooltip.style.cssText = 'position:absolute;display:none;background:rgba(0,0,0,0.85);color:#fff;padding:8px 12px;border-radius:8px;font-size:13px;pointer-events:none;z-index:1000;max-width:200px;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);';
        container.style.position = 'relative';
        container.appendChild(tooltip);

        renderer.domElement.addEventListener('mousemove', onMouseMove);
        renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('resize', onResize);

        animate();
    }

    function onMouseMove(e) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactables, true);

        if (intersects.length > 0) {
            const obj = intersects[0].object;
            if (obj.userData && obj.userData.label) {
                tooltip.style.display = 'block';
                tooltip.style.left = (e.clientX - rect.left + 15) + 'px';
                tooltip.style.top = (e.clientY - rect.top - 10) + 'px';
                tooltip.innerHTML = `<strong>${obj.userData.label}</strong>${obj.userData.detail ? '<br><small style="opacity:0.7">' + obj.userData.detail + '</small>' : ''}`;
                renderer.domElement.style.cursor = 'pointer';
            }
        } else {
            tooltip.style.display = 'none';
            renderer.domElement.style.cursor = 'grab';
        }
    }

    function onTouchStart(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(interactables, true);
            if (intersects.length > 0 && intersects[0].object.userData) {
                const d = intersects[0].object.userData;
                alert(`${d.label}${d.detail ? '\n' + d.detail : ''}`);
            }
        }
    }

    function onResize() {
        const container = renderer.domElement.parentElement;
        if (container) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    }

    function clearScene() {
        while (roomGroup.children.length > 0) roomGroup.remove(roomGroup.children[0]);
        while (furnitureGroup.children.length > 0) furnitureGroup.remove(furnitureGroup.children[0]);
        interactables = [];
    }

    function update(params) {
        currentParams = { ...currentParams, ...params };
        clearScene();
        buildRoom();
        buildFurniture();
        buildWindow();
    }

    function buildRoom() {
        const style = currentParams.style || 'Современный';
        const colors = currentParams.colors || [];
        const area = currentParams.area || 60;
        const styleCfg = STYLE_CONFIGS[style] || STYLE_CONFIGS['Современный'];

        let wallColor = styleCfg.wallColor;
        let floorColor = styleCfg.floorColor;

        if (colors.length > 0 && COLOR_PALETTES[colors[0]]) {
            const cp = COLOR_PALETTES[colors[0]];
            wallColor = cp.wall;
            floorColor = cp.floor;
        }

        const scale = Math.max(0.6, Math.min(1.8, area / 100));

        // Пол
        const floorGeo = new THREE.BoxGeometry(6 * scale, 0.15, 6 * scale);
        const floorMat = new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.8 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.position.y = -0.075;
        floor.receiveShadow = true;
        floor.userData = { label: 'Пол', detail: `Площадь: ${area} м²` };
        roomGroup.add(floor);
        interactables.push(floor);

        // Задняя стена
        const backWallGeo = new THREE.BoxGeometry(6 * scale, 3.5, 0.15);
        const backWallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.6 });
        const backWall = new THREE.Mesh(backWallGeo, backWallMat);
        backWall.position.set(0, 1.75, -3 * scale);
        backWall.castShadow = true;
        backWall.receiveShadow = true;
        backWall.userData = { label: 'Стена', detail: `Стиль: ${style}` };
        roomGroup.add(backWall);
        interactables.push(backWall);

        // Левая стена
        const leftWallGeo = new THREE.BoxGeometry(0.15, 3.5, 6 * scale);
        const leftWallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.6 });
        const leftWall = new THREE.Mesh(leftWallGeo, leftWallMat);
        leftWall.position.set(-3 * scale, 1.75, 0);
        leftWall.castShadow = true;
        roomGroup.add(leftWall);

        // Правая стена (полупрозрачная)
        const rightWallMat = new THREE.MeshStandardMaterial({ color: wallColor, transparent: true, opacity: 0.3 });
        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.5, 6 * scale), rightWallMat);
        rightWall.position.set(3 * scale, 1.75, 0);
        roomGroup.add(rightWall);

        // Потолок
        const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 });
        const ceiling = new THREE.Mesh(new THREE.BoxGeometry(6 * scale, 0.1, 6 * scale), ceilingMat);
        ceiling.position.y = 3.5;
        roomGroup.add(ceiling);

        // Акцентная полоса (декор)
        const accentGeo = new THREE.BoxGeometry(6 * scale, 0.05, 0.05);
        const accentMat = new THREE.MeshStandardMaterial({ color: styleCfg.accentColor, emissive: styleCfg.accentColor, emissiveIntensity: 0.3 });
        const accent = new THREE.Mesh(accentGeo, accentMat);
        accent.position.set(0, 1.5, -3 * scale + 0.08);
        roomGroup.add(accent);

        // Бюджет: люстра/декор
        const budgetLevel = BUDGET_LEVELS[currentParams.budget] || 2;
        if (budgetLevel >= 3) {
            // Люстра
            const chandelierGeo = new THREE.SphereGeometry(0.3, 16, 16);
            const chandelierMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.5 });
            const chandelier = new THREE.Mesh(chandelierGeo, chandelierMat);
            chandelier.position.set(0, 3.2, 0);
            chandelier.userData = { label: 'Люстра', detail: `Бюджет: ${currentParams.budget || 'не указан'}` };
            roomGroup.add(chandelier);
            interactables.push(chandelier);
        }

        if (budgetLevel >= 4) {
            // Картина на стене
            const paintingGeo = new THREE.BoxGeometry(1.2, 0.8, 0.05);
            const paintingMat = new THREE.MeshStandardMaterial({ color: styleCfg.accentColor });
            const painting = new THREE.Mesh(paintingGeo, paintingMat);
            painting.position.set(1.5 * scale, 2, -3 * scale + 0.1);
            painting.userData = { label: 'Картина', detail: 'Премиум декор' };
            roomGroup.add(painting);
            interactables.push(painting);
        }
    }

    function buildWindow() {
        const roomType = currentParams.room_type || 'Квартира';
        const windowView = ROOM_TYPES[roomType] || 'city';
        const style = currentParams.style || 'Современный';
        const styleCfg = STYLE_CONFIGS[style] || STYLE_CONFIGS['Современный'];

        // Окно
        const windowGeo = new THREE.PlaneGeometry(2, 1.5);
        const windowMat = new THREE.MeshStandardMaterial({
            color: windowView === 'night' ? 0x0a0a2e : windowView === 'nature' ? 0x4a8f4a : 0x87ceeb,
            emissive: windowView === 'night' ? 0x1a1a3e : 0x334455,
            emissiveIntensity: 0.2
        });
        const windowMesh = new THREE.Mesh(windowGeo, windowMat);
        windowMesh.position.set(0, 1.8, -2.92);
        windowMesh.userData = { label: 'Окно', detail: `Вид: ${roomType}` };
        roomGroup.add(windowMesh);
        interactables.push(windowMesh);

        // Рама
        const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const frameH = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.05, 0.05), frameMat);
        frameH.position.set(0, 1.8, -2.9);
        roomGroup.add(frameH);
        const frameV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.6, 0.05), frameMat);
        frameV.position.set(0, 1.8, -2.9);
        roomGroup.add(frameV);

        // Офис: табличка
        if (windowView === 'office') {
            const signGeo = new THREE.BoxGeometry(0.6, 0.2, 0.02);
            const signMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
            const sign = new THREE.Mesh(signGeo, signMat);
            sign.position.set(1.5, 2.5, -2.85);
            sign.userData = { label: 'Табличка', detail: 'Офис' };
            roomGroup.add(sign);
        }
    }

    function buildFurniture() {
        const zones = currentParams.zones || [];
        const style = currentParams.style || 'Современный';
        const styleCfg = STYLE_CONFIGS[style] || STYLE_CONFIGS['Современный'];
        const budgetLevel = BUDGET_LEVELS[currentParams.budget] || 2;

        const allFurniture = new Set();
        zones.forEach(z => {
            (ZONES_FURNITURE[z] || []).forEach(f => allFurniture.add(f));
        });

        let offsetX = -1.5;
        const spacing = 1.2;

        allFurniture.forEach((item, idx) => {
            const x = offsetX + (idx % 3) * spacing;
            const z = -1 + Math.floor(idx / 3) * 1.5;

            let mesh, label, detail;

            switch (item) {
                case 'sofa':
                    mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(1.5, 0.5, 0.7),
                        new THREE.MeshStandardMaterial({ color: styleCfg.accentColor, roughness: 0.7 })
                    );
                    mesh.position.set(x, 0.35, z);
                    label = 'Диван';
                    detail = `Стиль: ${style}`;
                    break;
                case 'bed':
                    mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(1.2, 0.4, 1.8),
                        new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.9 })
                    );
                    mesh.position.set(x, 0.3, z);
                    label = 'Кровать';
                    detail = `Зона: Спальня`;
                    break;
                case 'counter':
                    mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(1.8, 0.8, 0.5),
                        new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.3 })
                    );
                    mesh.position.set(x, 0.4, z);
                    label = 'Кухонный гарнитур';
                    detail = 'Зона: Кухня';
                    break;
                case 'desk':
                    mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(1, 0.7, 0.6),
                        new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.6 })
                    );
                    mesh.position.set(x, 0.45, z);
                    label = 'Стол';
                    detail = 'Зона: Кабинет';
                    break;
                case 'fridge':
                    mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(0.5, 1.5, 0.5),
                        new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.2 })
                    );
                    mesh.position.set(x, 0.75, z);
                    label = 'Холодильник';
                    detail = 'Зона: Кухня';
                    break;
                case 'tv':
                    mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(1, 0.6, 0.05),
                        new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x222222 })
                    );
                    mesh.position.set(x, 1.2, z);
                    label = 'Телевизор';
                    detail = 'Зона: Гостиная';
                    break;
                case 'wardrobe':
                    mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(1.2, 2, 0.5),
                        new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.5 })
                    );
                    mesh.position.set(x, 1, z);
                    label = 'Шкаф';
                    detail = 'Зона: Прихожая';
                    break;
                case 'wardrobe_big':
                    mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(2, 2.2, 0.6),
                        new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.5 })
                    );
                    mesh.position.set(x, 1.1, z);
                    label = 'Гардеробная система';
                    detail = 'Зона: Гардеробная';
                    break;
                case 'bathtub':
                    mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(1.5, 0.5, 0.7),
                        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 })
                    );
                    mesh.position.set(x, 0.35, z);
                    label = 'Ванна';
                    detail = 'Зона: Санузел';
                    break;
                case 'sink':
                    mesh = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.25, 0.25, 0.15, 16),
                        new THREE.MeshStandardMaterial({ color: 0xeeeeee })
                    );
                    mesh.position.set(x, 0.8, z);
                    label = 'Раковина';
                    detail = 'Зона: Санузел';
                    break;
                case 'nightstand':
                    mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(0.4, 0.5, 0.4),
                        new THREE.MeshStandardMaterial({ color: 0x8B7355 })
                    );
                    mesh.position.set(x, 0.35, z);
                    label = 'Тумбочка';
                    detail = 'Зона: Спальня';
                    break;
                case 'bed_kids':
                    mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(1, 0.35, 1.5),
                        new THREE.MeshStandardMaterial({ color: 0xff9999 })
                    );
                    mesh.position.set(x, 0.27, z);
                    label = 'Детская кровать';
                    detail = 'Зона: Детская';
                    break;
                case 'bookshelf':
                    mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(0.8, 1.8, 0.3),
                        new THREE.MeshStandardMaterial({ color: 0x5c4033 })
                    );
                    mesh.position.set(x, 0.9, z);
                    label = 'Книжный шкаф';
                    detail = 'Зона: Кабинет';
                    break;
                case 'plant':
                    mesh = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.15, 0.2, 0.6, 8),
                        new THREE.MeshStandardMaterial({ color: 0x4a8f4a })
                    );
                    mesh.position.set(x, 0.4, z);
                    label = 'Растение';
                    detail = 'Зона: Балкон';
                    break;
                case 'chair':
                    mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(0.4, 0.5, 0.4),
                        new THREE.MeshStandardMaterial({ color: styleCfg.accentColor })
                    );
                    mesh.position.set(x, 0.35, z);
                    label = 'Кресло';
                    detail = `Стиль: ${style}`;
                    break;
                case 'mirror':
                    mesh = new THREE.Mesh(
                        new THREE.PlaneGeometry(0.6, 0.8),
                        new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.05, metalness: 0.9 })
                    );
                    mesh.position.set(x, 1.5, z);
                    mesh.rotation.y = Math.PI / 2;
                    label = 'Зеркало';
                    detail = 'Зона: Прихожая';
                    break;
                default:
                    mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(0.5, 0.5, 0.5),
                        new THREE.MeshStandardMaterial({ color: styleCfg.accentColor })
                    );
                    mesh.position.set(x, 0.35, z);
                    label = item;
                    detail = '';
            }

            if (mesh) {
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.userData.label = label;
                mesh.userData.detail = detail;
                furnitureGroup.add(mesh);
                interactables.push(mesh);
            }
        });

        // Если нет зон — базовая мебель
        if (allFurniture.size === 0) {
            const sofa = new THREE.Mesh(
                new THREE.BoxGeometry(1.5, 0.5, 0.7),
                new THREE.MeshStandardMaterial({ color: styleCfg.accentColor })
            );
            sofa.position.set(0, 0.35, 0);
            sofa.castShadow = true;
            sofa.userData = { label: 'Диван', detail: `Стиль: ${style}` };
            furnitureGroup.add(sofa);
            interactables.push(sofa);
        }
    }

    function animate() {
        requestAnimationFrame(animate);
        if (controls) controls.update();
        if (renderer && scene && camera) renderer.render(scene, camera);
    }

    function screenshot() {
        renderer.render(scene, camera);
        return renderer.domElement.toDataURL('image/png');
    }

    function dispose() {
        if (renderer) renderer.dispose();
        if (tooltip && tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
        window.removeEventListener('resize', onResize);
    }

    return { init, update, screenshot, dispose };
})();
