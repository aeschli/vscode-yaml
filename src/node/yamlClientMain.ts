/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext } from 'vscode';
import { startClient, LanguageClientConstructor, RuntimeEnvironment } from '../yamlClientCommon';
import { ServerOptions, TransportKind, LanguageClientOptions, LanguageClient } from 'vscode-languageclient/node';

import * as path from 'path';
import { xhr, XHRResponse, getErrorStatusDescription } from 'request-light';

// this method is called when vs code is activated
export function activate(context: ExtensionContext) {

	// The YAML language server is implemented in node
	let serverModule = context.asAbsolutePath('node_modules/yaml-language-server/out/server/src/node/yamlServerMain.js');

	// The debug options for the server
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run : { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
	};

	const newLanguageClient: LanguageClientConstructor = (id: string, name: string, clientOptions: LanguageClientOptions) => {
		return new LanguageClient(id, name, serverOptions, clientOptions);
	};

	const runtime: RuntimeEnvironment = {
		xhr(uri: string) {
			const headers = { 'Accept-Encoding': 'gzip, deflate' };
			return xhr({ url: uri, followRedirects: 5, headers }).then(response => {
				return response.responseText;
			}, (error: XHRResponse) => {
				return Promise.reject(error.responseText || getErrorStatusDescription(error.status) || error.toString());
			});
		}
	}

	return startClient(context, newLanguageClient, runtime);
}
