const knex = require('knex');
const app = require('../src/app');
const fixtures = require('./bookmarks.fixture');
const store = require('../src/store');

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
      it(`responds 404 and 'Bookmark not found'`, () => {
        const bookmarkId = 1234567890;
        return supertest(app)
          .get(`/bookmarks/${bookmarkId}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(404, { error: { message: 'Bookmark not found' }});
      });
    });

    context('Given there are are bookmarks in the database', () => {
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
  });

  describe.only('POST /bookmarks', () => {
    it('creates a bookmark, responding with 201 and the new bookmark', () => {
      const newBookmark = {
        title: 'Firefox',
        url: 'https://www.firefox.com',
        description: 'Less ads than Chrome',
        rating: 5
      };
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
          return db('bookmarks_table')
            .where({ id: res.body.id })
            .first()
            .then(res => expect(res).to.exist);
        });
        // .then(postRes => {
        //   return db('bookmarks_table')
        //     .where({ id: postRes.body.id })
        //     .first()
        //     .then(res => expect(res).to.exist);
        // });
    });
  });
});