import type { Element } from "hast";
import {
	type DetailedHTMLProps,
	type HTMLAttributes,
	isValidElement,
} from "react";

export const ComponentUtils = {
	props: <T extends Record<string, string | boolean | undefined>>(
		node: Element | undefined,
		props: T,
	): { [K in keyof T]: (T[K] extends boolean ? boolean : string) | T[K] } => {
		for (const key in props) {
			let value = node?.properties?.[key];
			if (value) {
				if (typeof value !== "string") {
					throw new Error(
						`invalid prop type: ${key} in ${node?.tagName} (${value})`,
					);
				}
				value = value.replace("user-content-", "").trim();
				const fallback = props[key];
				Object.assign(props, {
					[key]: typeof fallback === "boolean" ? value === "true" : value,
				});
			}
		}
		return props;
	},

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
