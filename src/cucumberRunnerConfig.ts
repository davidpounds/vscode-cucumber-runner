import * as path from 'path';
import * as vscode from 'vscode';
import { normalizePath, validateCodeLensOptions, CodeLensOption } from './util';

export class CucumberRunnerConfig {
  /**
   * The command that runs Cucumber.
   * Defaults to: "bin/cucumber"
   */
  public get cucumberCommand(): string {
    return `bin/cucumber`;
  }

  public get changeDirectoryToWorkspaceRoot(): boolean {
    return vscode.workspace.getConfiguration().get('cucumberrunner.changeDirectoryToWorkspaceRoot');
  }

  public get preserveEditorFocus(): boolean {
    return vscode.workspace.getConfiguration().get('cucumberrunner.preserveEditorFocus') || false;
  }

  public get cucumberBinPath(): string {
    const jestPath = path.join(this.cwd, 'bin/cucumber');
    return normalizePath(jestPath);
  }

  public get cwd(): string {
    return this.currentWorkspaceFolderPath;
  }

  private get currentWorkspaceFolderPath(): string {
    const editor = vscode.window.activeTextEditor;
    return vscode.workspace.getWorkspaceFolder(editor.document.uri).uri.fsPath;
  }

  public get debugOptions(): Partial<vscode.DebugConfiguration> {
    const debugOptions = vscode.workspace.getConfiguration().get('cucumberrunner.debugOptions');
    return debugOptions || {};
  }

  public get isCodeLensDisabled(): boolean {
    const isCodeLensDisabled: boolean = vscode.workspace.getConfiguration().get('cucumberrunner.disableCodeLens');
    return !!isCodeLensDisabled;
  }

  public get isRunInExternalNativeTerminal(): boolean {
    const isRunInExternalNativeTerminal: boolean = vscode.workspace
      .getConfiguration()
      .get('cucumberrunner.runInOutsideTerminal');
    return !!isRunInExternalNativeTerminal;
  }

  public get codeLensOptions(): CodeLensOption[] {
    const codeLensOptions = vscode.workspace.getConfiguration().get('cucumberrunner.codeLens');
    return Array.isArray(codeLensOptions) ? validateCodeLensOptions(codeLensOptions) : [];
  }
}
