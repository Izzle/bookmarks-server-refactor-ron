/*eslint-env node, mocha */
const knex = require('knex');
const app = require('../src/app');

const fixtures = require('./bookmarks.fixture');
const store = require('../src/store');
const { PORT } = require('../src/config');

describe('Bookmarks Endpoints', function() {
  let db;

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL
    });
    app.set('db', db); // Tests skip server.js, but our app instance expects there to be a 'db' instance
  });

  after('disconnect from db', () => db.destroy());

  before('clean the table', () => db('bookmarks_table').truncate());

  afterEach('cleanup', () => db('bookmarks_table').truncate());

  describe('GET /bookmarks', () => {
    context('Given an Unauthorized request', () => {
      it('responds 401 and Unauthorized request', () => {
        return supertest(app)
          .get('/bookmarks')
          .expect(401, { error: 'Unauthorized request' });
      });
    });

    context('Given no bookmarks', () => {
      it('responds 200 and an empty list', () => {
        return supertest(app)
          .get('/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200, []);
      });
    });

    context('Given there are are bookmarks in the database', () => {
      const testBookmarks = fixtures.makeBookmarksArray();

      beforeEach('insert bookmarks', () => {
        return db
          .into('bookmarks_table')
          .insert(testBookmarks);
      });

      it('responds with 200 and all of the bookmarks', () => {
        return supertest(app)
          .get('/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200, testBookmarks);
      });
    });
  });

  describe('GET /bookmarks/:id', () => {
    context('Given an Unauthorized request', () => {
      it('responds 401 and Unauthorized request', () => {
        // this works now because there is some data in our store, but after we update our POST it may not work anymore
        const thirdBookmark = store.bookmarks[2];
        return supertest(app)
          .get(`/bookmarks/${thirdBookmark}`)
          .expect(401, { error: 'Unauthorized request' });
      });
    });

    context('Given no bookmarks', () => {
      it(`responds 404 and 'Bookmark not found'`, () => { // eslint-disable-line quotes
        const bookmarkId = 1234567890;
        return supertest(app)
          .get(`/bookmarks/${bookmarkId}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(404, { error: { message: 'Bookmark not found' }});
      });
    });

    context('Given there are bookmarks in the database', () => {
      const testBookmarks = fixtures.makeBookmarksArray();

      beforeEach('insert bookmarks', () => {
        return db
          .into('bookmarks_table')
          .insert(testBookmarks);
      });

      it('responds 200 with the specificed bookmark', () => {
        const bookmarkId = 2;
        const expectedBookmark = testBookmarks[bookmarkId - 1];
        return supertest(app)
          .get(`/bookmarks/${bookmarkId}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200, expectedBookmark);
      });
    });

    context('Give an XSS attack bookmark', () => {
      const maliciousBookmark = fixtures.makeMaliciousBookmark();

      beforeEach('insert malicious bookmark', () => {
        return db
          .into('bookmarks_table')
          .insert([ maliciousBookmark ]);
      });

      it('removes XSS attack content', () => {
        return supertest(app)
          .get(`/bookmarks/${maliciousBookmark.id}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200)
          .expect(res => {
            expect(res.body.title).to.eql('Ur haxxed! &lt;script&gt;alert(\"xss\");&lt;/script&gt;');
            expect(res.body.url).to.eql('https://www.ninjaz4lyfe.com');
            expect(res.body.description).to.eql(`Bad image <img src="https://url.to.file.which/does-not.exist">. But not <strong>all</strong> bad.`);
            expect(res.body.rating).to.equal(5);
          });

      });
    });
  });

  describe('POST /bookmarks', () => {
    it('creates a bookmark, responding with 201 and the new bookmark', () => {
      const newBookmark = fixtures.makeValidBookmark();
      delete newBookmark.id; // not needed for a POST request. We want a totally valid POST request here

      return supertest(app)
        .post('/bookmarks')
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .send(newBookmark)
        .expect(201)
        .expect(res => {
          expect(res.body.title).to.eql(newBookmark.title);
          expect(res.body.url).to.eql(newBookmark.url);
          expect(res.body.description).to.eql(newBookmark.description);
          expect(res.body.rating).to.eql(newBookmark.rating);
          expect(res.body).to.have.property('id');
          expect(res.headers.location).to.eql(`http://localhost:${PORT}/bookmarks/${res.body.id}`);
          return db('bookmarks_table')
            .where({ id: res.body.id })
            .first()
            .then(res => expect(res).to.exist);
        });
    });

    context('Given incorrect field values', () => {
      it(`it responds 400 and 'rating' must be a number`, () => { // eslint-disable-line quotes
        const invalidBookmark = fixtures.makeValidBookmark();
        delete invalidBookmark.id; // not needed for a POST request. We dont accept it anyways, but we are only trying to test the numbers here
        invalidBookmark.rating = 'lol not a number yo';

        return supertest(app)
          .post('/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .send(invalidBookmark)
          .expect(400, {  error: { message: `'rating' must be a number`} }); // eslint-disable-line quotes

      }); // error: { message: `'rating' must be a number`}
    });

    context('Given there are required fields', () => {
      const requiredFields = ['title', 'url', 'rating'];

      // For each required field, we create a newBookmark, delete that field, and run the test on it
      requiredFields.forEach(field => {
        const newBookmark = {
          title: 'Google',
          url: 'https://www.google.com',
          rating: '4'
        };

        it(`responds with 400 and an error message when the ${field} is missing`, () => {
          delete newBookmark[field];

          return supertest(app)
            .post('/bookmarks')
            .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
            .send(newBookmark)
            .expect(400, {  error: { message: `Missing ${field} in request body`} });
        });

      });
    });
  });
});