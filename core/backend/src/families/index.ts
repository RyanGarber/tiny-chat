import { type ModelArg } from '../types.ts';

export interface Family {
  getArgs: (model: string) => ModelArg[];
}
