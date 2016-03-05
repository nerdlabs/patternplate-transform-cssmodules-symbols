# patternplate-transform-cssmodules-symbols
[patternplate](/sinnerschrader/patternplate) transform to enable usage of [css modules](/css-modules/css-modules).

## Installation
```shell
npm install --save patternplate-transform-cssmodules-symbols
```

## Configuration
```javascript
// file: configuration/patternplate-server/patterns.js
module.exports = {
  formats: {
    jsx: {
      name: 'Markup',
      transforms: ['cssmodules-symbols', 'react', 'react-to-markup']
    }
  }
};

// file: configuration/patternplate-server/transforms.js
module.exports = {
  'cssmodules-symbols': {
    inFormat: 'jsx',
    outFormat: 'jsx'
  }
};
```
