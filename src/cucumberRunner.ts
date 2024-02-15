import * as vscode from 'vscode';

import { CucumberRunnerConfig } from './cucumberRunnerConfig';
import { parse } from './parser'; // TODO
import {
  escapeRegExp,
  escapeRegExpForPath,
  escapeSingleQuotes,
  findFullTestName,
  normalizePath,
  pushMany,
  quote,
  unquote,
  updateTestNameIfUsingProperties,
} from './util';

interface DebugCommand {
  documentUri: vscode.Uri;
  config: vscode.DebugConfiguration;
}

export class CucumberRunner {
  private previousCommand: string | DebugCommand;

  private terminal: vscode.Terminal;

  // support for running in a native external terminal
  // force runTerminalCommand to push to a queue and run in a native external
  // terminal after all commands been pushed
  private openNativeTerminal: boolean;
  private commands: string[] = [];

  constructor(private readonly config: CucumberRunnerConfig) {
    this.setup();
    this.openNativeTerminal = config.isRunInExternalNativeTerminal;
  }

  //
  // public methods
  //

  public async runTestsOnPath(path: string): Promise<void> {
    const command = this.buildCucumberCommand(path);

    this.previousCommand = command;

    await this.goToCwd();
    await this.runTerminalCommand(command);
    await this.runExternalNativeTerminalCommand(this.commands);
  }

  public async runCurrentTest(argument?: Record<string, unknown> | string, options?: string[]): Promise<void> {
    const currentTestName = typeof argument === 'string' ? argument : undefined;
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    await editor.document.save();

    const filePath = editor.document.fileName;
    const testName = currentTestName || this.findCurrentTestName(editor);
    const resolvedTestName = updateTestNameIfUsingProperties(testName);
    const command = this.buildCucumberCommand(filePath, resolvedTestName, options);

    this.previousCommand = command;

    await this.goToCwd();
    await this.runTerminalCommand(command);
    await this.runExternalNativeTerminalCommand(this.commands);
  }

  public async runCurrentFile(options?: string[]): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    await editor.document.save();

    const filePath = editor.document.fileName;
    const command = this.buildCucumberCommand(filePath, undefined, options);

    this.previousCommand = command;

    await this.goToCwd();
    await this.runTerminalCommand(command);
    await this.runExternalNativeTerminalCommand(this.commands);
  }

  public async debugTestsOnPath(path: string): Promise<void> {
    const debugConfig = this.getDebugConfig(path);

    await this.goToCwd();
    await this.executeDebugCommand({
      config: debugConfig,
      documentUri: vscode.Uri.file(path),
    });

    await this.runExternalNativeTerminalCommand(this.commands);
  }

  public async debugCurrentTest(currentTestName?: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    await editor.document.save();

    const filePath = editor.document.fileName;
    const testName = currentTestName || this.findCurrentTestName(editor);
    const resolvedTestName = updateTestNameIfUsingProperties(testName);
    const debugConfig = this.getDebugConfig(filePath, resolvedTestName);

    await this.goToCwd();
    await this.executeDebugCommand({
      config: debugConfig,
      documentUri: editor.document.uri,
    });

    await this.runExternalNativeTerminalCommand(this.commands);
  }

  //
  // private methods
  //

  private async executeDebugCommand(debugCommand: DebugCommand) {
    // prevent open of external terminal when debug command is executed
    this.openNativeTerminal = false;

    for (const command of this.commands) {
      await this.runTerminalCommand(command);
    }
    this.commands = [];

    vscode.debug.startDebugging(undefined, debugCommand.config);

    this.previousCommand = debugCommand;
  }

  private getDebugConfig(filePath: string, currentTestName?: string): vscode.DebugConfiguration {
    const config: vscode.DebugConfiguration = {
      console: 'integratedTerminal',
      internalConsoleOptions: 'neverOpen',
      name: 'Debug Cucumber Tests',
      program: this.config.cucumberBinPath,
      request: 'launch',
      type: 'node',
      cwd: this.config.cwd,
      ...this.config.debugOptions,
    };

    config.args = config.args ? config.args.slice() : [];

    const standardArgs = this.buildCucumberArgs(filePath, currentTestName, false);
    pushMany(config.args, standardArgs);
    config.args.push('--runInBand');

    return config;
  }

  private findCurrentTestName(editor: vscode.TextEditor): string | undefined {
    // from selection
    const { selection, document } = editor;
    if (!selection.isEmpty) {
      return unquote(document.getText(selection));
    }

    const selectedLine = selection.active.line + 1;
    const filePath = editor.document.fileName;
    const testFile = parse(filePath);

    const fullTestName = findFullTestName(selectedLine, testFile.root.children);
    return fullTestName ? escapeRegExp(fullTestName) : undefined;
  }

  private buildCucumberCommand(filePath: string, testName?: string, options?: string[]): string {
    const args = this.buildCucumberArgs(filePath, testName, true, options);
    return `${this.config.cucumberCommand} ${args.join(' ')}`;
  }

  private buildCucumberArgs(filePath: string, testName: string, withQuotes: boolean, options: string[] = []): string[] {
    const args: string[] = [];
    const quoter = withQuotes ? quote : (str) => str;

    args.push(quoter(escapeRegExpForPath(normalizePath(filePath))));

    if (testName) {
      args.push('-t');
      args.push(quoter(escapeSingleQuotes(testName)));
    }

    const setOptions = new Set(options);

    args.push(...setOptions);

    return args;
  }

  private async goToCwd() {
    const command = `cd ${quote(this.config.cwd)}`;
    if (this.config.changeDirectoryToWorkspaceRoot) {
      await this.runTerminalCommand(command);
    }
  }

  private buildNativeTerminalCommand(toRun: string): string {
    const command = `ttab -t 'cucumber-runner' "${toRun}"`;
    return command;
  }

  private async runExternalNativeTerminalCommand(commands: string[]): Promise<void> {
    if (!this.openNativeTerminal) {
      this.commands = [];
      return;
    }

    const command: string = commands.join('; ');
    const externalCommand: string = this.buildNativeTerminalCommand(command);
    this.commands = [];

    if (!this.terminal) {
      this.terminal = vscode.window.createTerminal('cucumber');
    }

    this.terminal.show(this.config.preserveEditorFocus);
    await vscode.commands.executeCommand('workbench.action.terminal.clear');
    this.terminal.sendText(externalCommand);
  }

  private async runTerminalCommand(command: string) {
    if (this.openNativeTerminal) {
      this.commands.push(command);
      return;
    }

    if (!this.terminal) {
      this.terminal = vscode.window.createTerminal('cucumber');
    }
    this.terminal.show(this.config.preserveEditorFocus);
    await vscode.commands.executeCommand('workbench.action.terminal.clear');
    this.terminal.sendText(command);
  }

  private setup() {
    vscode.window.onDidCloseTerminal((closedTerminal: vscode.Terminal) => {
      if (this.terminal === closedTerminal) {
        this.terminal = null;
      }
    });
  }
}
