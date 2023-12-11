import { Context } from './core/index'
import { ChangeLog } from './core/command'
import { WebSocket } from 'ws'

export class ServerSocket {
  watchMap: {
    [datasheet_id: string]: WebSocket[]
  }

  constructor() {
    this.watchMap = {}
  }

  public watch(ctx: Context, datasheetId: string, ws: WebSocket) {
    if (this.watchMap[datasheetId] === undefined) {
      this.watchMap[datasheetId] = []
    }
    this.watchMap[datasheetId].push(ws)
  }

  public broadcast(ctx: Context, datasheetId: string, changeLog: ChangeLog) {
    const watchList = this.watchMap[datasheetId]
    if (!watchList) {
      return
    }
    for (const ws of watchList) {
      ws.send(JSON.stringify(changeLog))
    }
  }
}
