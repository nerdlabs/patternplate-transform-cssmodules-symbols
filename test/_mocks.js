import unindent from 'unindent';

export const application = {

};

export const emptyFile = {
	buffer: new Buffer(''),
	path: 'empty/index.jsx',
	dependencies: {},
	fs: {node: {mtime: 0}}
};

export const plainFile = {
	buffer: new Buffer('<div />'),
	dependencies: {},
	fs: {node: {mtime: 0}}
};

export const statelessFile = {
	buffer: new Buffer(unindent(`
	export default (props) => {
		return (<div />);
	};
	`)),
	path: 'stateless/index.jsx',
	dependencies: {},
	fs: {node: {mtime: 0}}
};

export const fullFile = {
	buffer: new Buffer(unindent(`
	import React from 'react';

	export default class FullComponent extends React.Component {
		render() {
			return <div />;
		}
	}
	`)),
	path: 'full/index.jsx',
	dependencies: {},
	fs: {node: {mtime: 0}}
};
