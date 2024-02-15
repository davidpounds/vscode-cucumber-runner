import { parse, ParsedNode } from './parser'; // TODO
import { CodeLens, CodeLensProvider, Range, TextDocument } from 'vscode';
import { findFullTestName, escapeRegExp, CodeLensOption } from './util';

function getCodeLensForOption(range: Range, codeLensOption: CodeLensOption, fullTestName: string): CodeLens {
  const titleMap: Record<CodeLensOption, string> = {
    run: 'Run',
    debug: 'Debug',
  };
  const commandMap: Record<CodeLensOption, string> = {
    run: 'extension.runCucumber',
    debug: 'extension.debugCucumber',
  };
  return new CodeLens(range, {
    arguments: [fullTestName],
    title: titleMap[codeLensOption],
    command: commandMap[codeLensOption],
  });
}

function getTestsBlocks(
  parsedNode: ParsedNode,
  parseResults: ParsedNode[],
  codeLensOptions: CodeLensOption[],
): CodeLens[] {
  const codeLens: CodeLens[] = [];

  parsedNode.children?.forEach((subNode) => {
    codeLens.push(...getTestsBlocks(subNode, parseResults, codeLensOptions));
  });

  const range = new Range(
    parsedNode.start.line - 1,
    parsedNode.start.column,
    parsedNode.end.line - 1,
    parsedNode.end.column,
  );

  // TODO
  if (parsedNode.type === 'expect') {
    return [];
  }

  const fullTestName = escapeRegExp(findFullTestName(parsedNode.start.line, parseResults));

  codeLens.push(...codeLensOptions.map((option) => getCodeLensForOption(range, option, fullTestName)));

  return codeLens;
}

export class CucumberRunnerCodeLensProvider implements CodeLensProvider {
  constructor(private readonly codeLensOptions: CodeLensOption[]) {}

  public async provideCodeLenses(document: TextDocument): Promise<CodeLens[]> {
    try {
      const text = document.getText();
      const parseResults = parse(document.fileName, text, { plugins: { decorators: 'legacy' } }).root.children;
      const codeLens: CodeLens[] = [];
      parseResults.forEach((parseResult) =>
        codeLens.push(...getTestsBlocks(parseResult, parseResults, this.codeLensOptions)),
      );
      return codeLens;
    } catch (e) {
      // Ignore error and keep showing Run/Debug buttons at same position
      console.error('cucumber-editor-support parser returned error', e);
    }
  }
}
