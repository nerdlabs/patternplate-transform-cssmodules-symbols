import {merge} from 'lodash';
import {parse} from 'babylon';
import generate from 'babel-generator';
import traverse from 'babel-traverse';
import {parse as parseURL} from 'url';
import createTransform from '../../patternplate-transform-cssmodules';
import * as t from 'babel-types';

const babylonOptions = {
	sourceType: 'module',
	plugins: [
		'jsx',
		'asyncFunctions',
		'classConstructorCall',
		'doExpressions',
		'trailingFunctionCommas',
		'objectRestSpread',
		'decorators',
		'classProperties',
		'exportExtensions',
		'exponentiationOperator',
		'asyncGenerators',
		'functionBind',
		'functionSent'
	]
};

const resolvePattern = (_name, file) => {
	const name = _name === 'pattern' ? 'Pattern' : _name;
	if (name in file.dependencies) {
		return file.dependencies[name];
	}
	const error = new Error([
		`Could not resolve dependency ${name}`,
		`in ${file.pattern.id}:${file.name},`,
		`it is not in pattern.json.`,
		'Available pattern dependencies:',
		Object.keys(file.dependencies).join(', ')
	].join(' '));
	error.fileName = file.path;
	error.errorFile = file.path;
	throw error;
};

const findStyleImports = ast => {
	const styleImports = [];

	// TODO: use babylon-ast-dependencies
	traverse(ast, {
		ImportDeclaration(path) {
			if (parseURL(path.node.source.value).protocol === 'style:') {
				styleImports.push(path);
			}
		}
	});

	return styleImports;
};

const replaceStyleImports = (styleImports, generateTokens) => {
	styleImports.forEach(path => {
		const tokens = generateTokens(parseURL(path.node.source.value).hostname);

		path.replaceWith(
			t.variableDeclaration('const', path.node.specifiers.map(specifier => {
				const value = t.isImportDefaultSpecifier(specifier) ?
					tokens :
					tokens[specifier.imported.name];

				return t.variableDeclarator(specifier.local, t.valueToNode(value));
			}))
		);
	});
};

export default () => {
	// const transform = createTransform();

	return async file => {
		const source = file.buffer.toString('utf-8');
		const ast = parse(source, babylonOptions);

		const styleImports = findStyleImports(ast);
		replaceStyleImports(styleImports, localName => {
			const pattern = resolvePattern(localName, file);
			console.log(`generating tokens for "${localName}"`);
			// TODO: call patternplate-transform-cssmodules and take tokens
			// from file.meta.cssmodules
			const tokens = {
				foo: 'foo_23k1',
				bar: 'bar_rks5',
				baz: 'baz_2k52',
				button: '_button_vahbc_6',
				green: '_green_n2fe8_13'
			};

			return tokens;
		});

		file.buffer = generate(ast.program).code;
		return file;
	};
};
