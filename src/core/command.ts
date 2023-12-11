import { v4 as uuidv4 } from 'uuid'
import { DataSheet } from './index'


export interface ICommand {
  type: 'CREATE_ROW' | 'UPDATE_CELLVALUE'
  args: string[]
}

export type ChangeLog = {
  datasheetId: string
  revision: number
  command: ICommand
};

export class Command {
  args: string[]

  public static from(command: ICommand) {
    switch (command.type) {
      case 'CREATE_ROW':
        return new CreateRowCommand(command.args)
      case 'UPDATE_CELLVALUE':
        return new UpdateCellValueCommand(command.args)
    }
  }
}

export class CreateRowCommand extends Command {
  args: string[]

  constructor(args: string[]) {
    super()
    if (args.length !== 0) {
      throw new Error('CREATE_ROW args length error')
    }
    this.args = args
  }
}

export class UpdateCellValueCommand extends Command {
  args: string[]

  constructor(args: string[]) {
    super()
    console.log(args)
    if (args.length !== 3) {
      throw new Error('UPDATE_CELLVALUE args length error')
    }
    this.args = args
  }

  public get recordId() {
    return this.args[0]
  }

  public get fieldId() {
    return this.args[1]
  }

  public get value() {
    return this.args[2]
  }
}

export const applyChangeLog = (datasheet: DataSheet, changeLog: ChangeLog) => {
  const command = Command.from(changeLog.command)
  if (command instanceof CreateRowCommand) {
    createRow(datasheet)
  } else if (command instanceof UpdateCellValueCommand) {
    updateCellValue(datasheet, command)
  }
  datasheet.revision = changeLog.revision
}

const createRow = (datasheet: DataSheet) => {
  let newId = nextId()
  DataSheet.getDefaultView(datasheet).rows.push(newId)
  datasheet.records[newId] = {data: {}}
}

const updateCellValue = (datasheet: DataSheet, command: UpdateCellValueCommand) => {
  datasheet.records[command.recordId].data[command.fieldId] = command.value
}

const nextId = () => {
  return uuidv4()
}
