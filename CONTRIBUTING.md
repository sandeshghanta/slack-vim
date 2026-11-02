# Contributing

Bug reports and pull requests are welcome. Slack changes its page often, so
reports that name the `can't find …` message are especially useful.

## Layout

| Path | What it is |
|---|---|
| `extension/manifest.json` | Chrome extension manifest (MV3) |
| `extension/slack.js` | everything slack-vim knows about Slack's markup (selectors, how to open things) |
| `extension/content.js` | the cursor, the keys and what they do; uses only `slack.js` |
| `extension/content.css` | how the cursor looks (reuses Slack's own hover style) |
| `extension/background.js` | dev reload hook (below) |
| `tests/behaviors.js` | live behavior tests |

Keep Slack-specific details in `slack.js`, so a Slack change is a fix in one
place. The README's key table is the spec: a change in behavior updates the
table and `tests/behaviors.js` together.

## Developing

1. Load `extension/` unpacked (see the README).
2. After an edit, reload the extension and the Slack tab. From the Slack tab's
   DevTools console you can skip `chrome://extensions`:

   ```js
   dispatchEvent(new Event("slack-vim:reload"));
   ```

   then reload the tab.

There is no build step and there are no dependencies.

## Testing

`tests/behaviors.js` presses the keys in a real Slack tab and checks what
happened:

1. Open a Slack channel. One with a thread in view covers the most.
2. Paste `tests/behaviors.js` into the DevTools console and read the table.
3. Run it again on a search results page to cover the search rows.

It never types, sends or reacts. It does open the current channel again, an
existing thread, and the empty reply box of a message without replies. Use a
channel where that's fine.

CI only checks that the files parse; please run the behavior tests before
sending a pull request and say what you ran it on.

## Style

- Plain JavaScript, no framework, no build.
- Match the surrounding code: small functions, short comments that say why.
- Two-space indent, LF line endings (see `.editorconfig`).
