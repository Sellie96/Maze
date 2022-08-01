import { performance } from 'perf_hooks'
import { LoginQueue } from './login-queue';
import { WorldManager } from './world-manager'

export class SocketWrapper {
  socket: any
  onMessage: any;
  dead: boolean
  constructor(params) {
    this.socket = params.socket
    this.onMessage = null
    this.dead = false
    this.SetupSocket_()
  }

  get ID() {
    return this.socket.id
  }

  get IsAlive() {
    return !this.dead
  }

  SetupSocket_() {
    this.socket.on('user-connected', () => {
      console.log('socket.id: ' + this.socket.id)
    })
    this.socket.on('disconnect', () => {
      console.log('Client disconnected.')
      this.dead = true
    })
    this.socket.onAny((e, d) => {
      try {
        if (!this.onMessage(e, d)) {
          console.log('Unknown command (' + e + '), disconnected.')
          this.Disconnect()
        }
      } catch (err) {
        console.error(err)
        this.Disconnect()
      }
    })
  }

  Disconnect() {
    this.socket.disconnect(true)
  }

  Send(msg, data) {
    this.socket.emit(msg, data)
  }
}

export class WorldServer {
  loginQueue: any;
  worldMgr: any;
  constructor(io) {
    this.loginQueue = new LoginQueue((c, p) => {
      this.OnLogin_(c, p)
    })

    this.worldMgr = new WorldManager({ parent: this })
    this.SetupIO_(io)
  }

  SetupIO_(io) {
    io.on('connection', (socket) => {
      this.loginQueue.Add(new SocketWrapper({ socket: socket }))
    })
  }

  OnLogin_(client, params) {
    this.worldMgr.Add(client, params)
  }

  Run() {
    let t1 = performance.now()
    this.Schedule_(t1)
  }

  Schedule_(t1) {
    setTimeout(() => {
      let t2 = performance.now()
      this.Update_((t2 - t1) * 0.001)
      this.Schedule_(t2)
    })
  }

  Update_(timeElapsed) {
    this.worldMgr.Update(timeElapsed)
  }
}
