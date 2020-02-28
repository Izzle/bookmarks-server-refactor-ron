const express = require('express');
const xss = require('xss');
const { isWebUri } = require('valid-url');
const logger = require('../logger');
const { bookmarks } = require('../store');
const BookmarksService = require('./bookmarks-service');

const bookmarksRouter = express.Router();
const bodyParser = express.json();

const serializeBookmark = bookmark => ({
  id: bookmark.id,
  title: xss(bookmark.title),
  url: xss(bookmark.url),
  description: xss(bookmark.description),
  rating: bookmark.rating // we dont need to run XSS on rating because we validate that the rating is a number both on the API server and the Database TYPE checks this as well.
});

bookmarksRouter
  .route('/')
  .get((req, res, next) => {
    const knexInstance = req.app.get('db'); // we can just put req.app.get('db') directly into .getAllBookmarks, but this a good reminder of what it does
    BookmarksService.getAllBookmarks(knexInstance)
      .then(bookmarks => {
        res.json(bookmarks.map(serializeBookmark));
      })
      .catch(next);
  })
  .post(bodyParser, (req, res, next) => {
    const { title, url, description, rating } = req.body;
    const requiredFields =  { title, url,  rating };

    for (const [key, value] of Object.entries(requiredFields)) {
      if (value == null || !value) {  // eslint-disable-line eqeqeq
        return res.status(400).json({
          error: { message: `Missing ${key} in request body`}
        });
      }
    }

    if (!isWebUri(url)) {
      logger.error(`Invalid url '${url}' supplied`);
      // eslint-disable-next-line quotes
      return res.status(400).json({
        error: { message: `'url' must be a valid URL`} // eslint-disable-line quotes
      });
    }

    if(isNaN(rating)) {
      logger.error(`Invalid rating ${rating} supplied`);
      return res.status(400).json({
        error: { message: `'rating' must be a number`} // eslint-disable-line quotes
      });
    }

    // After all validation, we can make our newBookmark object to send to the database
    const newBookmark = {
      title,
      url,
      description,
      rating
    };

    BookmarksService.insertBookmark(req.app.get('db'), newBookmark)
      .then(bookmark => {
        logger.info(`Bookmark with the id ${bookmark.id} created.`);
        res
          .status(201)
          .location(`http://localhost:8000/bookmarks/${bookmark.id}`)
          .json(bookmark);
      })
      .catch(next);
  });

bookmarksRouter
  .route('/:id')
  .get((req, res, next) => {
   
    BookmarksService.getById(req.app.get('db'), req.params.id)
      .then(bookmark => {
        if (!bookmark) {
          logger.error(`Bookmark with id ${req.params.id} was not found`);
          return res
            .status(404)
            .json({ 
              error: { message: 'Bookmark not found' }
            });
        }
        res.json(serializeBookmark(bookmark));
      })
      .catch(next);
  })
  .delete((req, res) => {
    const { id } = req.params;

    const bookmarkIndex = bookmarks.findIndex( b => b.id === id);

    if (bookmarkIndex === -1) {
      logger.error(`Bookmark with the id ${id} is not found`);
      return res
        .status(404)
        .send('Not found');
    }

    bookmarks.splice(bookmarkIndex, 1);

    logger.info(`Bookmark with the id ${id} deleted.`);

    res
      .status(204)
      .end();
  });

module.exports = bookmarksRouter;