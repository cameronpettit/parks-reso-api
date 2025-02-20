const { DocumentClient } = require('aws-sdk/clients/dynamodb');

const { REGION, ENDPOINT, TABLE_NAME } = require('./global/settings');

const ALGORITHM = process.env.ALGORITHM || 'HS384';

const ddb = new DocumentClient({
  region: REGION,
  endpoint: ENDPOINT,
  convertEmptyValues: true
});

const jwt = require('jsonwebtoken');

describe('Pass Fails', () => {
  beforeEach(async () => {
    await databaseOperation(1, 'setup');
  });

  afterEach(async () => {
    await databaseOperation(1, 'teardown');
  });

  test('Handler - 400 Bad Request - nothing passed in', async () => {
    const writePassHandler = require('../lambda/writePass/index');
    expect(await writePassHandler.handler(null, null)).toMatchObject({
      body: JSON.stringify({
        msg: 'There was an error in your submission.',
        title: 'Bad Request'
      }),
      headers: {
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'OPTIONS,GET',
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      statusCode: 400
    });
  });

  test('Handler - 400 Bad Request - Missing JWT', async () => {
    const writePassHandler = require('../lambda/writePass/index');
    const event = {
      headers: {
        Authorization: 'None'
      },
      body: JSON.stringify({
        parkOrcs: 'Test Park 1',
        firstName: '',
        lastName: '',
        facilityName: 'Parking lot A',
        email: '',
        date: '',
        type: '',
        numberOfGuests: '',
        phoneNumber: ''
        // Missing JWT
      })
    };
    expect(await writePassHandler.handler(event, null)).toMatchObject({
      body: JSON.stringify({
        msg: 'Missing CAPTCHA verification.',
        title: 'Missing CAPTCHA verification'
      }),
      headers: {
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'OPTIONS,GET',
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      statusCode: 400
    });
  });

  test('Handler - 400 Bad Request - JWT Invalid', async () => {
    const writePassHandler = require('../lambda/writePass/index');
    const event = {
      headers: {
        Authorization: 'None'
      },
      body: JSON.stringify({
        parkOrcs: 'Test Park 1',
        firstName: '',
        lastName: '',
        facilityName: 'Parking lot A',
        email: '',
        date: '',
        type: '',
        numberOfGuests: '',
        phoneNumber: '',
        captchaJwt: 'This is an invalid JWT'
      })
    };
    expect(await writePassHandler.handler(event, null)).toMatchObject({
      body: JSON.stringify({
        msg: 'CAPTCHA verification failed.',
        title: 'CAPTCHA verification failed'
      }),
      headers: {
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'OPTIONS,GET',
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      statusCode: 400
    });
  });

  test('Handler - 400 Bad Request - Trail pass limit maximum', async () => {
    const writePassHandler = require('../lambda/writePass/index');
    const token = jwt.sign(
      {
        data: 'verified',
        registrationNumber: '1111111111',
        facility: 'Trail B',
        orcs: 'Test Park 1'
      },
      'defaultSecret',
      {
        algorithm: ALGORITHM
      }
    );
    const event = {
      headers: {
        Authorization: 'None'
      },
      body: JSON.stringify({
        parkOrcs: 'Test Park 1',
        firstName: '',
        lastName: '',
        facilityName: 'Trail B',
        email: '',
        date: '',
        type: '',
        numberOfGuests: 5, // Too many
        phoneNumber: '',
        captchaJwt: token
      })
    };
    expect(await writePassHandler.handler(event, null)).toMatchObject({
      body: '{"msg":"You cannot have more than 4 guests on a trail.","title":"Too many guests"}',
      headers: {
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'OPTIONS,GET',
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      statusCode: 400
    });
  });

  test('Handler - 400 Bad Request - Invalid Date', async () => {
    const writePassHandler = require('../lambda/writePass/index');
    const token = jwt.sign(
      {
        data: 'verified',
        registrationNumber: '1111111112',
        facility: 'Trail B',
        orcs: 'Test Park 1'
      },
      'defaultSecret',
      {
        algorithm: ALGORITHM
      }
    );
    const event = {
      headers: {
        Authorization: 'None'
      },
      body: JSON.stringify({
        parkOrcs: '',
        firstName: '',
        lastName: '',
        facilityName: '',
        email: '',
        date: '',
        type: '',
        numberOfGuests: 1,
        phoneNumber: '',
        captchaJwt: token
      })
    };
    expect(await writePassHandler.handler(event, null)).toMatchObject({
      body: JSON.stringify({
        msg: 'Something went wrong.',
        title: 'Operation Failed'
      }),
      headers: {
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'OPTIONS,GET',
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      statusCode: 400
    });
  });

  test('Handler - 400 Bad Request - Booking date in the past', async () => {
    const writePassHandler = require('../lambda/writePass/index');
    const token = jwt.sign(
      {
        data: 'verified',
        registrationNumber: '1111111113',
        facility: 'Parking lot A',
        orcs: 'Test Park 1'
      },
      'defaultSecret',
      {
        algorithm: ALGORITHM
      }
    );
    const event = {
      headers: {
        Authorization: 'None'
      },
      body: JSON.stringify({
        parkOrcs: 'Test Park 1',
        firstName: '',
        lastName: '',
        facilityName: 'Parking lot A',
        email: '',
        date: '1970-01-01T00:00:00.758Z',
        type: '',
        numberOfGuests: 1,
        phoneNumber: '',
        captchaJwt: token
      })
    };
    expect(await writePassHandler.handler(event, null)).toMatchObject({
      body: JSON.stringify({
        msg: 'You cannot book for a date in the past.',
        title: 'Booking date in the past'
      }),
      headers: {
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'OPTIONS,GET',
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      statusCode: 400
    });
  });

  test('Handler - 400 Bad Request - One or more params are invalid.', async () => {
    const writePassHandler = require('../lambda/writePass/index');
    const token = jwt.sign(
      {
        data: 'verified',
        registrationNumber: '1111111114',
        facility: 'Trail B',
        orcs: 'Test Park 1'
      },
      'defaultSecret',
      {
        algorithm: ALGORITHM
      }
    );
    const event = {
      headers: {
        Authorization: 'None'
      },
      body: JSON.stringify({
        parkOrcs: '',
        firstName: '',
        lastName: '',
        facilityName: '',
        email: '',
        date: new Date(),
        type: '',
        numberOfGuests: 1,
        phoneNumber: '',
        captchaJwt: token
      })
    };
    expect(await writePassHandler.handler(event, null)).toMatchObject({
      body: JSON.stringify({
        msg: 'Something went wrong.',
        title: 'Operation Failed'
      }),
      headers: {
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'OPTIONS,GET',
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      statusCode: 400
    });
  });
});

describe('Pass Successes', () => {
  const OLD_ENV = process.env;
  beforeEach(async () => {
    jest.resetModules();
    process.env = { ...OLD_ENV }; // Make a copy of environment
    await databaseOperation(1, 'setup');
  });

  afterAll(() => {
    process.env = OLD_ENV; // Restore old environment
  });

  afterEach(async () => {
    await databaseOperation(1, 'teardown');
  });

  test('writePass warmup', async () => {
    const writePassHandler = require('../lambda/writePass/index').handler;
    const event = {
      warmup: true
    };
    const context = null;
    const response = await writePassHandler(event, context);
    expect(response.statusCode).toEqual(200);
  });

  test('writePass putPassHandler', async () => {
    const writePassHandler = require('../lambda/writePass/index').handler;
    jest.mock('../lambda/permissionUtil', () => {
      return {
        decodeJWT: jest.fn(event => {
          // console.log("STUB");
        }),
        resolvePermissions: jest.fn(token => {
          return {
            isAdmin: true,
            roles: ['sysasdmin'],
            isAuthenticated: true
          };
        })
      };
    });
    const token = jwt.sign({ foo: 'bar' }, 'shhhhh', { algorithm: ALGORITHM });
    let event = {
      httpMethod: 'PUT',
      headers: {
        Authorization: 'Bearer ' + token
      },
      queryStringParameters: {
        checkedIn: 'true'
      },
      body: JSON.stringify({
        pk: '0015',
        sk: '523456789'
      })
    };
    const context = null;
    let response = await writePassHandler(event, context);
    expect(response.statusCode).toEqual(200);

    let params = {
      TableName: TABLE_NAME,
      Key: {
        pk: 'pass::0015',
        sk: '523456789'
      }
    };

    let dbRes = await ddb.get(params).promise();
    expect(dbRes.Item?.checkedIn).toEqual(true);

    event = {
      httpMethod: 'PUT',
      headers: {
        Authorization: 'Bearer ' + token
      },
      queryStringParameters: {
        checkedIn: 'false'
      },
      body: JSON.stringify({
        pk: '0015',
        sk: '523456789'
      })
    };

    response = await writePassHandler(event, context);
    expect(response.statusCode).toEqual(200);

    dbRes = await ddb.get(params).promise();
    expect(dbRes.Item?.checkedIn).toEqual(false);

    event = {
      httpMethod: 'PUT',
      headers: {
        Authorization: 'Bearer ' + token
      },
      queryStringParameters: {
        checkedIn: 1234
      },
      body: JSON.stringify({
        pk: '0015',
        sk: '523456789'
      })
    };

    response = await writePassHandler(event, context);
    expect(response.statusCode).toEqual(400);
  });

  test('Handler - 200 pass has been created for a Trail.', async () => {
    const writePassHandler = require('../lambda/writePass/index');
    process.env.ADMIN_FRONTEND = 'http://localhost:4300';
    process.env.PASS_MANAGEMENT_ROUTE = '/pass-management';

    const token = jwt.sign(
      {
        data: 'verified',
        registrationNumber: '1111111115',
        facility: 'P1 and Lower P5',
        orcs: '0015'
      },
      'defaultSecret',
      {
        algorithm: ALGORITHM
      }
    );

    const event = {
      headers: {
        Authorization: 'None'
      },
      body: JSON.stringify({
        parkOrcs: '0015',
        firstName: 'Jest',
        lastName: 'User',
        facilityName: 'P1 and Lower P5',
        email: 'testEmail7@test.ca',
        date: new Date(),
        type: 'DAY',
        numberOfGuests: 1,
        phoneNumber: '2505555555',
        captchaJwt: token
      })
    };

    const response = await writePassHandler.handler(event, null);
    expect(response.statusCode).toEqual(200);
    const body = JSON.parse(response.body);
    expect(body.pk).toEqual('pass::0015');
    expect(typeof body.sk).toBe('string');
    expect(body.firstName).toEqual('Jest');
    expect(body.lastName).toEqual('User');
    expect(body.facilityName).toEqual('P1 and Lower P5');
    expect(body.email).toEqual('testEmail7@test.ca');
    expect(typeof body.date).toBe('string');
    expect(body.type).toEqual('DAY');
    expect(typeof body.registrationNumber).toBe('string');
    expect(body.numberOfGuests).toEqual(1);
    expect(['reserved', 'active']).toContain(body.passStatus);
    expect(body.phoneNumber).toEqual('2505555555');
    expect(body.facilityType).toEqual('Trail');
    expect(body.adminPassLink).toContain(`${process.env.ADMIN_FRONTEND}${process.env.PASS_MANAGEMENT_ROUTE}?park=0015`);
  });

  test('Handler - 200 pass has been created for a Parking Pass.', async () => {
    const writePassHandler = require('../lambda/writePass/index');

    const token = jwt.sign(
      {
        data: 'verified',
        registrationNumber: '1111111116',
        facility: 'Parking lot A',
        orcs: 'Test Park 1'
      },
      'defaultSecret',
      {
        algorithm: ALGORITHM
      }
    );

    const event = {
      headers: {
        Authorization: 'None'
      },
      body: JSON.stringify({
        parkOrcs: 'Test Park 1',
        firstName: 'Jest',
        lastName: 'User',
        facilityName: 'Parking lot A',
        email: 'testEmail2@test.ca',
        date: new Date(),
        type: 'DAY',
        numberOfGuests: 1,
        phoneNumber: '2505555555',
        facilityType: 'Parking',
        mapLink: 'http://maps.google.com',
        captchaJwt: token
      })
    };

    const response = await writePassHandler.handler(event, null);
    expect(response.statusCode).toEqual(200);
    const body = JSON.parse(response.body);
    expect(body.pk).toEqual('pass::Test Park 1');
    expect(typeof body.sk).toBe('string');
    expect(body.firstName).toEqual('Jest');
    expect(body.lastName).toEqual('User');
    expect(body.facilityName).toEqual('Parking lot A');
    expect(body.email).toEqual('testEmail2@test.ca');
    expect(typeof body.date).toBe('string');
    expect(body.type).toEqual('DAY');
    expect(typeof body.registrationNumber).toBe('string');
    expect(body.numberOfGuests).toEqual(1);
    expect(['reserved', 'active']).toContain(body.passStatus);
    expect(body.phoneNumber).toEqual('2505555555');
    expect(body.facilityType).toEqual('Parking');
  });

  test('Handler - 400 Number of guests cannot be less than 1.', async () => {
    const writePassHandler = require('../lambda/writePass/index');

    const token = jwt.sign(
      {
        data: 'verified',
        registrationNumber: '1111111117',
        facility: 'Trail B',
        orcs: 'Test Park 1'
      },
      'defaultSecret',
      {
        algorithm: ALGORITHM
      }
    );

    const event = {
      headers: {
        Authorization: 'None'
      },
      body: JSON.stringify({
        parkOrcs: 'Test Park 1',
        firstName: '',
        lastName: '',
        facilityName: 'Trail B',
        email: '',
        date: '',
        type: '',
        numberOfGuests: 0, // Too little
        phoneNumber: '',
        captchaJwt: token
      })
    };

    const response = await writePassHandler.handler(event, null);
    expect(response.statusCode).toEqual(400);
    const body = JSON.parse(response.body);
    expect(body.msg).toEqual('Passes must have at least 1 guest.');
    expect(body.title).toEqual('Invalid number of guests');
  });

  test('Expect checkWarmup function to fire.', async () => {
    const writePassHandler = require('../lambda/writePass/index');
    const event = {
      headers: {
        Authorization: 'None'
      },
      warmup: true
    };

    const response = await writePassHandler.handler(event, null);
    expect(response.statusCode).toEqual(200);
    const body = JSON.parse(response.body);
    expect(body).toEqual({});
  });

  test('Expect pass check in to fail 403.', async () => {
    // Mock the auth to be fail (This is the new method for mocking auth)
    jest.mock('../lambda/permissionUtil', () => {
      return {
        decodeJWT: jest.fn(event => {
          // console.log("STUB");
        }),
        resolvePermissions: jest.fn(token => {
          return {
            isAdmin: false,
            roles: ['badRole']
          };
        })
      };
    });
    const writePassHandler = require('../lambda/writePass/index');
    const event = {
      headers: {
        Authorization: 'None'
      },
      httpMethod: 'PUT',
      body: JSON.stringify({})
    };

    const response = await writePassHandler.handler(event, null);
    expect(response.statusCode).toEqual(403);
  });

  test('Expect pass to be checked in.', async () => {
    jest.mock('../lambda/permissionUtil', () => {
      return {
        decodeJWT: jest.fn(event => {
          // console.log("STUB");
        }),
        resolvePermissions: jest.fn(token => {
          return {
            isAdmin: true,
            roles: ['sysadmin'],
            isAuthenticated: true
          };
        })
      };
    });
    const writePassHandler = require('../lambda/writePass/index');
    const event = {
      httpMethod: 'PUT',
      body: JSON.stringify({
        pk: '0015',
        sk: '123456789'
      }),
      queryStringParameters: {
        checkedIn: 'true'
      }
    };

    const response = await writePassHandler.handler(event, null);
    const body = JSON.parse(response.body);
    expect(response.statusCode).toEqual(200);
    expect(body.checkedIn).toEqual(true);
  });

  test('Expect pass not to be checked in. 1', async () => {
    jest.mock('../lambda/permissionUtil', () => {
      return {
        decodeJWT: jest.fn(event => {
          // console.log("STUB");
        }),
        resolvePermissions: jest.fn(token => {
          return {
            isAdmin: false,
            roles: ['sysadmin'],
            isAuthenticated: false
          };
        })
      };
    });
    const writePassHandler = require('../lambda/writePass/index');
    const event = {
      httpMethod: 'PUT',
      body: JSON.stringify({
        pk: '0015',
        sk: '123456789'
      }),
      queryStringParameters: {
        checkedIn: 'false'
      }
    };

    const response = await writePassHandler.handler(event, null);
    expect(response.statusCode).toEqual(403);
  });

  test('Expect pass not to be checked in. 2', async () => {
    jest.mock('../lambda/permissionUtil', () => {
      return {
        decodeJWT: jest.fn(event => {
          // console.log("STUB");
        }),
        resolvePermissions: jest.fn(token => {
          return {
            isAdmin: false,
            roles: ['sysadmin'],
            isAuthenticated: false
          };
        })
      };
    });
    const writePassHandler = require('../lambda/writePass/index');
    const event = {
      httpMethod: 'PUT',
      body: JSON.stringify({
        sk: '123456789'
      }),
      queryStringParameters: {
        foo: 'false'
      }
    };

    const response = await writePassHandler.handler(event, null);
    expect(response.statusCode).toEqual(403);
  });

  test('Handler - 400 Captcha failed due to missing fields.', async () => {
    const writePassHandler = require('../lambda/writePass/index');

    const token = jwt.sign(
      {
        data: 'verified',
        registrationNumber: '1111111118',
        facility: undefined,
        orcs: 'Test Park 1'
      },
      'defaultSecret',
      {
        algorithm: ALGORITHM
      }
    );

    const event = {
      headers: {
        Authorization: 'None'
      },
      body: JSON.stringify({
        parkOrcs: 'Test Park 1',
        firstName: '',
        lastName: '',
        facilityName: 'Trail B',
        email: '',
        date: '',
        type: '',
        numberOfGuests: 0, // Too little
        phoneNumber: '',
        captchaJwt: token
      })
    };

    const response = await writePassHandler.handler(event, null);
    expect(response.statusCode).toEqual(400);
    const body = JSON.parse(response.body);
    expect(body.msg).toEqual('CAPTCHA verification failed.');
    expect(body.title).toEqual('CAPTCHA verification failed');
  });

  test('Handler - 400 pass exists according to token check.', async () => {
    const writePassHandler = require('../lambda/writePass/index');

    const token = jwt.sign(
      {
        data: 'verified',
        registrationNumber: '1111111119',
        facility: 'Parking lot A',
        orcs: 'Test Park 1'
      },
      'defaultSecret',
      {
        algorithm: ALGORITHM
      }
    );

    const event = {
      headers: {
        Authorization: 'None'
      },
      body: JSON.stringify({
        parkOrcs: 'Test Park 1',
        firstName: 'Bad',
        lastName: 'Guy',
        facilityName: 'Parking lot A',
        email: 'abc123@test.ca',
        date: new Date(),
        type: 'DAY',
        numberOfGuests: 1,
        phoneNumber: '2506666666',
        facilityType: 'Parking',
        mapLink: 'http://maps.google.com',
        captchaJwt: token
      })
    };

    let response = await writePassHandler.handler(event, null);
    expect(response.statusCode).toEqual(200);
    response = await writePassHandler.handler(event, null);
    expect(response.statusCode).toEqual(400);
    const body = JSON.parse(response.body);
    expect(body.msg).toEqual('This pass already exsits.');
    expect(body.title).toEqual('Pass exists');
  });
});

async function databaseOperation(version, mode) {
  if (version === 1) {
    if (mode === 'setup') {
      await ddb
        .put({
          TableName: TABLE_NAME,
          Item: {
            pk: 'config',
            sk: 'config',
            ENVIRONMENT: 'prod'
          }
        })
        .promise();

      await ddb
        .put({
          TableName: TABLE_NAME,
          Item: {
            pk: 'park',
            sk: 'Test Park 1',
            name: 'Test Park 1',
            description: '<p>My Description</p>',
            bcParksLink: 'http://google.ca',
            mapLink: 'https://maps.google.com',
            status: 'open',
            visible: true
          }
        })
        .promise();

      await ddb
        .put({
          TableName: TABLE_NAME,
          Item: {
            pk: 'park',
            sk: '0015',
            name: '0015',
            description: '<p>My Description</p>',
            bcParksLink: 'http://google.ca',
            mapLink: 'https://maps.google.com',
            status: 'open',
            visible: true
          }
        })
        .promise();

      // Example Pass
      await ddb
        .put({
          TableName: TABLE_NAME,
          Item: {
            pk: 'pass::0015',
            sk: '123456789',
            parkName: 'Test Park 1',
            firstName: 'First',
            searchFirstName: 'first',
            lastName: 'Last',
            searchLastName: 'last',
            facilityName: 'Parking lot A',
            email: 'noreply@gov.bc.ca',
            date: new Date('2012-01-01'),
            shortPassDate: '2012-01-01',
            type: 'DAY',
            registrationNumber: '123456789',
            numberOfGuests: '4',
            passStatus: 'active',
            phoneNumber: '5555555555',
            facilityType: 'Trail',
            isOverbooked: false,
            creationDate: new Date('2012-01-01'),
            dateUpdated: new Date('2012-01-01')
          }
        })
        .promise();

      await ddb
        .put({
          TableName: TABLE_NAME,
          Item: {
            pk: 'pass::0015',
            sk: '523456789',
            parkName: 'Test Park 1',
            firstName: 'First',
            searchFirstName: 'first',
            lastName: 'Last',
            searchLastName: 'last',
            facilityName: 'Parking lot A',
            email: 'noreply@gov.bc.ca',
            date: new Date('2012-01-01'),
            shortPassDate: '2012-01-01',
            type: 'DAY',
            registrationNumber: '123456789',
            numberOfGuests: '4',
            passStatus: 'active',
            phoneNumber: '5555555555',
            facilityType: 'Trail',
            isOverbooked: false,
            creationDate: new Date('2012-01-01'),
            dateUpdated: new Date('2012-01-01')
          }
        })
        .promise();

      await ddb
        .put({
          TableName: TABLE_NAME,
          Item: {
            pk: 'facility::Test Park 1',
            sk: 'Parking lot A',
            name: 'Parking lot A',
            description: 'A Parking Lot!',
            qrcode: true,
            isUpdating: false,
            type: 'Parking',
            bookingTimes: {
              AM: {
                max: 25
              },
              DAY: {
                max: 25
              }
            },
            bookingDays: {
              Sunday: true,
              Monday: true,
              Tuesday: true,
              Wednesday: true,
              Thursday: true,
              Friday: true,
              Saturday: true
            },
            bookingDaysRichText: '',
            bookableHolidays: [],
            status: { stateReason: '', state: 'open' },
            visible: true
          }
        })
        .promise();

      await ddb
        .put({
          TableName: TABLE_NAME,
          Item: {
            pk: 'facility::Test Park 1',
            sk: 'Trail B',
            name: 'Trail B',
            description: 'A Trail!',
            qrcode: true,
            isUpdating: false,
            type: 'Trail',
            bookingTimes: {
              AM: {
                max: 25
              },
              DAY: {
                max: 25
              }
            },
            bookingDays: {
              Sunday: true,
              Monday: true,
              Tuesday: true,
              Wednesday: true,
              Thursday: true,
              Friday: true,
              Saturday: true
            },
            bookingDaysRichText: '',
            bookableHolidays: [],
            status: { stateReason: '', state: 'open' },
            visible: true
          }
        })
        .promise();

      await ddb
        .put({
          TableName: TABLE_NAME,
          Item: {
            pk: 'facility::0015',
            sk: 'P1 and Lower P5',
            name: 'P1 and Lower P5',
            description: 'A Trail!',
            qrcode: true,
            isUpdating: false,
            type: 'Trail',
            bookingTimes: {
              AM: {
                max: 25
              },
              DAY: {
                max: 25
              }
            },
            bookingDays: {
              Sunday: true,
              Monday: true,
              Tuesday: true,
              Wednesday: true,
              Thursday: true,
              Friday: true,
              Saturday: true
            },
            bookingDaysRichText: '',
            bookableHolidays: [],
            status: { stateReason: '', state: 'open' },
            visible: true
          }
        })
        .promise();
    } else {
      console.log('Teardown');
      // Teardown
      await ddb
        .delete({
          TableName: TABLE_NAME,
          Key: {
            pk: 'park',
            sk: 'Test Park 1'
          }
        })
        .promise();
      await ddb
        .delete({
          TableName: TABLE_NAME,
          Key: {
            pk: 'facility::Test Park 1',
            sk: 'Parking lot A'
          }
        })
        .promise();
    }
  }
}
