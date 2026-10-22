# Rare UI source components

Source: https://github.com/swamimalode07/rare-ui/tree/539567414bac024260ed696c9647c737380514a7
License: MIT, copyright Swami Malode; full text in LICENSE.

- bounce-sidebar.tsx: adapted components/ui/bounce-sidebar.tsx. Next Link replaced by motion.a for DSH; utility classes mapped to scoped CSS; explicit React import for host JSX mode; respects reduced motion; invalid selection hides active indicator.
- folder.tsx: adapted components/ui/folder-component.tsx. Scoped utility CSS, labeled parent button owns keyboard activation and opens the existing file-reference flow.

Rare UI does not supply the generic form controls used here. UISelect uses Radix Select; UIField uses Radix Popover and React Day Picker, styled with the same project tokens. React Data Grid remains the spreadsheet engine. No components are falsely attributed to Rare UI.
