export interface Player {
  id: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  ammo: number;
  isBot: boolean;
  angle: number;
  weapon: 'pistol' | 'rifle' | 'shotgun';
  kills: number;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
  damage: number;
}

export interface Loot {
  id: string;
  x: number;
  y: number;
  type: 'ammo' | 'medkit' | 'rifle' | 'shotgun';
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export interface KillEvent {
  id: string;
  killer: string;
  victim: string;
  time: number;
}

export interface GameState {
  players: Player[];
  bullets: Bullet[];
  loots: Loot[];
  floatingTexts: FloatingText[];
  killFeed: KillEvent[];
  zoneRadius: number;
  zoneX: number;
  zoneY: number;
  isGameOver: boolean;
  winner: string | null;
}
