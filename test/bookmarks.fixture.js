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

function makeMaliciousBookmark() {
  return {
    id: 18, // the server won't take our ID, but we may reference this
    title: 'Ur haxxed! <script>alert("xss");</script>',
    url: 'https://www.ninjaz4lyfe.com',
    description: `Bad image <img src="https://url.to.file.which/does-not.exist" onerror="alert(document.cookie);">. But not <strong>all</strong> bad.`,
    rating: 5
  };
}

function makeValidBookmark() {
  return {
    id: 7,
    title: 'Firefox',
    url: 'https://www.firefox.com',
    description: 'Less ads than Chrome',
    rating: 5
  };
}

module.exports = { 
  makeBookmarksArray,
  makeMaliciousBookmark,
  makeValidBookmark,
};