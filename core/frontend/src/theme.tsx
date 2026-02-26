import {createTheme, CSSVariablesResolver, MantineColorsTuple} from "@mantine/core";

export const darkPalette: MantineColorsTuple = [
    '#C4C6CF',  // [0]  near-white text — very slightly cool
    '#A2A4AD',  // [1]
    '#858790',  // [2]
    '#636570',  // [3]
    '#494B56',  // [4]
    '#393B44',  // [5]  subtle borders
    '#2C2D35',  // [6]  surface / card background
    '#222329',  // [7]  body / AppShell background
    '#1A1B20',  // [8]
    '#141418',  // [9]  deepest
];

export const theme = createTheme({
    fontFamily: "Archivo, sans-serif",
    primaryColor: "blue",
    defaultRadius: "md",
    colors: {
        dark: darkPalette,
    },
    components: {
        Modal: {
            defaultProps: {
                radius: 'lg',
            },
        },
        Drawer: {
            styles: {
                content: {
                    borderRadius: 0,
                },
            },
        },
        Dialog: {
            defaultProps: {
                radius: 'lg',
            },
        },
        Popover: {
            defaultProps: {
                radius: 'md',
            },
        },
        Menu: {
            defaultProps: {
                radius: 'md',
            },
        },
        Notification: {
            defaultProps: {
                radius: 'md',
            },
        },
        NavLink: {
            styles: {
                root: {
                    borderRadius: 'var(--mantine-radius-md)',
                },
            },
        },
        Tooltip: {
            defaultProps: {
                radius: 'md',
            },
        },
        Card: {
            defaultProps: {
                radius: 'md',
            },
        },
        Tabs: {
            defaultProps: {
                radius: 'md',
            },
        },
        Spotlight: {
            styles: {
                content: {
                    borderRadius: 'var(--mantine-radius-lg)',
                },
            },
        },
    },
});

export const cssResolver: CSSVariablesResolver = () => ({
    variables: {
        '--tc-sidebar-bg': 'var(--mantine-color-body)',
        '--tc-surface': 'var(--mantine-color-body)',
    },
    light: {
        '--mantine-color-body': '#F4F5F8',
        '--tc-sidebar-bg': '#FFFFFF',
        '--tc-surface': '#FFFFFF',
    },
    dark: {
        '--tc-surface': 'var(--mantine-color-dark-6)',
        '--tc-sidebar-bg': 'var(--mantine-color-dark-6)',
    },
});