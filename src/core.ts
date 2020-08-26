export * from './models';

/**
* Resolves reference from raw values.
*/
export function resolveRef(ref: string, rawValues: any): any {

  const segments = ref.split('.');
  let currentRef: any = rawValues;

  for ( const segment of segments ) {

    if ( currentRef === undefined ) return undefined;

    currentRef = currentRef[segment];

  }

  return currentRef;

}
