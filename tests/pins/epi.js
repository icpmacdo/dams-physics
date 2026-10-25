// Text pins for the Epilogue (book/SPEC.md A.8). Each pin holds a fact the Epilogue states; a writer who
// rewrites the sentence keeps the fact and moves the pin to a string of the new sentence.
const B = require('../../src/book.json');
module.exports = {
  says: [
    // the spine and its honest qualification (book/SPEC.md G.1), printed exactly as src/book.json holds them
    [B.spine, 'Epilogue prints the spine from book.json'],
    [B.spineCoda, 'Epilogue prints the spine coda from book.json'],
    // overtopping is about half of embankment failures with spillways and gates (Foster et al. 2000, Table 3)
    ['about a third failed because water poured over the crest, and about half once the failed spillways and gates are counted in', 'the other half'],
    // Testalinden: 2.5 m high (ASDSO), failed by water flowing over the crest (Tannant 2015 via ASDSO)
    ['a bank of silty sand and glacial till about 2.5 m high, finished in 1937', 'Testalinden height and date'],
    ['the water flowing over the bank cut through it', 'Testalinden overtopped'],
    // the observational method needs a failure that warns (GISTM Requirement 7.2, quoted)
    ['Brittle failure modes are addressed by conservative design criteria', 'GISTM 7.2'],
    // the consequence class follows what lies downstream, not size
    ['The class, not the dam', 'consequence class']
  ],
  never: [
    // the spine is never claimed to explain every failure (G.1)
    ['explains every failure', 'the spine is not every failure'],
    // the Testalinden review spoke of heavy rain; the field investigation found none in the three days before
    ['heavy rain brought it down', 'Testalinden: snowmelt, not rain']
  ]
};
