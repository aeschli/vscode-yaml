/* --------------------------------------------------------------------------------------------
 * Copyright (c) Red Hat, Inc. All rights reserved.
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import * as path from 'path';
import assert = require('assert');

export let doc: vscode.TextDocument;
export let editor: vscode.TextEditor;
export let documentEol: string;
export let platformEol: string;

/**
 * Activates the redhat.vscode-yaml extension
 */
export async function activate(docUri: vscode.Uri) {
    const ext = vscode.extensions.getExtension('redhat.vscode-yaml')!;
	const activation = await ext.activate();
	try {
		doc = await vscode.workspace.openTextDocument(docUri);
		editor = await vscode.window.showTextDocument(doc);

		await sleep(2000); // Wait for server activation
		return activation;
	} catch (e) {
		console.error(e);
	}
}

export async function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export const getDocPath = (p: string) => {
	return path.resolve(__dirname, '../../test/testFixture', p);
};

export const getDocUri = (p: string) => {
	return vscode.Uri.file(getDocPath(p));
};

export const updateSettings = (setting: any, value: any) => {
	const yamlConfiguration = vscode.workspace.getConfiguration("yaml");
    return yamlConfiguration.update(setting, value, false);
}

export const resetSettings = (setting: any, value: any) => {
	const yamlConfiguration = vscode.workspace.getConfiguration("yaml");
    return yamlConfiguration.update(setting, value, false);
}

export async function setTestContent(content: string): Promise<boolean> {
	const all = new vscode.Range(
		doc.positionAt(0),
		doc.positionAt(doc.getText().length)
	);
	return editor.edit(eb => eb.replace(all, content));
}

export async function testCompletion(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedCompletionList: vscode.CompletionList
) {

	// Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
	const actualCompletionList = (await vscode.commands.executeCommand(
		'vscode.executeCompletionItemProvider',
		docUri,
		position
	)) as vscode.CompletionList;

	const sortedActualCompletionList = actualCompletionList.items.sort((a, b) => (a.label > b.label) ? 1 : -1);
	assert.equal(actualCompletionList.items.length, expectedCompletionList.items.length);
	expectedCompletionList.items.sort((a, b) => (a.label > b.label) ? 1 : -1).forEach((expectedItem, i) => {
		const actualItem = sortedActualCompletionList[i];
		assert.equal(actualItem.label, expectedItem.label);
		assert.equal(actualItem.kind, expectedItem.kind);
	});
}

export async function testCompletionNotEmpty(
	docUri: vscode.Uri,
	position: vscode.Position
) {

	// Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
	const actualCompletionList = (await vscode.commands.executeCommand(
		'vscode.executeCompletionItemProvider',
		docUri,
		position
	)) as vscode.CompletionList;

	assert.notEqual(actualCompletionList.items.length, 0);
}

export async function testHover(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedHover: vscode.Hover[]
) {

	// Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
	const actualHoverResults = (await vscode.commands.executeCommand(
		'vscode.executeHoverProvider',
		docUri,
		position
	)) as vscode.Hover[];

	assert.equal(actualHoverResults.length, expectedHover.length);
	expectedHover.forEach((expectedItem, i) => {
		const actualItem = actualHoverResults[i];
		assert.equal((actualItem.contents[i] as vscode.MarkdownString).value, expectedItem.contents[i]);
	});
}

export async function testDiagnostics(docUri: vscode.Uri, expectedDiagnostics: vscode.Diagnostic[]) {  
	const actualDiagnostics = vscode.languages.getDiagnostics(docUri);
  
	assert.equal(actualDiagnostics.length, expectedDiagnostics.length);
  
	expectedDiagnostics.forEach((expectedDiagnostic, i) => {
	  const actualDiagnostic = actualDiagnostics[i]
	  assert.equal(actualDiagnostic.message, expectedDiagnostic.message)
	  assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range)
	  assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity)
	});
}
