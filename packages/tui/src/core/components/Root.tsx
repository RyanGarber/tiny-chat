import { InkPictureProvider } from "ink-picture";
import ThemeContextProvider from "#client/core/components/ThemeContext.tsx";
import App from "#tui/core/components/App.tsx";

/**
 * The whole terminal UI, for a host to render inside its own
 * `QueryClientProvider` and `ClientContext`.
 */
export default function Root() {
	return (
		<ThemeContextProvider>
			<InkPictureProvider>
				<App />
			</InkPictureProvider>
		</ThemeContextProvider>
	);
}
