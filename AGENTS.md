# Repository conventions

- Write comments and documentation in English.
- Follow Paperclip's document language and theme; use English when no supported locale is declared.
- Keep the plugin independent of Paperclip internals. Use public SDK entrypoints and authenticated, same-origin native APIs.
- Never commit user images, task contents, browser sessions, credentials, or local test output. Fixtures must be synthetic.
- Preserve original images. Publish feedback only after an explicit action in the plugin UI.
- Run build, type checking, and tests before committing.
