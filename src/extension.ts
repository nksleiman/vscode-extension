import { renderPrompt } from '@vscode/prompt-tsx';
import * as vscode from 'vscode';
import { PoetryPrompt } from './poetry';
import * as fs from 'fs';
import * as path from 'path';
import * as toml from 'toml';

const LIST_DEPENDENCIES_COMMAND = 'snkr.listDependencies';
const PARTICIPANT_ID = 'nike-copilot-extension.snkr';

interface INikeChatResult extends vscode.ChatResult {
    metadata: {
        command: string;
    }
}

const MODEL_SELECTOR: vscode.LanguageModelChatSelector = { vendor: 'copilot', family: 'gpt-3.5-turbo' };

export function activate(context: vscode.ExtensionContext) {

    // Define a Cat chat handler. 
    const handler: vscode.ChatRequestHandler = async (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken): Promise<INikeChatResult> => {
        // To talk to an LLM in your subcommand handler implementation, your
        // extension can use VS Code's `requestChatAccess` API to access the Copilot API.
        // The GitHub Copilot Chat extension implements this provider.
        if (request.command == 'poetry') {
            stream.progress('Looking for your pyproject.toml file...');
            const dependencies = loadPoetryVersions();
            try {
                const [model] = await vscode.lm.selectChatModels(MODEL_SELECTOR);
                if (model) {
                    const messages = [
                        vscode.LanguageModelChatMessage.User(
                            "The following is a list of dependencies and their versions. " +
                            "When replying with code, use the versions of the dependency libraries found in the list. " +
                            "At the beginning of the response show the full list of dependencies and their versions. " + 
                            "At the end of the response show the list of dependencies you utilized and their versions. " +
                            "If you require a different version of a dependency because of an incompatibility please specify the version you require. " 
                        ),
                        vscode.LanguageModelChatMessage.User(dependencies),
                        vscode.LanguageModelChatMessage.User(request.prompt)
                    ];

                    const chatResponse = await model.sendRequest(messages, {}, token);
                    for await (const fragment of chatResponse.text) {
                        stream.markdown(fragment);
                    }
                }
            } catch(err) {
                handleError(err, stream);
            }

            return { metadata: { command: 'poetry' } };
        } else if (request.command == 'poetryprompt') {
            stream.progress('Looking for your pyproject.toml file...');
            const dependencies = loadPoetryVersions();
            try {
                const [model] = await vscode.lm.selectChatModels(MODEL_SELECTOR);
                if (model) {
                    // Here's an example of how to use the prompt-tsx library to build a prompt
                    const { messages } = await renderPrompt(
                        PoetryPrompt,
                        { userQuery: request.prompt, dependencyList: dependencies }, // Combined the properties into a single object
                        { modelMaxPromptTokens: model.maxInputTokens },
                        model);
                    
                    const chatResponse = await model.sendRequest(messages, {}, token);

                    for await (const fragment of chatResponse.text) {
                        stream.markdown(fragment);
                    }
                    
                }
            } catch(err) {
                handleError(err, stream);
            }

            // stream.button({
            //     command: LIST_DEPENDENCIES_COMMAND,
            //     title: vscode.l10n.t('List Dependencies')
            // });

            return { metadata: { command: 'poetryprompt' } };
        } else if (request.command == 'list') {
            stream.progress('Looking for your requirements.txt file...');
            const dependencies = loadPoetryVersions();
            try {
                const [model] = await vscode.lm.selectChatModels(MODEL_SELECTOR);
                if (model) {
                    const messages = [
                        vscode.LanguageModelChatMessage.User(
                            "Below is a list of dependencies and their versions from a poetry file. Return the list to me using the format \"dependency\": \"version\"."
                        ),
                        vscode.LanguageModelChatMessage.User(dependencies),
                    ];

                    const chatResponse = await model.sendRequest(messages, {}, token);
                    for await (const fragment of chatResponse.text) {
                        stream.markdown(fragment);
                    }
                }
            } catch(err) {
                handleError(err, stream);
            }

            return { metadata: { command: 'poetry' } };
        } else {
            try {
                const [model] = await vscode.lm.selectChatModels(MODEL_SELECTOR);
                if (model) {
                    const messages = [
                        vscode.LanguageModelChatMessage.User(`Provide a random Michael Jordan quote and how it relates to computer science concepts. `),
                        vscode.LanguageModelChatMessage.User(request.prompt)
                    ];
                    
                    const chatResponse = await model.sendRequest(messages, {}, token);
                    for await (const fragment of chatResponse.text) {
                        stream.markdown(fragment);
                    }
                }
            } catch(err) {
                handleError(err, stream);
            }

            return { metadata: { command: '' } };
        }
    };

    // Chat participants appear as top-level options in the chat input
    // when you type `@`, and can contribute sub-commands in the chat input
    // that appear when you type `/`.
    const snkr = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
    snkr.iconPath = vscode.Uri.joinPath(context.extensionUri, 'swoosh.png');
    snkr.followupProvider = {
        provideFollowups(result: INikeChatResult, context: vscode.ChatContext, token: vscode.CancellationToken) {
            return [{
                prompt: '',
                label: vscode.l10n.t('List Dependencies'),
                command: 'list'
            } satisfies vscode.ChatFollowup];
        }
    };

    /*
    TODO: Implement this followupProvider to recognize the difference between poetry and requirements.txt files
    so that we can generate the opposite filetype if required.
    */
    // snkr.followupProvider = {
    //     provideFollowups(result: INikeChatResult, context: vscode.ChatContext, token: vscode.CancellationToken) {
    //         // Example: Determine the previous command from the result or context
    //         const previousCommand = result.previousCommand || context.previousCommand;
    
    //         // Define followups for different commands
    //         const followupsForCommandA = [{
    //             prompt: 'Follow-up for Command A',
    //             label: vscode.l10n.t('Option A'),
    //             command: 'commandAOption'
    //         } satisfies vscode.ChatFollowup];
    
    //         const followupsForCommandB = [{
    //             prompt: 'Follow-up for Command B',
    //             label: vscode.l10n.t('Option B'),
    //             command: 'commandBOption'
    //         } satisfies vscode.ChatFollowup];
    
    //         // Select the appropriate followup based on the previous command
    //         switch (previousCommand) {
    //             case 'commandA':
    //                 return followupsForCommandA;
    //             case 'commandB':
    //                 return followupsForCommandB;
    //             default:
    //                 // Default followup or no followup
    //                 return [];
    //         }
    //     }
    // };

    

    // context.subscriptions.push(
    //     snkr,
    //     // Register the command handler for the /meow followup
    //     vscode.commands.registerTextEditorCommand(LIST_DEPENDENCIES_COMMAND, async (textEditor: vscode.TextEditor) => {
    //         // Replace all variables in active editor with cat names and words

    //         const dependencies = loadPoetryVersions();
    //         let chatResponse: vscode.LanguageModelChatResponse | undefined;
    //         try {
    //             const [model] = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-3.5-turbo' });
    //             if (!model) {
    //                 console.log('Model not found. Please make sure the GitHub Copilot Chat extension is installed and enabled.')
    //                 return;
    //             }
    //             const messages = [
    //                 vscode.LanguageModelChatMessage.User(`The following is a list of dependencies and their versions. Return them to the chat in the format "dependency": "version".`),
    //                 vscode.LanguageModelChatMessage.User(dependencies)
    //             ];
    //             chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

    //         } catch (err) {
    //             if (err instanceof vscode.LanguageModelError) {
    //                 console.log(err.message, err.code, err.cause)
    //             } else {
    //                 throw err;
    //             }
    //             return;
    //         }

    //         // Clear the editor content before inserting new content
    //         await textEditor.edit(edit => {
    //             const start = new vscode.Position(0, 0);
    //             const end = new vscode.Position(textEditor.document.lineCount - 1, textEditor.document.lineAt(textEditor.document.lineCount - 1).text.length);
    //             edit.delete(new vscode.Range(start, end));
    //         });

    //         // Stream the code into the editor as it is coming in from the Language Model
    //         try {
    //             for await (const fragment of chatResponse.text) {
    //                 await textEditor.edit(edit => {
    //                     const lastLine = textEditor.document.lineAt(textEditor.document.lineCount - 1);
    //                     const position = new vscode.Position(lastLine.lineNumber, lastLine.text.length);
    //                     edit.insert(position, fragment);
    //                 });
    //             }
    //         } catch (err) {
    //             // async response stream may fail, e.g network interruption or server side error
    //             await textEditor.edit(edit => {
    //                 const lastLine = textEditor.document.lineAt(textEditor.document.lineCount - 1);
    //                 const position = new vscode.Position(lastLine.lineNumber, lastLine.text.length);
    //                 edit.insert(position, (<Error>err).message);
    //             });
    //         }
    //     }),
    // );
}

