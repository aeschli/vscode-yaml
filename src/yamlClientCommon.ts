/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Copyright (c) Adam Voss. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { workspace, ExtensionContext, extensions, Uri } from 'vscode';
import { LanguageClientOptions, NotificationType, CommonLanguageClient, ResponseError } from 'vscode-languageclient';
import { CUSTOM_SCHEMA_REQUEST, CUSTOM_CONTENT_REQUEST, SchemaExtensionAPI, CONTENT_REQUEST, STORE_REQUEST } from './schema-extension-api';

export interface ISchemaAssociations {
	[pattern: string]: string[];
}

namespace SchemaAssociationNotification {
	export const type: NotificationType<ISchemaAssociations, any> = new NotificationType('json/schemaAssociations');
}

namespace DynamicCustomSchemaRequestRegistration {
	export const type: NotificationType<{}, {}> = new NotificationType('yaml/registerCustomSchemaRequest');
}

export type LanguageClientConstructor = (name: string, description: string, clientOptions: LanguageClientOptions) => CommonLanguageClient;

export interface RuntimeEnvironment {
	xhr(uri: string): Promise<string>;
}


export function startClient(context: ExtensionContext, newLanguageClient: LanguageClientConstructor, runtime: RuntimeEnvironment) : SchemaExtensionAPI {

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for on disk and newly created YAML documents
		documentSelector: [
			{ language: 'yaml' }
		],
		synchronize: {
			// Synchronize these setting sections with the server
			configurationSection: ['yaml', 'http.proxy', 'http.proxyStrictSSL'],
			// Notify the server about file changes to YAML and JSON files contained in the workspace
			fileEvents: [
				workspace.createFileSystemWatcher('**/*.?(e)y?(a)ml'),
				workspace.createFileSystemWatcher('**/*.json')
			]
		}
	};

	// Create the language client and start it

	let client = newLanguageClient('yaml', 'YAML Support', clientOptions);
	let disposable = client.start();

	const schemaExtensionAPI = new SchemaExtensionAPI(client);

	// Push the disposable to the context's subscriptions so that the
	// client can be deactivated on extension deactivation
	context.subscriptions.push(disposable);

	client.onReady().then(() => {
		// Send a notification to the server with any YAML schema associations in all extensions
		client.sendNotification(SchemaAssociationNotification.type, getSchemaAssociation(context));

		// If the extensions change, fire this notification again to pick up on any association changes
		extensions.onDidChange(_ => {
			client.sendNotification(SchemaAssociationNotification.type, getSchemaAssociation(context));
		});
		// Tell the server that the client is ready to provide custom schema content
		client.sendNotification(DynamicCustomSchemaRequestRegistration.type);
		// If the server asks for custom schema content, get it and send it back
		client.onRequest(CUSTOM_SCHEMA_REQUEST, (resource: string) => {
			return schemaExtensionAPI.requestCustomSchema(resource);
		});
		client.onRequest(CUSTOM_CONTENT_REQUEST, (uri: string) => {
			return schemaExtensionAPI.requestCustomSchemaContent(uri);
		});

		client.onRequest(CONTENT_REQUEST, (resource: string) => {
			const uri = Uri.parse(resource);
			if (uri.scheme === 'untitled') {
				return Promise.reject(new ResponseError(3, 'Unable to load {0}', uri.toString()));
			}
			if (uri.scheme !== 'http' && uri.scheme !== 'https') {
				return workspace.openTextDocument(uri).then(doc => {
					return doc.getText();
				}, error => {
					return Promise.reject(new ResponseError(2, error.toString()));
				});
			} else {
				return runtime.xhr(resource);
			}
		});
		client.onRequest(STORE_REQUEST, (uri: string) => {
			return runtime.xhr(uri);
		});
	});

	return schemaExtensionAPI;
}

function getSchemaAssociation(context: ExtensionContext): ISchemaAssociations {
	let associations: ISchemaAssociations = {};
	// Scan all extensions
	extensions.all.forEach(extension => {
		let packageJSON = extension.packageJSON;
		// Look for yamlValidation contribution point in the package.json
		if (packageJSON && packageJSON.contributes && packageJSON.contributes.yamlValidation) {
			let yamlValidation = packageJSON.contributes.yamlValidation;
			// If the extension provides YAML validation
			if (Array.isArray(yamlValidation)) {
				yamlValidation.forEach(jv => {
					// Get the extension's YAML schema associations
					let { fileMatch, url } = jv;

					if (typeof fileMatch === 'string' && typeof url === 'string') {
						// Convert relative file paths to absolute file URIs
						if (url[0] === '.' && url[1] === '/') {
							let extensionPath = extension.extensionUri.path;
							extensionPath = extensionPath + url.substring(extensionPath.endsWith('/') ? 2 : 1);
							url = extension.extensionUri.with({ path: extensionPath }).toString();
						}
						// Replace path variables
						if (fileMatch[0] === '%') {
							fileMatch = fileMatch.replace(/%APP_SETTINGS_HOME%/, '/User');
							fileMatch = fileMatch.replace(/%APP_WORKSPACES_HOME%/, '/Workspaces');
						} else if (fileMatch.charAt(0) !== '/' && !fileMatch.match(/\w+:\/\//)) {
							fileMatch = '/' + fileMatch;
						}
						// Create a file-schema association
						let association = associations[fileMatch];

						if (!association) {
							association = [];
							associations[fileMatch] = association;
						}
						// Store the file-schema association
						association.push(url);
					}
				});
			}
		}
	});

	return associations;
}
