export enum FieldType {
  Text,
  Lookup,
}

export interface IField {
  type: FieldType;
}

export interface ITextField extends IField {
  type: FieldType.Text;
}

export interface ILookupField extends IField {
  type: FieldType.Lookup;
  datasheet_id: string;
  field_id: string;
}

export type Field = ITextField | ILookupField;
