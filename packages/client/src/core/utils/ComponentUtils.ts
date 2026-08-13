import {
	type DetailedHTMLProps,
	type HTMLAttributes,
	isValidElement,
} from "react";

export const ComponentUtils = {
	text: ({
		children,
	}: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>) => {
		let text = "";
		if (
			isValidElement(children) &&
			children.props &&
			typeof children.props === "object" &&
			"children" in children.props &&
			typeof children.props.children === "string"
		) {
			text = children.props.children;
		} else if (typeof children === "string") {
			text = children;
		}
		return text;
	},
} as const;
