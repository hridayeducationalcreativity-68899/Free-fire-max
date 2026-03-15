import React, { useEffect, useRef, useState } from 'react';
import { Player, Bullet, Loot, GameState } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Crosshair, Heart, Zap, Map as MapIcon, Skull, Users } from 'lucide-react';
import * as THREE from 'three';

const MAP_SIZE = 2000;
const VIEW_SIZE = 800;
const PLAYER_SPEED = 4;
const BULLET_SPEED = 10;
const BOT_COUNT = 15;

const WEAPONS = {
  pistol: { name: 'USP Pistol', damage: 15, cooldown: 400, speed: 12, spread: 0, count: 1 },
  rifle: { name: 'M4A1 Rifle', damage: 20, cooldown: 150, speed: 10, spread: 0, count: 1 },
  shotgun: { name: 'M1887 Shotgun', damage: 12, cooldown: 800, speed: 8, spread: 0.2, count: 5 },
};

export const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const threeContainerRef = useRef<HTMLDivElement>(null);
  
  // Three.js Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerMeshRef = useRef<THREE.Group | null>(null);
  const botMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const bulletMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const lootMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const zoneMeshRef = useRef<THREE.Mesh | null>(null);
  const groundRef = useRef<THREE.Mesh | null>(null);
  const buildingsRef = useRef<THREE.Group | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    bullets: [],
    loots: [],
    floatingTexts: [],
    killFeed: [],
    zoneRadius: MAP_SIZE / 1.5,
    zoneX: MAP_SIZE / 2,
    zoneY: MAP_SIZE / 2,
    isGameOver: false,
    winner: null,
  });

  const gameStateRef = useRef<GameState>(gameState);

  // Update ref whenever state changes
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Input Refs (to avoid re-triggering game loop)
  const keysRef = useRef<Set<string>>(new Set());
  const mousePosRef = useRef({ x: 0, y: 0 });
  const isShootingRef = useRef(false);
  const lastShootTimeRef = useRef(0);
  const [isTouch, setIsTouch] = useState(false);
  const [hitMarkerLife, setHitMarkerLife] = useState(0);
  const [damageFlash, setDamageFlash] = useState(0);

  // Detect touch device
  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // Initialize game
  useEffect(() => {
    const initialPlayers: Player[] = [
      {
        id: 'player',
        x: MAP_SIZE / 2,
        y: MAP_SIZE / 2,
        health: 100,
        maxHealth: 100,
        ammo: 90,
        isBot: false,
        angle: 0,
        weapon: 'rifle',
        kills: 0,
      },
      ...Array.from({ length: BOT_COUNT }).map((_, i) => ({
        id: `bot-${i}`,
        x: Math.random() * MAP_SIZE,
        y: Math.random() * MAP_SIZE,
        health: 100,
        maxHealth: 100,
        ammo: 30,
        isBot: true,
        angle: Math.random() * Math.PI * 2,
        weapon: 'rifle' as const,
        kills: 0,
      })),
    ];

    const initialLoots: Loot[] = Array.from({ length: 40 }).map((_, i) => ({
      id: `loot-${i}`,
      x: Math.random() * MAP_SIZE,
      y: Math.random() * MAP_SIZE,
      type: ['ammo', 'medkit', 'rifle', 'shotgun'][Math.floor(Math.random() * 4)] as any,
    }));

    setGameState(prev => ({ ...prev, players: initialPlayers, loots: initialLoots }));
  }, []);

  // Initialize Three.js
  useEffect(() => {
    if (!threeContainerRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#87CEEB'); // Sky Blue
    scene.fog = new THREE.FogExp2('#87CEEB', 0.0005);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
    camera.position.set(0, 500, 500);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const width = threeContainerRef.current.clientWidth || window.innerWidth;
    const height = threeContainerRef.current.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    threeContainerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    sunLight.position.set(500, 1000, 500);
    sunLight.castShadow = true;
    sunLight.shadow.camera.left = -2000;
    sunLight.shadow.camera.right = 2000;
    sunLight.shadow.camera.top = 2000;
    sunLight.shadow.camera.bottom = -2000;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    // Add a secondary light for better visibility
    const fillLight = new THREE.PointLight(0x00f2ff, 0.5);
    fillLight.position.set(-500, 500, -500);
    scene.add(fillLight);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(MAP_SIZE * 2, MAP_SIZE * 2);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: '#1a2b1a',
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    groundRef.current = ground;

    // Buildings / Obstacles
    const buildings = new THREE.Group();
    for (let i = 0; i < 30; i++) {
      const w = 100 + Math.random() * 150;
      const h = 50 + Math.random() * 200;
      const d = 100 + Math.random() * 150;
      const buildingGeo = new THREE.BoxGeometry(w, h, d);
      const buildingMat = new THREE.MeshStandardMaterial({ 
        color: i % 2 === 0 ? '#2a2a2a' : '#3a3a3a',
        metalness: 0.5,
        roughness: 0.2
      });
      const building = new THREE.Mesh(buildingGeo, buildingMat);
      
      // Random position avoiding center
      let bx, bz;
      do {
        bx = (Math.random() - 0.5) * MAP_SIZE * 1.5;
        bz = (Math.random() - 0.5) * MAP_SIZE * 1.5;
      } while (Math.abs(bx) < 200 && Math.abs(bz) < 200);

      building.position.set(bx, h/2, bz);
      building.castShadow = true;
      building.receiveShadow = true;
      buildings.add(building);
    }
    scene.add(buildings);
    buildingsRef.current = buildings;

    // Grid helper for HD feel
    const grid = new THREE.GridHelper(MAP_SIZE * 2, 40, 0x000000, 0x000000);
    grid.position.y = 0.1;
    grid.material.opacity = 0.1;
    grid.material.transparent = true;
    scene.add(grid);

    // Zone Mesh
    const zoneGeo = new THREE.RingGeometry(1, 1.1, 64);
    const zoneMat = new THREE.MeshBasicMaterial({ color: '#00f2ff', side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    const zone = new THREE.Mesh(zoneGeo, zoneMat);
    zone.rotation.x = -Math.PI / 2;
    zone.position.y = 5;
    scene.add(zone);
    zoneMeshRef.current = zone;

    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (threeContainerRef.current) {
        threeContainerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Helper to create character mesh
  const createCharacterMesh = (isBot: boolean) => {
    const group = new THREE.Group();
    
    // Body
    const bodyGeo = new THREE.CylinderGeometry(20, 20, 60, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ 
      color: isBot ? '#444444' : '#ff6b00',
      roughness: 0.5,
      metalness: 0.2
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 30;
    body.castShadow = true;
    group.add(body);

    // Backpack
    const packGeo = new THREE.BoxGeometry(25, 35, 15);
    const packMat = new THREE.MeshStandardMaterial({ color: '#222' });
    const pack = new THREE.Mesh(packGeo, packMat);
    pack.position.set(0, 35, -15);
    group.add(pack);

    // Head / Helmet
    const headGeo = new THREE.SphereGeometry(15, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: isBot ? '#333' : '#ffdbac' });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 70;
    head.castShadow = true;
    group.add(head);

    // Visor for futuristic look
    const visorGeo = new THREE.BoxGeometry(20, 5, 10);
    const visorMat = new THREE.MeshBasicMaterial({ color: '#00f2ff' });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 72, 10);
    group.add(visor);

    // Gun
    const gunGeo = new THREE.BoxGeometry(10, 10, 60);
    const gunMat = new THREE.MeshStandardMaterial({ color: '#111111', metalness: 0.8 });
    const gun = new THREE.Mesh(gunGeo, gunMat);
    gun.position.set(25, 40, 25);
    gun.castShadow = true;
    group.add(gun);

    return group;
  };

  // Input listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.key.toLowerCase());
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }
    };
    const handleMouseDown = () => isShootingRef.current = true;
    const handleMouseUp = () => isShootingRef.current = false;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Game Loop
  useEffect(() => {
    let animationFrameId: number;

    const update = () => {
      setGameState(prev => {
        if (prev.isGameOver) return prev;

        const nextPlayers = [...prev.players];
        const nextBullets = [...prev.bullets];
        const nextLoots = [...prev.loots];
        const nextFloatingTexts = prev.floatingTexts.map(t => ({ ...t, life: t.life - 0.02 })).filter(t => t.life > 0);
        const nextKillFeed = prev.killFeed.filter(k => Date.now() - k.time < 5000);
        
        const player = nextPlayers.find(p => p.id === 'player');

        if (!player) return { ...prev, isGameOver: true, winner: 'ELIMINATED' };

        // 1. Move Player
        let dx = 0;
        let dy = 0;
        const keys = keysRef.current;
        if (keys.has('w')) dy -= 1;
        if (keys.has('s')) dy += 1;
        if (keys.has('a')) dx -= 1;
        if (keys.has('d')) dx += 1;

        if (dx !== 0 || dy !== 0) {
          const mag = Math.sqrt(dx * dx + dy * dy);
          player.x = Math.max(0, Math.min(MAP_SIZE, player.x + (dx / mag) * PLAYER_SPEED));
          player.y = Math.max(0, Math.min(MAP_SIZE, player.y + (dy / mag) * PLAYER_SPEED));
        }

        // Rotate player to mouse
        const centerX = VIEW_SIZE / 2;
        const centerY = VIEW_SIZE / 2;
        player.angle = Math.atan2(mousePosRef.current.y - centerY, mousePosRef.current.x - centerX);

        // Weapon Switching
        if (keys.has('1')) player.weapon = 'pistol';
        if (keys.has('2')) player.weapon = 'rifle';
        if (keys.has('3')) player.weapon = 'shotgun';

        // 2. Shooting
        const now = Date.now();
        const weaponConfig = WEAPONS[player.weapon];
        if (isShootingRef.current && player.ammo > 0 && now - lastShootTimeRef.current > weaponConfig.cooldown) {
          for (let i = 0; i < weaponConfig.count; i++) {
            const spreadAngle = player.angle + (Math.random() - 0.5) * weaponConfig.spread;
            nextBullets.push({
              id: `bullet-${now}-${i}`,
              x: player.x,
              y: player.y,
              vx: Math.cos(spreadAngle) * weaponConfig.speed,
              vy: Math.sin(spreadAngle) * weaponConfig.speed,
              ownerId: 'player',
              damage: weaponConfig.damage,
            });
          }
          player.ammo -= 1;
          lastShootTimeRef.current = now;
        }

        // 3. Update Bots
        nextPlayers.forEach(p => {
          if (!p.isBot) return;

          const distToPlayer = Math.sqrt((p.x - player.x) ** 2 + (p.y - player.y) ** 2);
          if (distToPlayer < 400) {
            p.angle = Math.atan2(player.y - p.y, player.x - p.x);
            p.x += Math.cos(p.angle) * (PLAYER_SPEED * 0.6);
            p.y += Math.sin(p.angle) * (PLAYER_SPEED * 0.6);

            if (Math.random() < 0.02) {
              nextBullets.push({
                id: `bullet-bot-${Date.now()}-${p.id}`,
                x: p.x,
                y: p.y,
                vx: Math.cos(p.angle) * BULLET_SPEED,
                vy: Math.sin(p.angle) * BULLET_SPEED,
                ownerId: p.id,
                damage: 10,
              });
            }
          } else {
            p.x += Math.cos(p.angle) * (PLAYER_SPEED * 0.3);
            p.y += Math.sin(p.angle) * (PLAYER_SPEED * 0.3);
            if (Math.random() < 0.01) p.angle = Math.random() * Math.PI * 2;
          }

          p.x = Math.max(0, Math.min(MAP_SIZE, p.x));
          p.y = Math.max(0, Math.min(MAP_SIZE, p.y));
        });

        // 4. Update Bullets & Collisions
        const activeBullets = nextBullets.filter(b => {
          b.x += b.vx;
          b.y += b.vy;

          let hit = false;
          nextPlayers.forEach(p => {
            if (p.id === b.ownerId) return;
            const dist = Math.sqrt((p.x - b.x) ** 2 + (p.y - b.y) ** 2);
            if (dist < 20) {
              p.health -= b.damage;
              hit = true;

              // Hit Feedback
              if (b.ownerId === 'player') {
                setHitMarkerLife(1);
                nextFloatingTexts.push({
                  id: `float-${Date.now()}-${Math.random()}`,
                  x: p.x,
                  y: p.y - 20,
                  text: b.damage.toString(),
                  color: '#FFD700',
                  life: 1,
                });
              }

              if (p.id === 'player') {
                setDamageFlash(1);
              }

              if (p.health <= 0) {
                const owner = nextPlayers.find(op => op.id === b.ownerId);
                if (owner) {
                  owner.kills += 1;
                  nextKillFeed.push({
                    id: `kill-${Date.now()}`,
                    killer: owner.id === 'player' ? 'YOU' : `Bot ${owner.id.split('-')[1]}`,
                    victim: p.id === 'player' ? 'YOU' : `Bot ${p.id.split('-')[1]}`,
                    time: Date.now(),
                  });
                }
              }
            }
          });

          return !hit && b.x > 0 && b.x < MAP_SIZE && b.y > 0 && b.y < MAP_SIZE;
        });

        // 5. Zone Shrink
        const nextZoneRadius = Math.max(50, prev.zoneRadius - 0.05);

        nextPlayers.forEach(p => {
          const distToZone = Math.sqrt((p.x - prev.zoneX) ** 2 + (p.y - prev.zoneY) ** 2);
          if (distToZone > nextZoneRadius) {
            p.health -= 0.05;
          }
        });

        // 6. Looting
        const remainingLoots = nextLoots.filter(l => {
          const dist = Math.sqrt((player.x - l.x) ** 2 + (player.y - l.y) ** 2);
          if (dist < 30) {
            if (l.type === 'ammo') player.ammo += 30;
            if (l.type === 'medkit') player.health = Math.min(player.maxHealth, player.health + 50);
            if (l.type === 'rifle') player.weapon = 'rifle';
            if (l.type === 'shotgun') player.weapon = 'shotgun';
            return false;
          }
          return true;
        });

        const alivePlayers = nextPlayers.filter(p => p.health > 0);
        
        const nextState = {
          ...prev,
          players: alivePlayers,
          bullets: activeBullets,
          loots: remainingLoots,
          floatingTexts: nextFloatingTexts,
          killFeed: nextKillFeed,
          zoneRadius: nextZoneRadius,
        };

        if (alivePlayers.length === 1 && alivePlayers[0].id === 'player') {
          nextState.isGameOver = true;
          nextState.winner = 'BOOYAH!';
        }

        gameStateRef.current = nextState;
        return nextState;
      });

      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Three.js Render Loop
  useEffect(() => {
    let animationFrameId: number;

    const render3D = () => {
      if (sceneRef.current && cameraRef.current && rendererRef.current) {
        const scene = sceneRef.current;
        const state = gameStateRef.current;
        const player = state.players.find(p => p.id === 'player');

        // Update Players
        state.players.forEach(p => {
          let mesh: THREE.Group;
          if (p.id === 'player') {
            if (!playerMeshRef.current) {
              playerMeshRef.current = createCharacterMesh(false);
              scene.add(playerMeshRef.current);
            }
            mesh = playerMeshRef.current;
          } else {
            if (!botMeshesRef.current.has(p.id)) {
              const botMesh = createCharacterMesh(true);
              botMeshesRef.current.set(p.id, botMesh);
              scene.add(botMesh);
            }
            mesh = botMeshesRef.current.get(p.id)!;
          }
          mesh.position.set(p.x - MAP_SIZE / 2, 0, p.y - MAP_SIZE / 2);
          mesh.rotation.y = -p.angle + Math.PI / 2;
        });

        // Cleanup dead bots
        const aliveIds = new Set(state.players.map(p => p.id));
        botMeshesRef.current.forEach((mesh, id) => {
          if (!aliveIds.has(id)) {
            scene.remove(mesh);
            botMeshesRef.current.delete(id);
          }
        });

        // Update Bullets
        const bulletIds = new Set(state.bullets.map(b => b.id));
        bulletMeshesRef.current.forEach((mesh, id) => {
          if (!bulletIds.has(id)) {
            scene.remove(mesh);
            bulletMeshesRef.current.delete(id);
          }
        });

        state.bullets.forEach(b => {
          if (!bulletMeshesRef.current.has(b.id)) {
            const bulletGeo = new THREE.SphereGeometry(5, 8, 8);
            const bulletMat = new THREE.MeshBasicMaterial({ color: b.ownerId === 'player' ? '#ffcc00' : '#ffffff' });
            const bulletMesh = new THREE.Mesh(bulletGeo, bulletMat);
            bulletMeshesRef.current.set(b.id, bulletMesh);
            scene.add(bulletMesh);
          }
          const mesh = bulletMeshesRef.current.get(b.id)!;
          mesh.position.set(b.x - MAP_SIZE / 2, 30, b.y - MAP_SIZE / 2);
        });

        // Update Loots
        const lootIds = new Set(state.loots.map(l => l.id));
        lootMeshesRef.current.forEach((mesh, id) => {
          if (!lootIds.has(id)) {
            scene.remove(mesh);
            lootMeshesRef.current.delete(id);
          }
        });

        state.loots.forEach(l => {
          if (!lootMeshesRef.current.has(l.id)) {
            const group = new THREE.Group();
            const boxGeo = new THREE.BoxGeometry(30, 30, 30);
            const boxMat = new THREE.MeshStandardMaterial({ color: l.type === 'medkit' ? '#f00' : '#ff0' });
            const box = new THREE.Mesh(boxGeo, boxMat);
            box.position.y = 15;
            box.castShadow = true;
            group.add(box);
            lootMeshesRef.current.set(l.id, group);
            scene.add(group);
          }
          const mesh = lootMeshesRef.current.get(l.id)!;
          mesh.position.set(l.x - MAP_SIZE / 2, 0, l.y - MAP_SIZE / 2);
          mesh.rotation.y += 0.05;
        });

        // Update Zone
        if (zoneMeshRef.current) {
          zoneMeshRef.current.scale.set(state.zoneRadius, state.zoneRadius, 1);
          zoneMeshRef.current.position.set(state.zoneX - MAP_SIZE / 2, 5, state.zoneY - MAP_SIZE / 2);
        }

        // Update Camera
        if (cameraRef.current) {
          const targetX = player ? player.x - MAP_SIZE / 2 : 0;
          const targetZ = player ? player.y - MAP_SIZE / 2 : 0;
          cameraRef.current.position.x += (targetX - cameraRef.current.position.x) * 0.1;
          cameraRef.current.position.z += (targetZ + 400 - cameraRef.current.position.z) * 0.1;
          cameraRef.current.position.y = 500;
          cameraRef.current.lookAt(targetX, 0, targetZ);
        }

        rendererRef.current.render(scene, cameraRef.current);
      }
      animationFrameId = requestAnimationFrame(render3D);
    };

    animationFrameId = requestAnimationFrame(render3D);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const player = gameState.players.find(p => p.id === 'player');
      if (!player) return;

      const offsetX = VIEW_SIZE / 2 - player.x;
      const offsetY = VIEW_SIZE / 2 - player.y;

      // Clear
      ctx.fillStyle = '#1a2e1a'; // Grass color
      ctx.fillRect(0, 0, VIEW_SIZE, VIEW_SIZE);

      // Draw Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      for (let x = 0; x <= MAP_SIZE; x += 100) {
        ctx.moveTo(x + offsetX, offsetY);
        ctx.lineTo(x + offsetX, MAP_SIZE + offsetY);
      }
      for (let y = 0; y <= MAP_SIZE; y += 100) {
        ctx.moveTo(offsetX, y + offsetY);
        ctx.lineTo(MAP_SIZE + offsetX, y + offsetY);
      }
      ctx.stroke();

      // Draw Zone
      ctx.strokeStyle = '#00f';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(gameState.zoneX + offsetX, gameState.zoneY + offsetY, gameState.zoneRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw Zone Danger
      ctx.fillStyle = 'rgba(0,0,255,0.1)';
      ctx.beginPath();
      ctx.rect(offsetX, offsetY, MAP_SIZE, MAP_SIZE);
      ctx.arc(gameState.zoneX + offsetX, gameState.zoneY + offsetY, gameState.zoneRadius, 0, Math.PI * 2, true);
      ctx.fill();

      // Draw Loots
      gameState.loots.forEach(l => {
        ctx.fillStyle = l.type === 'medkit' ? '#f00' : '#ff0';
        ctx.beginPath();
        ctx.arc(l.x + offsetX, l.y + offsetY, 10, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Bullets
      gameState.bullets.forEach(b => {
        ctx.fillStyle = b.ownerId === 'player' ? '#ffcc00' : '#ffffff';
        ctx.beginPath();
        ctx.arc(b.x + offsetX, b.y + offsetY, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Floating Texts
      gameState.floatingTexts.forEach(t => {
        ctx.fillStyle = t.color;
        ctx.globalAlpha = t.life;
        ctx.font = 'bold 16px Arial';
        ctx.fillText(t.text, t.x + offsetX, t.y + offsetY - (1 - t.life) * 50);
        ctx.globalAlpha = 1.0;
      });

      // Draw Zone
      ctx.strokeStyle = '#00f2ff';
      ctx.lineWidth = 5;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.arc(gameState.zoneX + offsetX, gameState.zoneY + offsetY, gameState.zoneRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Hit Marker
      if (hitMarkerLife > 0) {
        ctx.strokeStyle = `rgba(255, 0, 0, ${hitMarkerLife})`;
        ctx.lineWidth = 2;
        const size = 10;
        ctx.beginPath();
        ctx.moveTo(VIEW_SIZE / 2 - size, VIEW_SIZE / 2 - size);
        ctx.lineTo(VIEW_SIZE / 2 + size, VIEW_SIZE / 2 + size);
        ctx.moveTo(VIEW_SIZE / 2 + size, VIEW_SIZE / 2 - size);
        ctx.lineTo(VIEW_SIZE / 2 - size, VIEW_SIZE / 2 + size);
        ctx.stroke();
        setHitMarkerLife(prev => Math.max(0, prev - 0.1));
      }

      // Red Dot logic
      let isOverEnemy = false;
      if (player) {
        gameState.players.forEach(p => {
          if (p.id === 'player') return;
          const dist = Math.sqrt((p.x - (player.x + Math.cos(player.angle) * 100)) ** 2 + (p.y - (player.y + Math.sin(player.angle) * 100)) ** 2);
          if (dist < 40) isOverEnemy = true;
        });
      }

      // Crosshair
      ctx.strokeStyle = isOverEnemy ? '#ff0000' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(VIEW_SIZE / 2, VIEW_SIZE / 2, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(VIEW_SIZE / 2, VIEW_SIZE / 2 - 10); ctx.lineTo(VIEW_SIZE / 2, VIEW_SIZE / 2 - 15);
      ctx.moveTo(VIEW_SIZE / 2, VIEW_SIZE / 2 + 10); ctx.lineTo(VIEW_SIZE / 2, VIEW_SIZE / 2 + 15);
      ctx.moveTo(VIEW_SIZE / 2 - 10, VIEW_SIZE / 2); ctx.lineTo(VIEW_SIZE / 2 - 15, VIEW_SIZE / 2);
      ctx.moveTo(VIEW_SIZE / 2 + 10, VIEW_SIZE / 2); ctx.lineTo(VIEW_SIZE / 2 + 15, VIEW_SIZE / 2);
      ctx.stroke();

      // Draw Players
      gameState.players.forEach(p => {
        ctx.save();
        ctx.translate(p.x + offsetX, p.y + offsetY);
        ctx.rotate(p.angle);

        // Body
        ctx.fillStyle = p.isBot ? '#555' : '#ff6b00';
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        
        // Weapon
        ctx.fillStyle = '#333';
        ctx.fillRect(15, -5, 30, 10);

        ctx.restore();

        // Health Bar
        ctx.fillStyle = '#000';
        ctx.fillRect(p.x + offsetX - 20, p.y + offsetY - 35, 40, 5);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(p.x + offsetX - 20, p.y + offsetY - 35, 40 * (p.health / p.maxHealth), 5);
      });
    };

    render();
  }, [gameState]);

  const player = gameState.players.find(p => p.id === 'player');

  return (
    <div ref={containerRef} className="relative h-screen w-screen flex items-center justify-center bg-[#050505] overflow-hidden touch-none">
      <div ref={threeContainerRef} className="absolute inset-0 z-0" />
      
      <canvas
        ref={canvasRef}
        width={VIEW_SIZE}
        height={VIEW_SIZE}
        className="hidden"
      />

      {/* Mobile Controls */}
      {isTouch && !gameState.isGameOver && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Joystick Area */}
          <div 
            className="absolute bottom-12 left-12 w-32 h-32 bg-white/10 rounded-full border-2 border-white/20 pointer-events-auto flex items-center justify-center"
            onTouchStart={(e) => {
              // Simple D-pad logic
              keysRef.current.add('w');
            }}
            onTouchEnd={() => {
              keysRef.current.clear();
            }}
          >
            <div className="w-12 h-12 bg-white/40 rounded-full" />
          </div>

          {/* Shoot Button */}
          <button 
            className="absolute bottom-12 right-12 w-24 h-24 bg-ff-orange/80 rounded-full border-4 border-white/40 pointer-events-auto flex items-center justify-center active:scale-90 transition-transform"
            onTouchStart={() => isShootingRef.current = true}
            onTouchEnd={() => isShootingRef.current = false}
          >
            <Crosshair size={40} className="text-white" />
          </button>
        </div>
      )}

      {/* Damage Flash */}
      {damageFlash > 0 && (
        <div 
          className="absolute inset-0 pointer-events-none bg-red-600/20"
          style={{ opacity: damageFlash }}
          onAnimationEnd={() => setDamageFlash(0)}
        />
      )}

      {/* HUD */}
      <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between font-sans">
        {/* Top Bar */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <div className="flex gap-3">
              <div className="bg-black/80 backdrop-blur-md px-5 py-2 rounded-full border border-ff-orange/30 flex items-center gap-2 shadow-[0_0_15px_rgba(255,107,0,0.2)]">
                <Users size={18} className="text-ff-orange" />
                <span className="font-black text-white text-sm tracking-widest">{gameState.players.length}</span>
              </div>
              <div className="bg-black/80 backdrop-blur-md px-5 py-2 rounded-full border border-red-500/30 flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                <Skull size={18} className="text-red-500" />
                <span className="font-black text-white text-sm tracking-widest">{player?.kills || 0}</span>
              </div>
            </div>
            {/* FPS / Ping Mock */}
            <div className="flex gap-4 px-2">
              <span className="text-[10px] text-emerald-400 font-bold">PING: 24ms</span>
              <span className="text-[10px] text-white/40 font-bold">FPS: 60</span>
            </div>
          </div>

          {/* Kill Feed */}
          <div className="flex flex-col gap-2 items-end max-w-[200px]">
            <AnimatePresence>
              {gameState.killFeed.map(kill => (
                <motion.div
                  key={kill.id}
                  initial={{ opacity: 0, x: 50, scale: 0.8 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="bg-gradient-to-l from-black/80 to-transparent pl-8 pr-4 py-1.5 rounded-l-full text-[11px] font-black text-white flex items-center gap-3 border-r-2 border-ff-orange"
                >
                  <span className={kill.killer === 'YOU' ? 'text-ff-orange' : 'text-white'}>{kill.killer}</span>
                  <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                    <Skull size={10} className="text-white" />
                  </div>
                  <span className={kill.victim === 'YOU' ? 'text-red-500' : 'text-white'}>{kill.victim}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
          
          {/* Map */}
          <div className="relative group self-end">
            <div className="absolute -inset-1 bg-gradient-to-r from-ff-orange to-red-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-black/80 backdrop-blur-xl p-3 rounded-lg border border-white/10 w-32 h-32 flex flex-col items-center justify-center">
              <MapIcon size={40} className="text-ff-orange/40 mb-2" />
              <div className="text-[10px] uppercase font-black text-ff-orange tracking-tighter">BERMUDA MAX</div>
              <div className="text-[8px] text-white/40 font-bold mt-1">SECTOR 7G</div>
            </div>
          </div>

        {/* Bottom Bar */}
        <div className="flex justify-between items-end">
          <div className="w-80">
            {/* Character Name */}
            <div className="text-white font-black text-xs mb-2 tracking-widest flex items-center gap-2">
              <div className="w-1 h-4 bg-ff-orange" />
              ELITE_SOLDIER_2026
            </div>
            
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-red-500/20 p-2 rounded-lg border border-red-500/40">
                <Heart className="text-red-500 fill-red-500" size={24} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-[10px] font-black text-white/60 mb-1 tracking-tighter">
                  <span>HP</span>
                  <span>{Math.ceil(player?.health || 0)} / 200</span>
                </div>
                <div className="h-4 bg-black/80 rounded-sm overflow-hidden border border-white/10 p-[2px]">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-red-600 via-red-500 to-orange-400 rounded-sm"
                    initial={{ width: '100%' }}
                    animate={{ width: `${(player?.health || 0) / (player?.maxHealth || 100) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 50 }}
                  />
                </div>
              </div>
            </div>

            {/* EP Bar (Energy Points) */}
            <div className="flex items-center gap-3">
              <div className="bg-yellow-500/20 p-2 rounded-lg border border-yellow-500/40">
                <Zap className="text-yellow-500 fill-yellow-500" size={24} />
              </div>
              <div className="flex-1">
                <div className="h-2 bg-black/80 rounded-sm overflow-hidden border border-white/10">
                  <div className="h-full w-3/4 bg-gradient-to-r from-yellow-600 to-yellow-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Weapon & Ammo */}
          <div className="bg-gradient-to-t from-black/90 to-black/40 backdrop-blur-2xl p-6 rounded-2xl border border-white/10 flex flex-col items-end min-w-[200px] shadow-2xl">
            <div className="text-ff-orange font-black text-2xl tracking-tighter mb-1 italic">
              {player ? WEAPONS[player.weapon].name : '---'}
            </div>
            <div className="flex items-end gap-3">
              <span className="text-white font-black text-5xl tracking-tighter leading-none">
                {player?.ammo || 0}
              </span>
              <span className="text-white/40 font-black text-xl mb-1 border-l border-white/20 pl-3">
                999
              </span>
            </div>
            <div className="mt-4 flex gap-1">
              {[1, 2, 3].map(i => (
                <div key={i} className={`w-8 h-1 rounded-full ${player?.weapon === ['pistol', 'rifle', 'shotgun'][i-1] ? 'bg-ff-orange' : 'bg-white/10'}`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Game Over Overlay */}
      <AnimatePresence>
        {gameState.isGameOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center z-50 p-12"
          >
            <motion.div
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="text-center"
            >
              <h2 className={`text-9xl font-black italic tracking-tighter mb-4 drop-shadow-[0_0_30px_rgba(255,107,0,0.5)] ${
                gameState.winner === 'BOOYAH!' ? 'text-ff-orange' : 'text-red-600'
              }`}>
                {gameState.winner}
              </h2>
              <p className="text-white/60 uppercase tracking-[1em] font-black mb-12 text-sm">
                {gameState.winner === 'BOOYAH!' ? 'ULTIMATE VICTORY' : 'MISSION FAILED'}
              </p>
              
              <div className="grid grid-cols-2 gap-8 mb-12">
                <div className="bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-md">
                  <div className="text-ff-orange text-[10px] uppercase font-black mb-2 tracking-widest">Eliminations</div>
                  <div className="text-5xl font-black text-white">{player?.kills || 0}</div>
                </div>
                <div className="bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-md">
                  <div className="text-ff-orange text-[10px] uppercase font-black mb-2 tracking-widest">Survival Rank</div>
                  <div className="text-5xl font-black text-white">#1</div>
                </div>
              </div>

              <button
                onClick={() => window.location.reload()}
                className="group relative px-16 py-5 bg-ff-orange text-white font-black italic text-2xl rounded-xl hover:scale-105 transition-all shadow-[0_0_50px_rgba(255,107,0,0.3)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
                RETURN TO LOBBY
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls Hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-white/20 font-bold">
        WASD to Move • Mouse to Aim • Click to Shoot
      </div>
    </div>
  );
};
