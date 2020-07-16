/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext } from 'vscode';
import { LanguageClientOptions } from 'vscode-languageclient';
import { startClient, LanguageClientConstructor, RuntimeEnvironment } from '../yamlClientCommon';
import { LanguageClient } from 'vscode-languageclient/browser';

// this method is called when vs code is activated
export function activate(context: ExtensionContext) {
	const extensionUri = context.extensionUri;
	const serverMain = extensionUri.with({ path: extensionUri.path + '/node_modules/yaml-language-server/out/server/src/webworker/yamlServerMain.js' });
	try {
		const worker = createWorker(serverMain.toString(false));
		const newLanguageClient: LanguageClientConstructor = (id: string, name: string, clientOptions: LanguageClientOptions) => {
			return new LanguageClient(id, name, clientOptions, worker);
		};

		const runtime: RuntimeEnvironment = {
			xhr(uri: string) {
				return globalThis.fetch(uri, { mode: 'cors' })
					.then(function (response: any) {
						return response.text();
					});
			}
		};
		return startClient(context, newLanguageClient, runtime);

	} catch (e) {
		console.log(e);
	}
}

// create workercross domain
// thanks to https://benohead.com/blog/2017/12/06/cross-domain-cross-browser-web-workers/

function createWorker(workerUrl: string) {
	var worker = null;
	try {
		worker = new globalThis.Worker(workerUrl);
		worker.onerror = function (event) {
			event.preventDefault();
			worker = createWorkerFallback(workerUrl);
		};
	} catch (e) {
		worker = createWorkerFallback(workerUrl);
	}
	return worker;
}

function createWorkerFallback(workerUrl) {
	var worker = null;
	try {
		var blob;
		try {
			blob = new globalThis.Blob(["importScripts('" + workerUrl + "');"], { "type": 'application/javascript' });
		} catch (e) {
			var blobBuilder = new (globalThis.BlobBuilder || globalThis.WebKitBlobBuilder || globalThis.MozBlobBuilder)();
			blobBuilder.append("importScripts('" + workerUrl + "');");
			blob = blobBuilder.getBlob('application/javascript');
		}
		var url = globalThis.URL || globalThis.webkitURL;
		var blobUrl = url.createObjectURL(blob);
		worker = new globalThis.Worker(blobUrl);
	} catch (e1) {
		//if it still fails, there is nothing much we can do
	}
	return worker;
}