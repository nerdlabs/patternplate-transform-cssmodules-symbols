import path from 'path';
import {find} from 'lodash';
import {parse} from 'babylon';
import generate from 'babel-generator';
import traverse from 'babel-traverse';
import {parse as parseURL} from 'url';
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

const resolvePattern = (styleURL, file) => {
	const name = styleURL.hostname === 'pattern' ? 'Pattern' : styleURL.hostname;
	if (name === 'Pattern') {
		return file.pattern;
	}
	if (name in file.dependencies) {
		return file.dependencies[name].pattern;
	}
	const error = new Error([
		`Could not resolve dependency ${name}`,
		`in ${file.pattern.id}:${file.name},`,
		`it is not in pattern.json.`,
		'Available pattern dependencies:',
		Object.keys(file.dependencies).join(', ')
	].join(' '));
	error.fileName = file.path;
	error.file = file.path;
	throw error;
};

const isStyleImport = source => {
	const protocol = parseURL(source).protocol;
	return typeof protocol === 'string' && protocol.startsWith('style');
};
const isStaticRequire = node => node.callee.name === 'require' && t.isLiteral(node.arguments[0]);

const replaceImportDeclaration = (path, tokens) => {
	path.replaceWith(
		t.variableDeclaration('const', path.node.specifiers.map(specifier => {
			const value = t.isImportDefaultSpecifier(specifier) ?
				tokens :
				tokens[specifier.imported.name];

			return t.variableDeclarator(specifier.local, t.valueToNode(value));
		}))
	);
};

const getStyleImports = ast => {
	const styleImports = [];
	traverse(ast, {
		ImportDeclaration(path) {
			if (isStyleImport(path.node.source.value)) {
				styleImports.push(parseURL(path.node.source.value));
			}
		},
		CallExpression(path) {
			if (isStaticRequire(path.node) && isStyleImport(path.node.arguments[0])) {
				styleImports.push(parseURL(path.node.arguments[0]));
			}
		}
	});
	return styleImports;
};

const replaceStyleImports = (ast, tokensByIdentifier) => {
	traverse(ast, {
		ImportDeclaration(path) {
			if (isStyleImport(path.node.source.value)) {
				const tokens = tokensByIdentifier[path.node.source.value.toLowerCase()];
				replaceImportDeclaration(path, tokens);
			}
		},
		CallExpression(path) {
			if (isStaticRequire(path.node) && isStyleImport(path.node.arguments[0])) {
				const tokens = tokensByIdentifier[path.node.arguments[0].toLowerCase()];
				path.replaceWith(t.valueToNode(tokens));
			}
		}
	});
};

const getStyleBaseName = (styleImport, pattern) => {
	const [format, concern = 'index'] = styleImport.protocol.slice(0, -1).split('+');
	const outFormat = find(pattern.outFormats, outFormat => outFormat.type === format);
	if (!outFormat) {
		const error = new Error(`Pattern ${pattern.id} has no file matching format: ${format}`);
		error.fileName = pattern.path;
		error.file = pattern.path;
		throw error;
	}
	return `${concern}.${outFormat.extension}`;
};

const getStyleTokens = async (styleImports, file, application) => {
	return await Promise.all(
		styleImports.map(async styleImport => {
			const pattern = resolvePattern(styleImport, file);
			const fileName = getStyleBaseName(styleImport, pattern);
			const stylePattern = await application.pattern.factory(
				pattern.id,
				pattern.base,
				{
					patterns: application.configuration.patterns,
					transforms: application.configuration.transforms,
					log: application.log
				},
				application.transforms,
				{outFormats: [path.extname(fileName).slice(1)]});
			await stylePattern.read();
			await stylePattern.transform();

			const styleFile = stylePattern.files[fileName];

			if (!styleFile) {
				const error = new Error(
					[
						`Pattern ${stylePattern.id} has no file ${fileName}`,
						`requested by "${styleImport}" in ${file.pattern.id}:${file.name}.`,
						`Available files: ${Object.keys(stylePattern.files).join(', ')}`
					].join(' ')
				);
				error.fileName = pattern.path;
				error.file = pattern.path;
				throw error;
			}

			const tokens = styleFile.meta.cssmodules;

			if (!tokens) {
				const error = new Error([
					'Could not find cssmodules meta data for',
					`${styleFile.pattern.id}:${styleFile.baseName}`,
					`imported by ${file.pattern.id}:${file.baseName}.`,
					' Did you forget to turn on cssmodules transform?'
				].join(''));

				error.fileName = file.path;
				error.file = file.path;
			}

			return {styleImport, tokens};
		})
	);
};

const transform = async (application, file) => {
	const transformingDependencies = Object.values(file.dependencies)
		.map(file => transform(application, file));

	const source = file.buffer.toString('utf-8');
	const ast = parse(source, babylonOptions);

	const styleImports = getStyleImports(ast);
	const styleTokens = await getStyleTokens(styleImports, file, application);

	replaceStyleImports(ast, styleTokens.reduce((tokensByIdentifier, tokens) => {
		tokensByIdentifier[tokens.styleImport.href] = tokens.tokens;
		return tokensByIdentifier;
	}, {}));

	file.buffer = generate(ast.program).code;

	/**
	 * For "plain" jsx files we are dealing with invalid js
	 * because babel-generator appends a trailing semi-colon
	 * to the jsx expression, causing subsequent babel parse
	 * operations to fail, thus we have to remove it.
	 * TODO: Remove this when when
	 * - soft-deprecated plain jsx without default export
	 * - hard-deprecated plain jsx without default export
	 */
	if (file.buffer[file.buffer.length - 1] === ';') {
		file.buffer = file.buffer.slice(0, file.buffer.length - 1);
	}

	await Promise.all(transformingDependencies);
	return file;
};

export default application => {
	return async file => {
		return transform(application, file);
	};
};
