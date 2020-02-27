'use strict';
const express = require('express');
const uuid = require('uuid/v4');
const { isWebUri } = require('valid-url');
const logger = require('./logger');
const { bookmarks } = require('./store');

const bookmarksRouter = express.Router();
const bodyParser = express.json();


bookmarksRouter
  .route('/')
  .get((req, res) => {
    res
      .json(bookmarks);
  })
  .post(bodyParser, (req, res) => {
    const { title, url, description, rating } = req.body;
    // the advantage of this approach is the code is cleaner
    // the disadvantage is the error message is less specific
    if(!title || !url || !description || !rating) {
      logger.error('All fields are required');
      return res
        .status(400)
        .send('Invalid data');
    }

    if (!isWebUri(url)) {
      logger.error(`Invalid url '${url}' supplied`);
      // eslint-disable-next-line quotes
      return res.status(400).send(`'url' must be a valid URL`);
    }

    const id = uuid();
    const bookmark = {
      id,
      title,
      url,
      description,
      rating
    };

    bookmarks.push(bookmark);

    logger.info(`Bookmark with the id ${id} created.`);

    res
      .status(201)
      .location(`http://localhost:8000/bookmarks/${id}`)
      .json(bookmark);
  });

bookmarksRouter
  .route('/:id')
  .get((req, res) => {
    const { id } = req.params;
    const bookmark = bookmarks.find( b => b.id === id);
    
    if (!bookmark) {
      logger.error(`Bookmark with id ${id} was not found`);
      return res 
        .status(404)
        .send('Bookmark not found');
    }

    res.json(bookmark);
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