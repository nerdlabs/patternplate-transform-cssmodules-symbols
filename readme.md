# patternplate-transform-cssmodules-symbols

[patternplate](/sinnerschrader/patternplate) transform to enable usage of
[css modules](https://github.com/css-modules/css-modules)

:warning: **This transform is intended to be used in conjunction with
 [patternplate-transform-cssmodules](https://github.com/nerdlabs/patternplate-transform-cssmodules)
 and depends on it being configured properly for styles files to import.**

See the [Configuration](#configuration) section for details.

## Installation

```shell
npm install --save patternplate-transform-cssmodules-symbols patternplate-transform-cssmodules
```

## Configuration

```javascript
// file: configuration/patternplate-server/patterns.js
module.exports = {
  formats: {
    css: {
      name: 'Style',
      transforms: ['cssmodules']
    },
    jsx: {
      name: 'Markup',
      transforms: ['cssmodules-symbols', 'react', 'react-to-markup']
    }
  }
};
```

```javascript
// file: configuration/patternplate-server/transforms.js
module.exports = {
  'cssmodules-symbols': {
    inFormat: 'jsx',
    outFormat: 'jsx'
  },
  cssmodules: {
    inFormat: 'css',
    outFormat: 'css'
  }
};
```

## Usage

### Sources

```javascript
// atoms/button/index.jsx
import styles from 'style://Pattern';
import cx from 'classnames';

const className = cx(styles.default, {
  [styles.disabled]: this.props.disabled
});

<button className={className}>
  {this.props.children}
</button>
```

```css
/* atoms/button/index.css */
.default {
  padding: 5px 10px;
  background: blue;
  color: white;
}
.disabled {
  background: grey;
}
```

### Transformed

```javascript
// <Button>Lorem Ipsum dolor si amnet</Button>
<button class="_button_4erg9ut2">
  Lorem Ipsum dolor si amnet
</button>

// <Button>Lorem Ipsum dolor si amnet</Button>
<button class="_button_4erg9ut2 _button_iert9832">
  Lorem Ipsum dolor si amnet
</button>
```

```css
/* atoms/button/index.css */
._button_4erg9ut2 {
  padding: 5px 10px;
  background: blue;
  color: white;
}
._button_iert9832 {
  background: grey;
}
```
