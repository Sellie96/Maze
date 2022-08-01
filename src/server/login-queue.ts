export class FiniteStateMachine {
  currentState: any;
  onEvent: any;
  constructor(onEvent) {
    this.currentState = null;
    this.onEvent = onEvent;
  }

  get State() {
    return this.currentState;
  }

  Broadcast(evt) {
    this.onEvent(evt);
  }

  OnMessage(evt, data) {
    return this.currentState.OnMessage(evt, data);
  }

  SetState(state) {
    const prevState = this.currentState;

    if (prevState) {
      prevState.OnExit();
    }

    this.currentState = state;
    this.currentState.parent_ = this;
    state.OnEnter(prevState);
  }
}

export class State {
  parent_: any;
  constructor() {}

  Broadcast(evt) {
    this.parent_.Broadcast(evt);
  }

  OnEnter() {}

  OnMessage(some: any, some2: any) {}

  OnExit() {}
}

export class Login_Await extends State {
  params: any;
  parent_: any;
  constructor() {
    super();
    this.params = {};
  }

  OnMessage(evt: any, data: any) {
    if (evt != 'login.commit') {
      return false;
    }

    this.params.accountName = data;
    this.parent_.SetState(new Login_Confirm(this.params));

    return true;
  }
}

class Login_Confirm extends State {
  params: any;
  constructor(params) {
    super();
    this.params = { ...params };
  }

  OnEnter() {
    console.log('login confirmed: ' + this.params.accountName);
    this.Broadcast({ topic: 'login.complete', params: this.params });
  }

  OnMessage() {
    return true;
  }
}

export class LoginClient {
  onLogin: any;
  fsm: any;
  constructor(client, onLogin) {
    this.onLogin = onLogin;

    client.onMessage = (e, d) => this.OnMessage(e, d);

    this.fsm = new FiniteStateMachine((e) => {
      this.OnEvent(e);
    });
    this.fsm.SetState(new Login_Await());
  }

  OnEvent(evt) {
    this.onLogin(evt.params);
  }

  OnMessage(topic, data) {
    return this.fsm.OnMessage(topic, data);
  }
}

export class LoginQueue {
  clients: {};
  onLogin: any;
  constructor(onLogin) {
    this.clients = {};
    this.onLogin = onLogin;
  }

  Add(client) {
    this.clients[client.ID] = new LoginClient(client, (e) => {
      this.OnLogin(client, e);
    });
  }

  OnLogin(client, params) {
    delete this.clients[client.ID];

    this.onLogin(client, params);
  }
}
