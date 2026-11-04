// slack-vim: vim-style keys for Slack in Chrome. Spec: README.md.
// Slack's markup knowledge is in slack.js (loaded first, same isolated world).
/* global Slack */
(() => {
  // Areas: sidebar, search (results), messages, thread. H/L move between the
  // ones on screen, left to right: sidebar | messages | thread, or on the
  // search page: search | messages (the opened result's channel) | thread.
  const state = {
    area: "messages",
    keys: { sidebar: null, search: null, messages: null, thread: null }, // item under the cursor, per area
    on: false, // cursor shown (after a key; hidden while typing)
  };
  const html = document.documentElement;

  // ---------------------------------------------------------------- items
  function defaultItem(area, items) {
    if (area === "sidebar") return Slack.sidebarSelected(items) || items[0];
    if (area === "search") return items[0];
    if (area === "messages") return items[items.length - 1]; // newest
    const parent = Slack.threadParent();
    return items.find((li) => Slack.key(li) === parent) || items[0];
  }

  // Item the cursor is on in `area`; falls back to the default when it was unloaded
  function current(area = state.area) {
    const items = Slack.items(area);
    if (!items.length) return null;
    const key = state.keys[area];
    const li = (key && items.find((x) => Slack.key(x) === key)) || defaultItem(area, items);
    state.keys[area] = Slack.key(li);
    return li;
  }

  // areas on screen, left to right
  function onScreen() {
    return Slack.AREAS.map((a) => [a, Slack.root(a)])
      .filter(([, el]) => el)
      .sort((x, y) => x[1].getBoundingClientRect().left - y[1].getBoundingClientRect().left)
      .map(([a]) => a);
  }

  // ---------------------------------------------------------------- overlay
  // the cursor is an attribute on Slack's own item, styled like its hover
  // (content.css), so it scrolls and clips with the item
  let marked, toastEl;
  function draw() {
    const li = state.on ? current() : null;
    if (marked !== li) marked?.removeAttribute("data-slack-vim-cursor");
    li?.setAttribute("data-slack-vim-cursor", "");
    marked = li;
    html.dataset.slackVimArea = state.on ? state.area : ""; // read by tests/behaviors.js
    html.dataset.slackVimKey = (state.on && state.keys[state.area]) || "";
  }

  // follow Slack re-renders without a busy loop
  let queued = false;
  function redraw() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      draw();
    });
  }

  function toast(text, near) {
    toastEl?.remove();
    toastEl = Object.assign(document.createElement("div"), { className: "slack-vim-toast", textContent: text });
    document.body.append(toastEl);
    const r = (near || Slack.root(state.area) || document.body).getBoundingClientRect();
    Object.assign(toastEl.style, { top: `${Math.max(8, r.top + 4)}px`, left: `${Math.max(8, r.right - toastEl.offsetWidth - 12)}px` });
    const el = toastEl;
    setTimeout(() => el.remove(), 1200);
  }

  // Slack changed its page: say which part is missing instead of failing silently
  function missing(what) {
    console.warn(`[slack-vim] can't find ${what}; Slack's page may have changed (fix slack.js)`);
    toast(`slack-vim: can't find ${what}`);
  }

  // ---------------------------------------------------------------- helpers
  function show(area, li) {
    state.area = area;
    state.on = true;
    if (li) {
      state.keys[area] = Slack.key(li);
      li.scrollIntoView({ block: "nearest" });
    }
    draw();
  }

  // wait for `test` to hold (Slack renders asynchronously)
  function until(test, ms = 4000) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      (function poll() {
        const v = test();
        if (v || performance.now() - t0 > ms) return resolve(v);
        setTimeout(poll, 50);
      })();
    });
  }

  // Slack focuses the message box when a chat or thread opens; take it back
  function leaveComposer() {
    if (Slack.composerArea(document.activeElement)) document.activeElement.blur();
  }

  // ---------------------------------------------------------------- start positions
  let jumpTo = null; // message an opened search result points at; wins over "newest"

  function startOn(area) {
    if (area === "thread") return startThread();
    leaveComposer();
    const items = Slack.items(area);
    const target = jumpTo && items.find((li) => Slack.key(li) === jumpTo);
    state.keys[area] = target ? jumpTo : null;
    show(area, current(area));
  }

  // cursor on the thread's parent message, out of the reply box
  async function startThread() {
    const parent = Slack.threadParent();
    const rendered = () => Slack.items("thread").find((m) => Slack.key(m) === parent);
    if (!rendered()) {
      Slack.threadScrollTop();
      await until(rendered, 1500);
    }
    leaveComposer();
    state.keys.thread = null;
    show("thread", current("thread"));
  }

  // A chat, thread or search opening (any way: click, Cmd+K, Enter) starts on
  // its items, not in the message box. `i` or a click on the box types.
  let seen = { channel: null, thread: null, search: false };
  let armed = null; // { area, until } while Slack may still focus the box
  let clickedBox = false;

  function watchOpens() {
    const now = { channel: Slack.paneChannel(), thread: Slack.threadParent(), search: !!Slack.root("search") };
    let area = null;
    if (now.thread && now.thread !== seen.thread) area = "thread";
    else if (now.channel && now.channel !== seen.channel) area = "messages";
    else if (now.search && !seen.search) area = "search";
    seen = now;
    if (!area) return;
    if (area === "messages" && Slack.root("search") && !jumpTo) area = null; // a result previewed by hovering etc.
    if (!area) return;
    armed = { area, until: performance.now() + 1500 };
    startOn(area);
  }

  // ---------------------------------------------------------------- actions
  function move(delta) {
    const items = Slack.items(state.area);
    if (!items.length) return missing(`${state.area} items`);
    const cur = current();
    const next = items[items.indexOf(cur) + delta];
    if (next) return show(state.area, next);
    // at the edge of what Slack has rendered: scroll so it loads more, stay put
    cur.scrollIntoView({ block: delta < 0 ? "start" : "end" });
    show(state.area, cur);
  }

  // gg / G: first / last item (the sidebar renders all of them)
  // messages and threads render only what is near the screen: keep going
  // until Slack has no more to render past the end
  async function jumpEnd(last) {
    const area = state.area;
    for (let i = 0, prev; i < 20; i++) {
      const items = Slack.items(area);
      if (!items.length) return missing(`${area} items`);
      const li = last ? items[items.length - 1] : items[0];
      if (li === prev || state.area !== area) return;
      show(area, li);
      prev = li;
      if (area === "sidebar") return;
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  // ] / [ in the sidebar: next / previous channel or DM with unread messages
  function moveUnread(delta) {
    const items = Slack.items("sidebar");
    if (!items.length) return missing("sidebar items");
    const cur = current();
    for (let i = items.indexOf(cur) + delta; i >= 0 && i < items.length; i += delta) if (Slack.isUnread(items[i])) return show("sidebar", items[i]);
    show("sidebar", cur);
    toast(delta > 0 ? "no unread below" : "no unread above", cur);
  }

  function switchArea(delta) {
    const areas = onScreen();
    const i = areas.indexOf(state.area);
    const area = i < 0 ? areas[0] : areas[i + delta];
    if (!area) return;
    if (!Slack.items(area).length) return missing(`${area} items`);
    show(area, current(area));
  }

  async function enter() {
    const li = current();
    if (!li) return missing(`${state.area} items`);
    if (state.area === "sidebar") {
      if (!Slack.isChannel(li)) return Slack.openChannel(li); // Threads, Saved, …: no message list to go to
      const id = Slack.sidebarChannelId(li);
      armed = { area: "messages", until: performance.now() + 1500 }; // Slack focuses the box late, even for the open channel
      Slack.openChannel(li);
      if (!(await until(() => Slack.paneChannel() === id && Slack.items("messages").length))) return missing("the channel's messages");
      return startOn("messages"); // also when it was already open
    }
    if (state.area === "search") {
      jumpTo = Slack.tsOfLink(Slack.permalink(li));
      Slack.openSearchResult(li);
      const ok = await until(() => Slack.items("messages").find((m) => Slack.key(m) === jumpTo));
      if (ok) startOn("messages");
      else missing("the opened search result");
      jumpTo = null;
      return;
    }
    if (state.area === "messages") {
      const key = Slack.key(li);
      if (!Slack.hasReplies(li)) return replyInThread(li, key);
      Slack.openThread(li);
      if (!(await until(() => Slack.threadParent() === key && Slack.items("thread").length))) return missing("the thread");
      return startThread();
    }
  }

  // no thread yet: start one, in its reply box
  async function replyInThread(li, key) {
    Slack.hover(li, true);
    const button = await until(() => Slack.startThreadButton(li), 1000);
    button?.click();
    Slack.hover(li, false);
    if (!button) return missing("Reply in thread");
    // after the thread opening moved the cursor out of the reply box
    if (!(await until(() => seen.thread === key && Slack.composerFor("thread")))) return missing("the thread");
    state.area = "thread";
    insert();
  }

  // close the thread, cursor back on its parent message
  async function closeThread() {
    const parent = Slack.threadParent();
    if (!Slack.closeThread()) return missing("the thread's close button");
    if (!(await until(() => !Slack.root("thread"), 2000))) return missing("the thread closing");
    state.keys.messages = parent;
    show("messages", current("messages"));
  }

  // navigator.clipboard.writeText hangs on Slack's page; execCommand("copy")
  // works synchronously inside the key press and needs no focus change
  function copy(text) {
    const put = (e) => {
      e.clipboardData.setData("text/plain", text);
      e.preventDefault();
    };
    document.addEventListener("copy", put, true);
    try {
      return document.execCommand("copy");
    } finally {
      document.removeEventListener("copy", put, true);
    }
  }

  function yank() {
    const li = current();
    if (!li) return missing(`${state.area} items`);
    if (state.area === "sidebar") return toast("no link here", li);
    const link = Slack.permalink(li);
    if (!link) return missing("the message link");
    const ok = copy(link);
    html.dataset.slackVimCopied = link; // read by tests/behaviors.js
    html.dataset.slackVimCopyOk = ok ? "1" : "0";
    toast(ok ? "copied" : "copy failed", li);
  }

  // Y: every link written in the message, one per line
  function yankLinks() {
    const li = current();
    if (!li) return missing(`${state.area} items`);
    if (state.area === "sidebar") return toast("no link here", li);
    const links = Slack.links(li);
    if (!links.length) return toast("no links", li);
    const ok = copy(links.join("\n"));
    html.dataset.slackVimCopied = links.join("\n"); // read by tests/behaviors.js
    toast(ok ? `copied ${links.length} link${links.length > 1 ? "s" : ""}` : "copy failed", li);
  }

  // / searches the area: the sidebar's "Find a conversation" filter, or
  // Slack search limited to the open channel
  async function search() {
    if (state.area === "sidebar") {
      const f = Slack.sidebarFilter();
      if (!f) return missing("the sidebar filter");
      f.focus();
      return f.select();
    }
    const name = Slack.channelName();
    if (!Slack.openSearch()) return missing("the search bar");
    const box = await until(() => document.activeElement === Slack.searchBox() && document.activeElement, 1500);
    if (!box) return missing("the search box");
    // replace whatever the last search left
    const range = document.createRange();
    range.selectNodeContents(box);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    document.execCommand(name ? "insertText" : "delete", false, name ? `in:#${name} ` : undefined);
  }

  // Enter in the sidebar filter opens the first match; Esc gives up. Both clear it.
  function leaveFilter(f, open) {
    const first = Slack.items("sidebar")[0];
    f.blur();
    if (open && first) {
      state.area = "sidebar";
      state.keys.sidebar = Slack.key(first);
      enter().finally(() => Slack.clearSidebarFilter());
      return;
    }
    Slack.clearSidebarFilter();
    show("sidebar", current("sidebar"));
  }

  function insert() {
    const box = Slack.composerFor(state.area === "thread" ? "thread" : "messages");
    if (!box) return missing("the message box");
    armed = null;
    box.focus();
  }

  // ---------------------------------------------------------------- events
  const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  const interactive = (el) => el && el.closest && el.closest("button, a[href], [role=button], [role=menuitem], [role=option]");

  let gPressed = 0; // time of a first g, for gg

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
    const el = document.activeElement;
    let handled = false;

    if (typing(el)) {
      // Esc in an empty message box leaves it so the keys work
      const area = e.key === "Escape" && Slack.composerArea(el);
      if (area && Slack.isEmpty(el)) {
        el.blur();
        show(area, current(area));
        handled = true;
      } else if (el === Slack.sidebarFilter() && (e.key === "Enter" || e.key === "Escape")) {
        leaveFilter(el, e.key === "Enter");
        handled = true;
      }
    } else if (!Slack.modalOpen()) {
      const k = e.key;
      if (k === "j") (move(1), (handled = true));
      else if (k === "k") (move(-1), (handled = true));
      else if (k === "H") (switchArea(-1), (handled = true)); // like Shift+h / Shift+l between nvim splits
      else if (k === "L") (switchArea(1), (handled = true));
      else if (k === "y") (yank(), (handled = true));
      else if (k === "Y") (yankLinks(), (handled = true));
      else if (k === "i") (insert(), (handled = true));
      else if (k === "Enter" && !interactive(el)) (enter(), (handled = true));
      else if (k === "/" && (state.area === "sidebar" || state.area === "messages")) (search(), (handled = true));
      else if (k === "x" && state.on && state.area === "thread") (closeThread(), (handled = true));
      else if (k === "G" && state.on) (jumpEnd(true), (handled = true));
      else if ((k === "]" || k === "[") && state.on && state.area === "sidebar") (moveUnread(k === "]" ? 1 : -1), (handled = true));
      else if (k === "g" && state.on && state.area !== "messages") {
        if (performance.now() - gPressed < 1000) (jumpEnd(false), (gPressed = 0));
        else gPressed = performance.now();
        handled = true;
      }
      // any other letter would land in the message box as text
      else if (state.on && state.area === "sidebar") handled = k.length === 1;
    }
    // Slack sends stray letters into the message box; keep ours from reaching it
    if (handled) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  // clicking moves the cursor to what was clicked
  function onMouseDown(e) {
    clickedBox = !!e.target.closest?.('[data-qa="message_input"]');
    if (clickedBox) armed = null;
    for (const area of Slack.AREAS) {
      const root = Slack.root(area);
      if (!root || !root.contains(e.target)) continue;
      const li = Slack.items(area).find((x) => x.contains(e.target));
      if (li) {
        state.area = area;
        state.keys[area] = Slack.key(li);
        // a clicked search result opens on the right: land on its message
        if (area === "search") {
          jumpTo = Slack.tsOfLink(Slack.permalink(li));
          setTimeout(() => (jumpTo = null), 4000);
        }
        redraw();
      }
      return;
    }
  }

  function onFocusIn(e) {
    // armed for its whole window: Slack can focus the box more than once
    if (Slack.composerArea(e.target) && armed && performance.now() < armed.until && !clickedBox) return startOn(armed.area);
    if (typing(e.target) && state.on) {
      state.on = false;
      draw();
    }
  }

  // capture phase: run before Slack's own listeners
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("mousedown", onMouseDown, true);
  window.addEventListener("focusin", onFocusIn, true);
  let watchQueued = false;
  new MutationObserver(() => {
    if (state.on) redraw();
    if (watchQueued) return;
    watchQueued = true;
    setTimeout(() => ((watchQueued = false), watchOpens()), 100);
  }).observe(document, { childList: true, subtree: true });

  // dev: reload the extension from disk (see background.js)
  window.addEventListener("slack-vim:reload", () => chrome.runtime.sendMessage("reload"));
  html.dataset.slackVimLoaded = "1";
})();
