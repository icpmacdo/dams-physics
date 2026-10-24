// Text pins for the front matter (book/SPEC.md A.8). Each pin holds a corrected fact; a writer who
// rewrites the sentence keeps the fact and moves the pin to a string of the new sentence.
const B = require('../../src/book.json');
module.exports = {
  says: [
    // the films: no film is said to retell only the chapter it sits in (How to read this book)
    ['Each sits in the chapter it retells most closely, and several range over other chapters as well', 'How to read, the films'],
    // the title page prints the spine exactly as src/book.json holds it
    [B.spine, 'the title page prints the spine from book.json'],
    [B.subtitle, 'the cover prints the subtitle from book.json']
  ],
  never: [
    ['each at the end of the step it retells', 'the films'],
    // the cover no longer claims the spine explains every failure (read-front-1-2, technical concern 5)
    ['Whether it stands or fails comes down to one idea', 'cover, the spine is not every failure']
  ]
};
