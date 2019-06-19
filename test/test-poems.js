'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const jwt = require('jsonwebtoken');

const { app, runServer, closeServer } = require('../server');
const { User } = require('../users');
const { PoemTitle, PoemStanza } = require('../poem-routing');
const { JWT_SECRET, TEST_DATABASE_URL } = require('../config');

const expect = chai.expect;

// This let's us make HTTP requests
// in our tests.
// see: https://github.com/chaijs/chai-http
chai.use(chaiHttp);

describe('Protected endpoint', function () {
    const username = 'exampleUser';
    const password = 'examplePass';
    const firstName = 'Example';
    const lastName = 'User';

    const newPoemOne = {
        "title": "Test Title for Tests One"
    };
    const newPoemTwo = {
        "title": "Test Title for Tests Two"
    };
    const newPoemThree = {
        "title": "Test Title for Tests Three"
    };


  before(function () {
    return runServer(TEST_DATABASE_URL);
  });

  after(function () {
    return closeServer();
  });

  beforeEach(function () {
    return User.hashPassword(password).then(password => {
        User.create({
            username,
            password,
            firstName,
            lastName
        });
        PoemTitle.create(newPoemOne);
        PoemTitle.create(newPoemTwo);
        PoemTitle.create(newPoemThree);
    });
  });

  afterEach(function () {
    return PoemTitle.remove({}).then(() => User.remove({}));
  });

  describe('/api/poems', function () {
    it('Should reject requests with no credentials', function () {
      return chai
        .request(app)
        .get('/api/poems/title')
        .then(() =>
          expect.fail(null, null, 'Request should not succeed')
        )
        .catch(err => {
          if (err instanceof chai.AssertionError) {
            throw err;
          }

          const res = err.response;
          expect(res).to.have.status(401);
        });
    });

    it('Should reject requests with an invalid token', function () {
      const token = jwt.sign(
        {
          username,
          firstName,
          lastName
        },
        'wrongSecret',
        {
          algorithm: 'HS256',
          expiresIn: '7d'
        }
      );

      return chai
        .request(app)
        .get('/api/poems/title')
        .set('Authorization', `Bearer ${token}`)
        .then(() =>
          expect.fail(null, null, 'Request should not succeed')
        )
        .catch(err => {
          if (err instanceof chai.AssertionError) {
            throw err;
          }

          const res = err.response;
          expect(res).to.have.status(401);
        });
    });
    it('Should reject requests with an expired token', function () {
      const token = jwt.sign(
        {
          user: {
            username,
            firstName,
            lastName
          },
          exp: Math.floor(Date.now() / 1000) - 10 // Expired ten seconds ago
        },
        JWT_SECRET,
        {
          algorithm: 'HS256',
          subject: username
        }
      );

      return chai
        .request(app)
        .get('/api/poems/title')
        .set('authorization', `Bearer ${token}`)
        .then(() =>
          expect.fail(null, null, 'Request should not succeed')
        )
        .catch(err => {
          if (err instanceof chai.AssertionError) {
            throw err;
          }

          const res = err.response;
          expect(res).to.have.status(401);
        });
    });
    it('Should test some protected poem data', function () {
      const token = jwt.sign(
        {
          user: {
            username,
            firstName,
            lastName
          }
        },
        JWT_SECRET,
        {
          algorithm: 'HS256',
          subject: username,
          expiresIn: '7d'
        }
      );

      return chai
        .request(app)
        .get('/api/poems/poemPocket')
        .set('authorization', `Bearer ${token}`)
        .then(res => {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('array');
          expect(res.body[0].title).to.equal('Test Title for Tests One');
          expect(res.body[1].title).to.equal('Test Title for Tests Two');
          expect(res.body[2].title).to.equal('Test Title for Tests Three');
          (res.body).map((dates) => {expect(dates.date).to.contain('2019')});
        });
    });
  });
});