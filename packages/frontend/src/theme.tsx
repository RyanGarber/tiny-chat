import { createTheme, CSSVariablesResolver, MantineColorsTuple } from '@mantine/core';

export const darkPalette: MantineColorsTuple = [
  '#C4C6CF', // [0]  near-white text — very slightly cool
  '#A2A4AD', // [1]
  '#858790', // [2]
  '#636570', // [3]
  '#35373e', // [4]
  '#292b32', // [5]  subtle borders
  '#1a1b22', // [6]  surface / card background
  '#131317', // [7]  body / AppShell background
  '#1e2027', // [8]
  '#141418', // [9]  deepest
];

export const theme = createTheme({
  fontFamily: "'Rubik', sans-serif",
  primaryColor: 'blue',
  lineHeights: {
    md: '1.8',
  },
  defaultRadius: 'md',
  colors: {
    dark: darkPalette,
  },
  components: {
    Modal: {
      defaultProps: {
        radius: 'lg',
      },
      styles: {
        header: {
          background: 'transparent',
        },
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
    '--mantine-color-card': '#FFFFFF',
    '--mantine-color-body': '#eeeeee',
    '--tc-sidebar-bg': '#FFFFFF',
    '--tc-surface': '#FFFFFF',
  },
  dark: {
    '--tc-surface': 'var(--mantine-color-dark-6)',
    '--tc-sidebar-bg': 'var(--mantine-color-dark-6)',
  },
});

export default theme;