function handleError(err: any, stream: vscode.ChatResponseStream): void {
    // making the chat request might fail because
    // - model does not exist
    // - user consent not given
    // - quote limits exceeded
    if (err instanceof vscode.LanguageModelError) {
        console.log(err.message, err.code, err.cause);
        if (err.cause instanceof Error && err.cause.message.includes('off_topic')) {
            stream.markdown(vscode.l10n.t('I\'m sorry, I can only explain computer science concepts.'));
        }
    } else {
        // re-throw other errors so they show up in the UI
        throw err;
    }
}

function loadPoetryVersions(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No open folder in the workspace');
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const filePath = path.join(workspacePath, 'pyproject.toml');
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const parsedToml = toml.parse(fileContent);
        const dependencies = parsedToml['tool']['poetry']['dependencies'];
        let versions = '';
        for (const [key, value] of Object.entries(dependencies)) {
            versions += `${key}: ${value}, \n`;
        }
        return versions.slice(0, -2); // Remove the trailing comma and space
    } else {
        throw new Error('pyproject.toml file not found in the workspace');
    }
}

/*
TODO: Do I want to create a separate method for getting it from requirements or just use a single
/dependency command that autorecognizes the two filetypes?
*/
function loadRequirementsVersions(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No open folder in the workspace');
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const filePath = path.join(workspacePath, 'requirements.txt');
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const requirements = fileContent.split('\n').filter(line => line.trim() !== '');
        let versions = '';
        for (const requirement of requirements) {
            versions += `${requirement}, \n`;
        }
        return versions.slice(0, -3); // Remove the trailing comma, space, and newline
    } else {
        throw new Error('requirements.txt file not found in the workspace');
    }
}

export function deactivate() { }
