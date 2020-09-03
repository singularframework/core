export interface DecoyHistory {

  name: string;
  args?: any[];
  type: 'function'|'property-get'|'property-set';
  value?: any;

}
