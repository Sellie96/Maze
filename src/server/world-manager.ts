import { defs } from "../client/shared/defs.js";
import { spatial_hash_grid } from "../client/shared/spatial-hash-grid.js";
import { terrain_height } from "../client/shared/terrain-height.js";
import { quat, vec3 } from 'gl-matrix';
import { WorldAIClient, WorldNetworkClient } from './world-client';
import { WorldEntity } from './world-entity';

export class MonsterSpawner {
  parent: any;
  grid: any;
  terrain: any;
  pos: any;
  params: any;
  entity: any;
  constructor(params) {
    this.parent = params.parent;
    this.grid = this.parent.grid;
    this.terrain = this.parent.terrain;
    this.pos = params.pos;
    this.pos[1] = this.terrain.Get(...params.pos)[0];
    this.params = params;
  }

  Spawn() {
    // Hack
    const e = new WorldEntity({
      id: this.parent.ids++,
      position: vec3.clone(this.pos),
      rotation: quat.fromValues(0, 0, 0, 1),
      grid: this.grid,
      character: {
        definition: defs.CHARACTER_MODELS[this.params.class],
        class: this.params.class,
      },
      account: { accountName: defs.CHARACTER_MODELS[this.params.class].name },
    });

    const wc = new WorldAIClient(e, this.terrain, () => {
      this.entity = null;
      console.log('entity gone, spawner making now one soon');
    });

    this.parent.AddMonster(wc);

    this.entity = wc;
  }

  Update(timeElapsed) {
    if (!this.entity) {
      this.Spawn();
    }
  }
}

const TICK_RATE = 0.01;

export class WorldManager {
  ids: number;
  entities: any[];
  grid: any;
  terrain: any;
  spawners: any[];
  tickTimer: number;
  params: any;
  constructor(params) {
    this.params = params;
    this.ids = 0;
    this.entities = [];
    this.grid = new spatial_hash_grid.SpatialHashGrid(
      [
        [-4000, -4000],
        [4000, 4000],
      ],
      [1000, 1000],
    );

    this.terrain = new terrain_height.HeightGenerator();

    this.spawners = [];
    this.tickTimer = 0.0;

    // Hack
    for (let x = 0; x <= 0; ++x) {
      for (let z = 0; z <= 0; ++z) {
        if (Math.random() < 0.1) {
          const pos = vec3.fromValues(x * 75, 0, z * 75);
          if (Math.random() < 0.1) {
            this.spawners.push(
              new MonsterSpawner({
                parent: this,
                pos: pos,
                class: 'warrok',
              }),
            );
          } else {
            this.spawners.push(
              new MonsterSpawner({
                parent: this,
                pos: pos,
                class: 'zombie',
              }),
            );
          }
        }
      }
    }
  }

  AddMonster(e) {
    this.entities.push(e);
  }

  Add(client, params) {
    const models = ['paladin'];
    const randomClass = models[Math.floor(Math.random() * models.length)];

    // Hack
    const e = new WorldEntity({
      id: this.ids++,
      position: vec3.fromValues(
        -60 + (Math.random() * 2 - 1) * 20,
        0,
        (Math.random() * 2 - 1) * 20,
      ),
      rotation: quat.fromValues(0, 0, 0, 1),
      grid: this.grid,
      character: {
        definition: defs.CHARACTER_MODELS[randomClass],
        class: randomClass,
      },
      account: params,
    });

    const wc = new WorldNetworkClient(client, e);

    this.entities.push(wc);

    wc.BroadcastChat({
      name: '',
      server: true,
      text: '[' + params.accountName + ' has entered the Maze]',
    });
  }

  Update(timeElapsed) {
    this.TickClientState(timeElapsed);
    this.UpdateEntities(timeElapsed);
    this.UpdateSpawners(timeElapsed);
  }

  TickClientState(timeElapsed) {
    this.tickTimer += timeElapsed;
    if (this.tickTimer < TICK_RATE) {
      return;
    }

    this.tickTimer = 0.0;

    for (let i = 0; i < this.entities.length; ++i) {
      this.entities[i].UpdateClientState();
    }
    for (let i = 0; i < this.entities.length; ++i) {
      this.entities[i].entity.events = [];
    }
  }

  UpdateSpawners(timeElapsed) {
    for (let i = 0; i < this.spawners.length; ++i) {
      this.spawners[i].Update(timeElapsed);
    }
  }

  UpdateEntities(timeElapsed) {
    const dead:any = [];
    const alive:any = [];

    for (let i = 0; i < this.entities.length; ++i) {
      const e = this.entities[i];

      e.Update(timeElapsed);

      if (e.IsDead) {
        console.log('killed it off');
        dead.push(e);
      } else {
        alive.push(e);
      }
    }

    this.entities = alive;

    for (let d of dead) {
      d.OnDeath();
      d.Destroy();
    }
  }
}
