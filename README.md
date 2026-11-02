# slack-vim

Vim-style keys for Slack in Chrome: move through conversations, messages and
threads, open them, reply, search and copy message links without the mouse.

Works on `app.slack.com`, in a normal tab or with Slack installed as a Chrome
app. No permissions beyond running on that site; nothing leaves your browser.

Not affiliated with or endorsed by Slack.

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
| `i` | type in the chat's box | — | type in the chat's box | type in the reply box |
| `x` | — | — | — | close the thread, cursor back on its message |
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

## When Slack changes its page

slack-vim reads Slack's page markup, which Slack can change at any time.

- A key that can't find what it needs flashes `slack-vim: can't find …` and
  logs `[slack-vim] can't find …` in the console, naming the missing part.
- Everything slack-vim knows about Slack's markup is in
  [`extension/slack.js`](extension/slack.js); that is usually the only file to
  fix.
- [`tests/behaviors.js`](tests/behaviors.js) checks every behavior above
  against live Slack. See [CONTRIBUTING.md](CONTRIBUTING.md).

Please [open an issue](https://github.com/sandeshghanta/slack-vim/issues) with
the `can't find …` message if you hit one.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
