import { quat, vec3 } from 'gl-matrix';


const TIMEOUT = 600.0;let position = 1;

export class WorldClient {
  entity: any;
  client: any;
  timeout: any;
  entityCache: {};
  position: number;
  constructor(client, entity) {
    this.entity = entity;

    this.position = 1;

    // Hack
    this.entity.onEvent = (t, d) => this.OnEntityEvent(t, d);

    this.client = client;
    this.client.onMessage = (e, d) => this.OnMessage(e, d);
    this.client.Send('world.player', this.entity.CreatePlayerPacket());
    this.client.Send('world.stats', this.entity.CreateStatsPacket());

    this.timeout = TIMEOUT;

    this.entityCache = {};

    // Hack
    entity.parent = this;
  }

  Destroy() {
    this.client.Disconnect();
    this.client = null;

    this.entity.Destroy();
    this.entity = null;
  }

  OnDeath() {}

  OnEntityEvent(t, d) {
    if (t == 'attack.damage') {
      this.OnDamageEvent(d);
    }
  }

  OnMessage(evt, data) {
    this.timeout = TIMEOUT;

    if (evt == 'world.update') {
      this.entity.UpdateTransform(data);
      return true;
    }

    if (evt == 'chat.msg') {
      this.OnChatMessage(data);
      return true;
    }

    if (evt == 'leaderboard.update') {
      this.OnLeaderboardUpdate(data, position);
      position += 1;
      return true;
    }

    if (evt == 'action.attack') {
      this.entity.OnActionAttack();
      return true;
    }

    if (evt == 'world.inventory') {
      this.OnInventoryChanged(data);
      return true;
    }

    return false;
  }

  OnDamageEvent(_) {}

  OnInventoryChanged(inventory) {
    this.entity.UpdateInventory(inventory);

    // Todo: Merge this into entityCache_ path.
    const nearby = this.entity.FindNear(50, true);

    for (let n of nearby) {
      n.parent.client.Send('world.inventory', [this.entity.ID, inventory]);
    }
  }

  OnChatMessage(message) {
    const chatMessage = {
      name: this.entity.accountInfo.name,
      text: message,
    };

    this.BroadcastChat(chatMessage);
  }

  OnLeaderboardUpdate(message, position) {
    let message2 = `${message}:  ${position}`;
    const chatMessage = {
      name: this.entity.accountInfo.name,
      text: message2,
    };

    this.BroadcastChat(chatMessage);
  }

  BroadcastChat(chatMessage) {
    const nearby = this.entity.FindNear(1000, true);

    for (let i = 0; i < nearby.length; ++i) {
      const n = nearby[i];
      n.parent.client.Send('chat.message', chatMessage);
    }
  }

  get IsDead() {
    return this.timeout <= 0.0;
  }

  OnUpdate(timeElapsed) {}

  OnUpdateClientState() {}

  UpdateClientState() {
    this.OnUpdateClientState();
  }

  Update(timeElapsed) {
    this.timeout -= timeElapsed;

    this.entity.Update(timeElapsed);

    this.OnUpdate(timeElapsed);
  }
}

export class WorldNetworkClient extends WorldClient {
  constructor(client, entity) {
    super(client, entity);
  }

  OnUpdate(timeElapsed) {}

  OnUpdateClientState() {
    const Filter = (e) => {
      return e.ID != this.entity.ID;
    };

    const nearby = this.entity.FindNear(500).filter((e) => Filter(e));

    const updates = [
      {
        id: this.entity.ID,
        stats: this.entity.CreateStatsPacket(),
        events: this.entity.CreateEventsPacket(),
      },
    ];
    const newCache = {};

    for (let n of nearby) {
      // We could easily trim this down based on what we know
      // this client saw last. Maybe do it later.
      const cur: any = {
        id: n.ID,
        transform: n.CreateTransformPacket(),
        stats: n.CreateStatsPacket(),
        events: n.CreateEventsPacket(),
      };

      if (!(n.ID in this.entityCache)) {
        cur.desc = n.GetDescription();
      }

      newCache[n.ID] = cur;
      updates.push(cur);
    }

    this.entityCache = newCache;

    this.client.Send('world.update', updates);
  }
}

class AIStateMachine {
  currentState: any;
  entity: any;
  terrain: any;
  constructor(entity, terrain) {
    this.currentState = null;
    this.entity = entity;
    this.terrain = terrain;
  }

