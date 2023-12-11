import { Field } from './field'

export interface IRecord {
  data: {
    [fieldId: string]: string
  };
}

export interface IView {
  rows: string[]
}

export interface ShareDataSheet {
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

export class DataSheet implements ShareDataSheet {
  id: string
  revision: number
  field_map: {
    [fieldId: string]: Field
  }
  views: IView[]
  records: {
    [recordId: string]: IRecord
  }

  dependent_on: string[]

  constructor(id: string) {
    this.id = id
    this.dependent_on = []
    this.revision = 0
    this.field_map = {}
    this.views = []
    this.records = {}
  }

  public static getDefaultView(datasheet: DataSheet) {
    return datasheet.views[0]!
  }

  public static getFieldById(datasheet: DataSheet, fieldId: string) {
    return datasheet.field_map[fieldId]!
  }
}

export interface Context {
  datasheetMap: {
    [datasheet_id: string]: DataSheet
  };
}
