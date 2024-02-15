'use strict';
import * as vscode from 'vscode';

import { CucumberRunner } from './cucumberRunner';
import { CucumberRunnerCodeLensProvider } from './CucumberRunnerCodeLensProvider';
import { CucumberRunnerConfig } from './cucumberRunnerConfig';

export function activate(context: vscode.ExtensionContext): void {
  const config = new CucumberRunnerConfig();
  const cucumberRunner = new CucumberRunner(config);
  const codeLensProvider = new CucumberRunnerCodeLensProvider(config.codeLensOptions);

  const runCucumber = vscode.commands.registerCommand(
    'extension.runCucumber',
    async (argument: Record<string, unknown> | string) => {
      return cucumberRunner.runCurrentTest(argument);
    },
  );

  const runCucumberPath = vscode.commands.registerCommand('extension.runCucumberPath', async (argument: vscode.Uri) =>
    cucumberRunner.runTestsOnPath(argument.path),
  );
  const runCucumberFile = vscode.commands.registerCommand('extension.runCucumberFile', async () =>
    cucumberRunner.runCurrentFile(),
  );
  const debugCucumber = vscode.commands.registerCommand(
    'extension.debugCucumber',
    async (argument: Record<string, unknown> | string) => {
      if (typeof argument === 'string') {
        return cucumberRunner.debugCurrentTest(argument);
      } else {
        return cucumberRunner.debugCurrentTest();
      }
    },
  );
  const debugCucumberPath = vscode.commands.registerCommand(
    'extension.debugCucumberPath',
    async (argument: vscode.Uri) => cucumberRunner.debugTestsOnPath(argument.path),
  );

  if (!config.isCodeLensDisabled) {
    const docSelectors: vscode.DocumentFilter[] = [
      {
        pattern: vscode.workspace.getConfiguration().get('cucumberrunner.codeLensSelector'),
      },
    ];
    const codeLensProviderDisposable = vscode.languages.registerCodeLensProvider(docSelectors, codeLensProvider);
    context.subscriptions.push(codeLensProviderDisposable);
  }
  context.subscriptions.push(runCucumber);
  context.subscriptions.push(runCucumberFile);
  context.subscriptions.push(runCucumberPath);
  context.subscriptions.push(debugCucumber);
  context.subscriptions.push(debugCucumberPath);
}

export function deactivate(): void {
  // deactivate
}
