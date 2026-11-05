# slack-vim

Vim-style keys for Slack in Chrome: move through conversations, messages and
threads, open them, reply, search and copy message links without the mouse.

Works on `app.slack.com`, in a normal tab or with Slack installed as a Chrome
app. No permissions beyond running on that site; nothing leaves your browser.

Not affiliated with or endorsed by Slack.

> **A personal project.** These are the keys I wanted, and I change them when
> I want to. There's no promise of maintenance, support or stability: Slack
> changes its page often and things may break until I get to them (or forever).
> Issues and pull requests are welcome, but may not get a reply.

## Install

slack-vim isn't on the Chrome Web Store. Load it unpacked:

1. Download `slack-vim-X.Y.Z.zip` from the
   [latest release](https://github.com/sandeshghanta/slack-vim/releases/latest)
   and unzip it, or `git clone` this repo and use its `extension/` folder.
2. Open `chrome://extensions`, turn on **Developer mode**, click
   **Load unpacked** and pick that folder.
3. Reload any open Slack tabs.

To update, replace the folder with the new release (or `git pull`), click the
extension's reload button in `chrome://extensions`, then reload Slack. Changes
are listed in [CHANGELOG.md](CHANGELOG.md).

If you use [Vimium](https://github.com/philc/vimium), turn it off on Slack so
the two don't fight over keys: Vimium options → **Excluded URLs and keys** →
add `https://app.slack.com/*` with the keys field empty.

## Keys

There is one cursor, in one area at a time. `H` / `L` (Shift) move between the
areas on screen, left to right:

- a chat: **sidebar** | **messages** | **thread** (when open)
- the search page: **results** | **messages** (the opened result's channel) | **thread**

Keys work only when you are not typing in a box.

| Key | Sidebar | Search results | Messages | Thread |
|---|---|---|---|---|
| `j` / `k` | next / previous item (Threads, Saved, … and channels) | next / previous result | next / previous message | next / previous reply |
| `Enter` | open it | open the result on the right, cursor on its message | open its thread, or start one in its reply box | — |
| `y` | — | copy the result's link | copy the message link | copy the reply link |
| `Y` | — | copy the non-Slack links in the result | copy the non-Slack links in the message | copy the non-Slack links in the reply |
| `i` | type in the chat's box | — | type in the chat's box | type in the reply box |
| `x` | — | — | — | close the thread, cursor back on its message |
| `]` / `[` | next / previous unread channel or DM | — | — | — |
| `gg` / `G` | first (Threads) / last item | first / last result | `G`: newest message | first (the parent) / last reply |
| `/` | filter conversations | — | search this channel (`in:#name`; plain search in a DM) | — |

- Opening a chat, thread or search (any way: click, `Cmd+K`, `Enter`) starts
  on its items, not in the message box: the cursor is on the newest message,
  the thread's parent message, or the first result.
- In the sidebar, other letters do nothing (Slack would type them into the
  message box).
- In the sidebar filter, `Enter` opens the first match and `Esc` gives up;
  both clear the filter.
- `Esc` in an empty message box leaves it so the keys work. Any other `Esc`
  goes to Slack.
- `i` or a click on the message box types. Clicking a message, channel or
  reply moves the cursor there.

## Customizing

Everyone has opinions about keymaps, so there are no settings. Fork the repo
and change it: point Claude Code (or another coding agent) at your fork and
describe the keys you want. The README's key table is the spec it should
update, the keys are handled in `onKey` in
[`extension/content.js`](extension/content.js), and
[`tests/behaviors.js`](tests/behaviors.js) checks the result in a live Slack
tab.

## When Slack changes its page

slack-vim reads Slack's page markup, which Slack can change at any time.

- A key that can't find what it needs flashes `slack-vim: can't find …` and
  logs `[slack-vim] can't find …` in the console, naming the missing part.
- Everything slack-vim knows about Slack's markup is in
  [`extension/slack.js`](extension/slack.js); that is usually the only file to
  fix.
- [`tests/behaviors.js`](tests/behaviors.js) checks every behavior above
  against live Slack. See [CONTRIBUTING.md](CONTRIBUTING.md).

If you hit one, an [issue](https://github.com/sandeshghanta/slack-vim/issues)
with the `can't find …` message helps, though a fix isn't guaranteed.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
