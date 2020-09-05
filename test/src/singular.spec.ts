import { Singular, BodyTransformationDefinition, BodyValidationDefinition } from '../../dist/core';
import { expect } from 'chai';

describe('Singular', function() {

  it('should transform objects correctly', async function() {

    // Flat target
    let def: BodyTransformationDefinition = {
      firstName: value => value.toLowerCase(),
      lastName: { __exec: () => async value => value.toLowerCase().trim() }
    };
    let target: any = {
      firstName: 'David',
      lastName: ' Blame '
    };

    target = await (<any>Singular).__transformObject(target, def, 1);

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

    target = await (<any>Singular).__transformObject(target, def);

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

    target = await (<any>Singular).__transformObject(target, def, 2);

    expect(target).to.deep.equal({
      magician: true,
      location: undefined,
      nested: {
        object: undefined
      }
    });

    // Direct transformer function
    target = {
      firstName: 'David',
      lastName: ' Blame '
    };

    target = await (<any>Singular).__transformObject(target, value => ({
      firstName: value.firstName.toLowerCase().trim(),
      lastName: value.lastName.toLowerCase().trim()
    }) ,1);

    expect(target).to.deep.equal({
      firstName: 'david',
      lastName: 'blame'
    });

    // Direct executable pipes
    target = {
      firstName: 'David',
      lastName: ' Blame '
    };

    target = await (<any>Singular).__transformObject(target, { __exec: () => async value => ({
      firstName: value.firstName.toLowerCase().trim(),
      lastName: value.lastName.toLowerCase().trim()
    }) } ,1);

    expect(target).to.deep.equal({
      firstName: 'david',
      lastName: 'blame'
    });

  });

  it('should validate objects correctly', async function() {

    // Flat object
    let target: any = {
      firstName: 'david',
      lastName: 'blame'
    };
    let def: BodyValidationDefinition = {
      firstName: async value => typeof value === 'string',
      lastName: { __exec: () => async (value, rawValues) => rawValues.firstName === 'david' }
    };

    let result = await (<any>Singular).__validateObject(target, 'body', def, 1);

    expect(result).to.be.undefined;

    target.firstName = true;

    result = await (<any>Singular).__validateObject(target, 'body', def, 1);

    expect(result instanceof Error).to.be.true;
    expect(result.message).to.equal('Invalid value for body property "firstName"!');

    // Nested object
    target = {
      magician: true,
      is: {
        absolutely: {
          crazy: true
        }
      }
    };
    def = {
      magician: value => typeof value === 'boolean',
      is: {
        absolutely: {
          crazy: value => typeof value === 'boolean'
        }
      }
    };

    result = await (<any>Singular).__validateObject(target, 'body', def);

    expect(result).to.be.undefined;

    // Object def on non-object value
    def = {
      magician: {
        successful: async value => typeof value === 'boolean'
      }
    };

    result = await (<any>Singular).__validateObject(target, 'body', def);

    expect(result instanceof Error).to.be.true;
    expect(result.message).to.equal('Invalid value for body property "magician"! Value must be an object.');

    // Recursion limitation
    target = {
      topLevel: true,
      nested: {
        value: false
      }
    };
    def = {
      topLevel: value => typeof value === 'boolean',
      nested: {
        value: value => value !== false
      }
    };

    result = await (<any>Singular).__validateObject(target, 'body', def, 1);

    expect(result).to.be.undefined;

    // Direct validator function and custom error message
    result = await (<any>Singular).__validateObject(target, 'body', value => value.topLevel ? new Error('Custom message!') : true, 1);

    expect(result instanceof Error).to.be.true;
    expect(result.message).to.equal('Custom message!');

    // Direct executable validators
    result = await (<any>Singular).__validateObject(target, 'header', { __exec: () => async value => !! value.nested.value });

    expect(result instanceof Error).to.be.true;
    expect(result.message).to.equal('Invalid value in headers!');

  });

});