  SetState(state) {
    const prevState = this.currentState;

    if (prevState) {
      if (prevState.constructor.name == state.constructor.name) {
        return;
      }
      prevState.Exit();
    }

    this.currentState = state;
    this.currentState.parent = this;
    this.currentState.entity = this.entity;
    this.currentState.terrain = this.terrain;
    state.Enter(prevState);
  }

  Update(timeElapsed) {
    if (this.currentState) {
      this.currentState.Update(timeElapsed);
    }
  }
}

class AIState {
  constructor() {}
  Exit() {}
  Enter() {}
  Update(timeElapsed) {}
}

class AIState_JustSitThere extends AIState {
  timer: number;
  entity: any;
  parent: any;
  params: any;
  constructor(params) {
    super();

    this.params = params

    this.timer = 0.0;
  }

  UpdateLogic() {
    const IsPlayer = (e) => {
      return !e.isAI;
    };
    const nearby = this.entity
      .FindNear(50.0)
      .filter((e) => e.Health > 0)
      .filter(IsPlayer);

    if (nearby.length > 0) {
      this.parent.SetState(new AIState_FollowToAttack(nearby[0]));
    }
  }

  Update(timeElapsed) {
    this.timer += timeElapsed;
    this.entity.SetState('idle');

    if (this.timer > 5.0) {
      this.UpdateLogic();
      this.timer = 0.0;
    }
  }
}

class AIState_FollowToAttack extends AIState {
  target: any;
  entity: any;
  terrain: any;
  parent: any;
  constructor(target) {
    super();
    this.target = target;
  }

  UpdateMovement(timeElapsed) {
    this.entity.state = 'walk';

    const direction = vec3.create();
    const forward = vec3.fromValues(0, 0, 1);

    vec3.sub(direction, this.target.position, this.entity.position);
    direction[1] = 0.0;


    vec3.normalize(direction, direction);
    quat.rotationTo(this.entity.rotation, forward, direction);

    const movement = vec3.clone(direction);
    vec3.scale(movement, movement, timeElapsed * 10.0);

    vec3.add(this.entity.position, this.entity.position, movement);

    this.entity.position[1] = this.terrain.Get(...this.entity.position)[0];
    this.entity.UpdateGridClient();

    const distance = vec3.distance(
      this.entity.position,
      this.target.position,
    );

    if (distance < 10.0) {
      this.entity.OnActionAttack();
      this.parent.SetState(new AIState_WaitAttackDone(this.target));
    } else if (distance > 100.0) {
      this.parent.SetState(new AIState_JustSitThere(this.target));
    }
  }

  Update(timeElapsed) {
    if (!this.target.Valid || this.target.Health == 0) {
      this.parent.SetState(new AIState_JustSitThere(this.target));
      return;
    }

    this.UpdateMovement(timeElapsed);
  }
}

class AIState_WaitAttackDone extends AIState {
  target: any;
  entity: any;
  parent: any;
  constructor(target) {
    super();
    this.target = target;
  }

  Update(_) {
    this.entity.state = 'attack';
    if (this.entity.action) {
      return;
    }

    this.parent.SetState(new AIState_FollowToAttack(this.target));
  }
}

class FakeClient {
  constructor() {}

  Send(msg, data) {}

  Disconnect() {}
}

export class WorldAIClient extends WorldClient {
  terrain: any;
  onDeath: any;
  fsm: AIStateMachine;
  deathTimer: number;
  constructor(entity, terrain, onDeath) {
    super(new FakeClient(), entity);
    this.terrain = terrain;
    this.onDeath = onDeath;

    this.entity.isAI = true;

    this.fsm = new AIStateMachine(entity, this.terrain);
    this.fsm.SetState(new AIState_JustSitThere(entity));

    this.deathTimer = 0.0;
  }

  get IsDead() {
    return this.deathTimer >= 30.0;
  }

  OnDeath() {
    this.onDeath();
  }

  OnUpdateClientState() {}

  OnUpdate(timeElapsed) {
    // Never times out
    this.timeout = 1000.0;

    if (this.entity.Health > 0) {
      this.fsm.Update(timeElapsed);
    } else {
      this.deathTimer += timeElapsed;
    }
  }
}
