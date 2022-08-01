import { quat, vec3 } from 'gl-matrix';
import { defs } from "../client/shared/defs.js";

export class Action_Attack {
  onAction: any;
  time: any;
  cooldown: any;
  timeElapsed: number;
  constructor(time, cooldown, onAction) {
    this.onAction = onAction;
    this.time = time;
    this.cooldown = cooldown;
    this.timeElapsed = 0.0;
  }

  get Finished() {
    return this.timeElapsed > this.cooldown;
  }

  Update(timeElapsed) {
    const oldTimeElapsed = this.timeElapsed;
    this.timeElapsed += timeElapsed;
    if (this.timeElapsed > this.time && oldTimeElapsed <= this.time) {
      this.onAction();
    }
  }
}

export class WorldEntity {
  id: any;
  state: string;
  position: vec3;
  rotation: import('gl-matrix').vec4;
  accountInfo: { name: any };
  characterDefinition: any;
  characterInfo: { class: any; inventory: any };
  stats: any;
  events: any[];
  grid: any;
  gridClient: any;
  updateTimer: number;
  action: any;
  constructor(params) {
    this.id = params.id;
    this.state = 'idle';
    this.position = vec3.clone(params.position);
    this.rotation = quat.clone(params.rotation);

    // HACK
    this.accountInfo = {
      name: params.account.accountName,
    };
    this.characterDefinition = params.character.definition;
    this.characterInfo = {
      class: params.character.class,
      inventory: { ...this.characterDefinition.inventory },
    };
    this.stats = { ...this.characterDefinition.stats };
    this.events = [];
    this.grid = params.grid;
    this.gridClient = this.grid.NewClient(
      [this.position[0], this.position[2]],
      [10, 10],
    );
    this.gridClient.entity = this;

    this.updateTimer = 0.0;
    this.action = null;
  }

  Destroy() {
    this.grid.Remove(this.gridClient);
    this.gridClient = null;
  }

  get ID() {
    return this.id;
  }

  get Valid() {
    return this.gridClient != null;
  }

  get Health() {
    return this.stats.health;
  }

  GetDescription() {
    return {
      account: this.accountInfo,
      character: this.characterInfo,
    };
  }

  CreatePlayerPacket() {
    return {
      id: this.ID,
      desc: this.GetDescription(),
      transform: this.CreateTransformPacket(),
    };
  }

  CreateStatsPacket() {
    return [this.ID, this.stats];
  }

  CreateEventsPacket() {
    return this.events;
  }

  CreateTransformPacket() {
    return [this.state, [...this.position], [...this.rotation]];
  }

  UpdateTransform(transformData) {
    if (this.stats.health <= 0) {
      this.SetState('death');
    }
    this.state = transformData[0];
    this.position = vec3.fromValues(...transformData[1] as [some: any, some2: any, some3: any]);
    this.rotation = quat.fromValues(...transformData[2] as [some: any, some2: any, some3: any, some4: any]);

    this.UpdateGridClient();
  }

  UpdateGridClient() {
    this.gridClient.position = [this.position[0], this.position[2]];
    this.grid.UpdateClient(this.gridClient);
  }

  UpdateInventory(inventory) {
    this.characterInfo.inventory = inventory;
  }

  OnActionAttack() {
    if (this.action) {
      return;
    }

    this.action = new Action_Attack(
      this.characterDefinition.attack.timing,
      this.characterDefinition.attack.cooldown,
      () => {
        this.OnActionAttack_Fired();
      },
    );
  }

  OnActionAttack_Fired() {
    // wheee hardcoded :(
    const nearby = this.FindNear(100, true);

    const Filter = (c) => {
      if (c.Health == 0) {
        return false;
      }

      const dist = vec3.distance(c.position, this.position);
      return dist <= this.characterDefinition.attack.range;
    };

    const attackable = nearby.filter(Filter);

    console.log(attackable);
    for (let a of attackable) {
      const target = a;

      const dirToTarget = vec3.create();
      vec3.sub(dirToTarget, target.position, this.position);
      vec3.normalize(dirToTarget, dirToTarget);

      const forward = vec3.fromValues(0, 0, 1);
      vec3.transformQuat(forward, forward, this.rotation);
      vec3.normalize(forward, forward);

      const dot = vec3.dot(forward, dirToTarget);
      if (dot < 0.9 || dot > 1.1) {
        continue;
      }

      // Calculate damage, use equipped weapon + whatever, this will be bad.
      let damage = 0;

      console.log('attacking: ' + target.accountInfo);

      if (this.characterDefinition.attack.type == 'melee') {
        damage = this.stats.strength / 5.0;

        const equipped = this.characterInfo.inventory['inventory-equip-1'];
        if (equipped) {
          console.log(' equipped: ' + equipped);
          const weapon = defs.WEAPONS_DATA[equipped];
          if (weapon) {
            damage *= weapon.damage * 10;
          }
        }
      } else {
        damage = this.stats.wisdomness / 10.0;
      }

      console.log(' damage: ' + damage);

      target.OnDamage(this, damage);

      this.onEvent('attack.damage', { target: target, damage: damage });
    }
  }
  onEvent(arg0: string, arg1: { target: any; damage: number; }) {
    throw new Error('Method not implemented.');
  }

  OnDamage(attacker, damage) {
    this.stats.health -= damage;
    this.stats.health = Math.max(0.0, this.stats.health);
    this.events.push({
      type: 'attack',
      target: this.ID,
      attacker: attacker.ID,
      amount: damage,
    });

    if (this.stats.health <= 0) {
      this.SetState('death');
    }
  }

  SetState(s) {
    if (this.state != 'death') {
      this.state = s;
    }
  }

  FindNear(radius, includeSelf) {
    let nearby = this.grid
      .FindNear([this.position[0], this.position[2]], [radius, radius])
      .map((c) => c.entity);

    if (!includeSelf) {
      const Filter = (e) => {
        return e.ID != this.ID;
      };
      nearby = nearby.filter(Filter);
    }
    return nearby;
  }

  Update(timeElapsed) {
    this.UpdateActions(timeElapsed);
  }

  UpdateActions(timeElapsed) {
    if (!this.action) {
      // Hack, again, should move this all through events
      if (this.state == 'attack') {
        this.SetState('idle');
      }
      return;
    }

    this.action.Update(timeElapsed);
    if (this.action.Finished) {
      this.action = null;
      this.SetState('idle');
    }
  }
}
