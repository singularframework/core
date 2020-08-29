export type PipeFunction = (value: any, rawValues?: any) => Omit<void, any>;
export type AsyncPipeFunction = (value: any, rawValues?: any) => Promise<Omit<void, any>>;
export type ValidatorFunction = (value: any, rawValues?: any) => boolean|Error;
export type AsyncValidatorFunction = (value: any, rawValues?: any) => Promise<boolean|Error>;

export interface ExecutableValidators {

  __exec(): AsyncValidatorFunction;

}

export interface ExecutablePipes {

  __exec(): AsyncPipeFunction;

}

export interface BodyValidationDefinition {

  [key: string]: AsyncValidatorFunction|ValidatorFunction|BodyValidationDefinition|ExecutableValidators;

}

export interface ValidationDefinition {

  [key: string]: AsyncValidatorFunction|ValidatorFunction|ExecutableValidators;

}
