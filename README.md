# vscode-cucumber-runner

## Features

Simple way to run or debug a specific test - based on vscode-jest-runner

Run & Debug your Cucumber Tests from
- Context-Menu
- CodeLens
- Command Palette (strg+shift+p)

## Extension Settings

Cucumber Runner will work out of the box, with the Cucumber test runner in `/bin/cucumber` relative to the project root folder.

## Shortcuts

Command Pallette -> Preferences: Open Keyboard Shortcuts (JSON)
the json config file will open
add this:

```json
{
  "key": "alt+1",
  "command": "extension.runCucumber"
},
{
  "key": "alt+2",
  "command": "extension.debugCucumber"
}
```
