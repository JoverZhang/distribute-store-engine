import { IRecord } from './index'

export interface StoreProvider {
  getRecord(datasheetId: string, recordId: string): IRecord | null
}

export class StoreManager {
  private provider: StoreProvider

  constructor(provider: StoreProvider) {
    this.provider = provider
  }

  public getRecord(datasheetId: string, recordId: string) {
    return this.provider.getRecord(datasheetId, recordId)
  }
}
