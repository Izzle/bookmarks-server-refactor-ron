function makeBookmarksArray() {
  return [
    {
      id: 1,
      title: 'Google',
      url: 'https://www.google.com',
      description: 'Search engine',
      rating: 4
    },
    {
      id: 2,
      title: 'Thinkful',
      url: 'https://www.thinkful.com',
      description: 'Coding bootcamp',
      rating: 5
    },
    {
      id: 3,
      title: 'Bing',
      url: 'https://www.bing.com',
      description: 'I mean.. if google is down you can use this I guess',
      rating: 2
    }
  ];
}

module.exports = { 
  makeBookmarksArray,
};