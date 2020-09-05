import { Singular, BodyTransformationDefinition } from '../../dist/core';
import { expect } from 'chai';

describe('Singular', function() {

  it('should transform object correctly', async function() {

    // Flat target
    let def: BodyTransformationDefinition = {
      firstName: value => value.toLowerCase(),
      lastName: { __exec: () => async value => value.toLowerCase().trim() }
    };
    let target: any = {
      firstName: 'David',
      lastName: ' Blame '
    };

    target = await (<any>Singular).__transformObject(target, 'header', def, 1);

    expect(target).to.deep.equal({
      firstName: 'david',
      lastName: 'blame'
    });

    // Nested target
    def = {
      firstName: value => value.toLowerCase(),
      lastName: async value => value.toLowerCase().trim(),
      is: {
        absolutely: {
          what: value => value.trim(),
          // Virtual property
          insane: () => true
        }
      }
    };
    target = {
      firstName: 'David',
      lastName: ' Blame ',
      is: {
        absolutely: {
          what: ' crazy '
        }
      }
    };

    target = await (<any>Singular).__transformObject(target, 'header', def);

    expect(target).to.deep.equal({
      firstName: 'david',
      lastName: 'blame',
      is: {
        absolutely: {
          what: 'crazy',
          insane: true
        }
      }
    });

    // Object def on non-object value and recursion limitation
    def = {
      magician: value => ! value,
      location: {
        city: value => value
      },
      nested: {
        object: {
          name: value => value
        }
      }
    };
    target = {
      magician: false,
      location: 'Los Angeles',
      nested: {
        object: {
          name: 'Object'
        }
      }
    };

    target = await (<any>Singular).__transformObject(target, 'header', def, 2);

    expect(target).to.deep.equal({
      magician: true,
      location: undefined,
      nested: {
        object: undefined
      }
    });

  });

});
