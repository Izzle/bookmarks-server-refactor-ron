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

  describe('GET /api/bookmarks', () => {
    context('Given an Unauthorized request', () => {
      it('responds 401 and Unauthorized request', () => {
        return supertest(app)
          .get('/api/bookmarks')
          .expect(401, { error: 'Unauthorized request' });
      });
    });

    context('Given an XSS attack bookmark in the bookmarks array', () => {
      const testBookmarks = fixtures.makeBookmarksArray();
      const maliciousBookmark = fixtures.makeMaliciousBookmark();
      testBookmarks.push(maliciousBookmark);

      beforeEach('insert bookmarks with malicious bookmark', () => {
        return db
          .into('bookmarks_table')
          .insert(testBookmarks);
      });
  
      it('removes XSS attack content', () => {
        return supertest(app)
          .get('/api/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200)
          .expect(res => {
            expect(res.body[3].title).to.eql('Ur haxxed! &lt;script&gt;alert(\"xss\");&lt;/script&gt;');
            expect(res.body[3].url).to.eql('https://www.ninjaz4lyfe.com');
            expect(res.body[3].description).to.eql(`Bad image <img src="https://url.to.file.which/does-not.exist">. But not <strong>all</strong> bad.`); // eslint-disable-line quotes
            expect(res.body[3].rating).to.equal(5);
          });
  
      });
    });

    context('Given no bookmarks', () => {
      it('responds 200 and an empty list', () => {
        return supertest(app)
          .get('/api/bookmarks')
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
          .get('/api/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200, testBookmarks);
      });
    });
  });

  describe('GET /api/bookmarks/:id', () => {
    context('Given an Unauthorized request', () => {
      it('responds 401 and Unauthorized request', () => {
        // this works now because there is some data in our store, but after we update our POST it may not work anymore
        const thirdBookmark = store.bookmarks[2];
        return supertest(app)
          .get(`/api/bookmarks/${thirdBookmark}`)
          .expect(401, { error: 'Unauthorized request' });
      });
    });

    context('Given no bookmarks', () => {
      it(`responds 404 and 'Bookmark not found'`, () => { // eslint-disable-line quotes
        const bookmarkId = 1234567890;
        return supertest(app)
          .get(`/api/bookmarks/${bookmarkId}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(404, { error: { message: 'Bookmark not found' }});
      });
    });

    context('Given an XSS attack bookmark', () => {
      const maliciousBookmark = fixtures.makeMaliciousBookmark();
  
      beforeEach('insert malicious bookmark', () => {
        return db
          .into('bookmarks_table')
          .insert([ maliciousBookmark ]);
      });
  
      it('removes XSS attack content', () => {
        return supertest(app)
          .get(`/api/bookmarks/${maliciousBookmark.id}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200)
          .expect(res => {
            expect(res.body.title).to.eql('Ur haxxed! &lt;script&gt;alert(\"xss\");&lt;/script&gt;');
            expect(res.body.url).to.eql('https://www.ninjaz4lyfe.com');
            expect(res.body.description).to.eql(`Bad image <img src="https://url.to.file.which/does-not.exist">. But not <strong>all</strong> bad.`); // eslint-disable-line quotes
            expect(res.body.rating).to.equal(5);
          });
  
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
          .get(`/api/bookmarks/${bookmarkId}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200, expectedBookmark);
      });
    });
  });

  describe('POST /api/bookmarks', () => {

    context('Given an XSS attack bookmark', () => {
      const maliciousBookmark = fixtures.makeMaliciousBookmark();
  
      it('removes XSS attack content, responding 201 with the sanitized bookmark', () => {
        return supertest(app)
          .post('/api/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .send(maliciousBookmark)
          .expect(201)
          .expect(res => {
            expect(res.body.title).to.eql('Ur haxxed! &lt;script&gt;alert(\"xss\");&lt;/script&gt;');
            expect(res.body.url).to.eql('https://www.ninjaz4lyfe.com'); 
            expect(res.body.description).to.eql(`Bad image <img src="https://url.to.file.which/does-not.exist">. But not <strong>all</strong> bad.`); // eslint-disable-line quotes
            expect(res.body.rating).to.equal(5);
            expect(res.headers.location).to.eql(`http://localhost:${PORT}/api/bookmarks/${res.body.id}`);
            return db('bookmarks_table') // this checks that the bookmark was actually created in the database
              .where({ id: res.body.id })
              .first()
              .then(res => expect(res).to.exist);
          });
  
      });
    });

    context('Given incorrect field values', () => {
      it(`responds 400 and 'rating' must be a number between 1 and 5 when 'rating' is a string`, () => { // eslint-disable-line quotes
        const invalidBookmark = fixtures.makeValidBookmark();
        delete invalidBookmark.id; // not needed for a POST request. We dont accept it anyways, but we are only trying to test the numbers here
        invalidBookmark.rating = 'lol not a number yo';

        return supertest(app)
          .post('/api/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .send(invalidBookmark)
          .expect(400, {  error: { message: `'rating' must be a number between 1 and 5`} }); // eslint-disable-line quotes

      }); 

      it(`responds 400 and 'rating' must be between 1 and 5 when 'rating' is a number larger than 5`, () => { // eslint-disable-line quotes
        const invalidBookmark = fixtures.makeValidBookmark();
        delete invalidBookmark.id; // not need for POST request
        invalidBookmark.rating = 10;

        return supertest(app)
          .post('/api/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .send(invalidBookmark)
          .expect(400, {  error: { message: `'rating' must be a number between 1 and 5`} }); // eslint-disable-line quotes
      });
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
            .post('/api/bookmarks')
            .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
            .send(newBookmark)
            .expect(400, {  error: { message: `Missing ${field} in request body`} });
        });

      });
    });

    it('creates a bookmark, responding with 201 and the new bookmark', () => {
      const newBookmark = fixtures.makeValidBookmark();
      delete newBookmark.id; // not needed for a POST request. We want a totally valid POST request here
  
      return supertest(app)
        .post('/api/bookmarks')
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .send(newBookmark)
        .expect(201)
        .expect(res => {
          expect(res.body.title).to.eql(newBookmark.title);
          expect(res.body.url).to.eql(newBookmark.url);
          expect(res.body.description).to.eql(newBookmark.description);
          expect(res.body.rating).to.eql(newBookmark.rating);
          expect(res.body).to.have.property('id');
          expect(res.headers.location).to.eql(`http://localhost:${PORT}/api/bookmarks/${res.body.id}`);
          return db('bookmarks_table') // this checks that the bookmark was actually created in the database
            .where({ id: res.body.id })
            .first()
            .then(res => expect(res).to.exist);
        });
    });
  });

  describe('DELETE /api/bookmarks/:id', () => {
    context('Given no bookmarks', () => {
      it('responds with 404', () => {
        const bookmarkId = 1234567;
        return supertest(app)
          .delete(`/api/bookmarks/${bookmarkId}`)
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

      it('responds with 204 and removes the bookmark', () => {
        const idToRemove = 2;
        const expectedBookmarks = testBookmarks.filter(bookmark => bookmark.id !== idToRemove);

        return supertest(app)
          .delete(`/api/bookmarks/${idToRemove}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(204)
          .then(res => {
            return supertest(app)
              .get('/api/bookmarks')
              .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
              .expect(expectedBookmarks);
          });
      });
    });
  });

  describe('PATCH /api/bookmarks/:id', () => {
    context('Given no bookmarks', () => {
      it('responds with 404', () => {
        const bookmarkId = 123457;
        return supertest(app)
          .patch(`/api/bookmarks/${bookmarkId}`)
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

        it(`responds with 204 when updating only a subset of fields`, () => {
            const idToUpdate = 2;
            const updateBookmark = {
                title: 'updated bookmark title',
            };
            const expectedBookmark = {
                ...testBookmarks[idToUpdate - 1],
                ...updateBookmark
            };

            return supertest(app)
                .patch(`/api/bookmarks/${idToUpdate}`)
                .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                .send({
                    ...updateBookmark,
                    fieldToIgnore: 'should not be in GET response'
                })
                .expect(204)
                .then(res =>
                    supertest(app)
                        .get(`/api/bookmarks/${idToUpdate}`)
                        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
                        .expect(expectedBookmark)
                );
        });

        it('responds with 400 when no required fields are supplied', () => {
            const idToUpdate = 2;
            return supertest(app)
            .patch(`/api/bookmarks/${idToUpdate}`)
            .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
            .send({ irrelevantField: 'foo' })
            .expect(400, {
                error: {
                    message: `Request body must contain either 'title', 'url', 'description', or 'rating'`
                }
            })
        });

        it('responds with 204 and updates the bookmark', () => {
        const idToUpdate = 2;
        const updateBookmark = {
          title: 'Updated title... AskJeeves lol',
          url: 'https://www.askjeeves.com',
          description: 'Updated description text blah blah',
          rating: 1
        };
        const expectedBookmark = {
            ...testBookmarks[idToUpdate - 1],
            ...updateBookmark
        }

        return supertest(app)
          .patch(`/api/bookmarks/${idToUpdate}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .send(updateBookmark)
          .expect(204)
          .then(res => {
            return supertest(app)
              .get(`/api/bookmarks/${idToUpdate}`)
              .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
              .expect(expectedBookmark);
          });
      });
    });
  });
});