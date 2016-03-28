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

const resolvePattern = (rawName, file) => {
	const name = rawName === 'pattern' ? 'Pattern' : rawName;
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

const isStyleImport = source => parseURL(source).protocol === 'style:';
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
				styleImports.push(parseURL(path.node.source.value).hostname);
			}
		},
		CallExpression(path) {
			if (isStaticRequire(path.node) && isStyleImport(path.node.arguments[0])) {
				styleImports.push(parseURL(path.node.arguments[0]).hostname);
			}
		}
	});
	return styleImports;
};

const replaceStyleImports = (ast, tokensByFile) => {
	traverse(ast, {
		ImportDeclaration(path) {
			if (isStyleImport(path.node.source.value)) {
				const tokens = tokensByFile[parseURL(path.node.source.value).hostname];
				replaceImportDeclaration(path, tokens);
			}
		},
		CallExpression(path) {
			if (isStaticRequire(path.node) && isStyleImport(path.node.arguments[0])) {
				const tokens = tokensByFile[parseURL(path.node.arguments[0]).hostname];
				path.replaceWith(t.valueToNode(tokens));
			}
		}
	});
};

const getStyleBaseName = pattern => {
	const outFormat = find(pattern.outFormats, outFormat => outFormat.type === 'style');
	if (!outFormat) {
		const error = new Error(`Pattern ${pattern.id} has no file matching format: 'style'`);
		error.fileName = pattern.path;
		error.file = pattern.path;
		throw error;
	}
	return `index.${outFormat.extension}`;
};

const getStyleTokens = async (styleImports, file, application) => {
	return await Promise.all(
		styleImports.map(async styleImport => {
			const pattern = resolvePattern(styleImport, file);
			const fileName = getStyleBaseName(pattern);
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

	replaceStyleImports(ast, styleTokens.reduce((tokensByFile, tokens) => {
		tokensByFile[tokens.styleImport] = tokens.tokens;
		return tokensByFile;
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
