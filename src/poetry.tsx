import {
	BasePromptElementProps,
	PromptElement,
	PromptSizing,
	SystemMessage,
	UserMessage
} from '@vscode/prompt-tsx';

export interface PromptProps extends BasePromptElementProps {
	userQuery: string;
	dependencyList: string;
}

export class PoetryPrompt extends PromptElement<PromptProps, void> {
	render(state: void, sizing: PromptSizing) {
		return (
			<>
				<UserMessage>
					The following is a list of dependencies and their versions.
					When replying with code, use the versions of the dependency libraries found in the list.
					At the beginning of the response show the full list of dependencies and their versions. 
					At the end of the response, outside of any code block, show the list of dependencies you utilized and their versions using the format "dependency: version".
				</UserMessage>
				<UserMessage>{this.props.dependencyList}</UserMessage>
				<UserMessage>{this.props.userQuery}</UserMessage>
			</>
		);
	}
}
