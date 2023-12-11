import { Field } from './field'

export interface IRecord {
  data: {
    [fieldId: string]: string
  };
}

export interface IView {
  rows: string[]
}

export interface IDatasheet {
  id: string
  revision: number
  field_map: {
    [fieldId: string]: Field
  }
  views: IView[]
  records: {
    [recordId: string]: IRecord
  }
}

export class Datasheet implements IDatasheet {
  id: string
  revision: number
  field_map: {
    [fieldId: string]: Field
  }
  views: IView[]
  records: {
    [recordId: string]: IRecord
  }

  constructor(id: string) {
    this.id = id
    this.revision = 0
    this.field_map = {}
    this.views = []
    this.records = {}
  }

  public static getDefaultView(datasheet: Datasheet) {
    return datasheet.views[0]!
  }

  public static getFieldById(datasheet: Datasheet, fieldId: string) {
    return datasheet.field_map[fieldId]!
  }
}

export interface Context {
  datasheetMap: {
    [datasheet_id: string]: Datasheet
  };
}
