// Everything slack-vim knows about Slack's page lives here. When Slack changes
// its markup, this is the file to fix; tests/behaviors.js says which part broke.
// eslint-disable-next-line no-unused-vars
const Slack = (() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const SEL = {
    sidebar: '[data-qa="channel-sidebar"] [role="tree"]',
    sidebarItem: '[role="treeitem"]',
    sidebarChannel: '[data-qa="channel-sidebar-channel"]',
    sidebarLink: '[data-qa^="channel_sidebar_"]', // Threads, Huddles, Drafts & sent, Saved, Directories
    sidebarHeading: '[data-qa^="section_heading_toggle"]', // "Starred", "Channels", …: not items
    sidebarFilter: '[data-qa="sidebar-text-filter-input_input"]', // "Find a conversation"
    search: '[data-qa="search_view"]', // results on the left; the opened result's channel shows on the right
    searchResult: '[data-qa="search_result"]',
    messages: '[data-qa="message_pane"]',
    thread: ".p-threads_flexpane",
    threadScroller: '.p-threads_flexpane [data-qa="slack_kit_scrollbar"]',
    threadList: '.p-threads_flexpane [id*="-thread-list"]', // id: <channel>-<parent ts>-thread-list-…
    threadClose: '[data-qa="threads_flexpane"] [data-qa="close_flexpane"]', // the thread's X
    listItem: '[role="listitem"]',
    message: '[data-qa="message_container"]', // data-msg-channel-id, data-msg-ts
    timestamp: '[data-qa="timestamp_label"]', // inside <a href=message link>
    messageText: '[data-qa="message-text"]', // what was written (not link previews or files)
    channelLink: '[data-qa="channel_link"]', // #channel mention
    replies: '[data-qa="reply_bar_count"]',
    messageHover: ".c-message_kit__hover", // shows the actions toolbar on mouseover
    startThread: '[data-qa="start_thread"]', // toolbar's "Reply in thread"
    // both the chat's box (below the message list) and the thread's reply box
    composer: '[data-qa="message_input"] [data-qa="texty_input"][contenteditable="true"]',
    topSearch: '[data-qa="top_nav_search"]',
    searchBox: '[data-qa="focusable_search_input"] [data-qa="texty_input"]', // opened by clicking topSearch
    channelName: '[data-qa="channel_name_button"]', // aria-label "Channel details for #name"
    modal: '[role="dialog"][aria-modal="true"]',
  };

  const visible = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? el : null;
  };
  const withMessage = (root) => (root ? $$(SEL.listItem, root).filter((li) => li.querySelector(SEL.message)) : []);

  const roots = {
    sidebar: () => visible($(SEL.sidebar)),
    search: () => visible($(SEL.search)),
    messages: () => visible($(SEL.messages)),
    thread: () => visible($(SEL.thread)),
  };

  return {
    SEL,
    AREAS: Object.keys(roots),
    root: (area) => roots[area](),

    // Items of an area in screen order (Slack only renders those near the viewport)
    items(area) {
      const root = roots[area]();
      if (!root) return [];
      if (area === "sidebar") return $$(SEL.sidebarItem, root).filter((li) => !li.querySelector(SEL.sidebarHeading) && visible(li));
      if (area === "search") return $$(SEL.listItem, root).filter((li) => li.querySelector(SEL.searchResult));
      return withMessage(root);
    },
    // Stable id of an item across re-renders (message ts, channel id, result id)
    key: (li) => li.getAttribute("data-item-key") || li.id || null,
    sidebarSelected: (items) => items.find((li) => li.getAttribute("aria-current") === "true"),

    // Message link: the timestamp links to the message (thread replies carry thread_ts)
    permalink: (li) => li.querySelector(SEL.timestamp)?.closest("a[href]")?.href || null,
    // Message ts a link points at (…/p1787595248385969 -> 1787595248.385969)
    // Links written in a message, in order, without repeats or #channel mentions
    links: (li) => [...new Set($$(`${SEL.messageText} a[href]`, li).filter((a) => !a.matches(SEL.channelLink)).map((a) => a.href))],
    tsOfLink: (link) => link?.match(/\/p(\d{10})(\d{6})/)?.slice(1).join(".") || null,
    hasReplies: (li) => !!li.querySelector(SEL.replies),

    isChannel: (li) => !!li.querySelector(SEL.sidebarChannel),
    openChannel: (li) => (li.querySelector(SEL.sidebarChannel) || li.querySelector(SEL.sidebarLink))?.click(),
    openThread: (li) => li.querySelector(SEL.replies)?.click(),
    // Hover a message as the mouse would (React's mouseenter is a mouseover from
    // outside), to reach its actions toolbar
    hover(li, on) {
      li.querySelector(SEL.messageHover)?.dispatchEvent(new MouseEvent(on ? "mouseover" : "mouseout", { bubbles: true, relatedTarget: document.body }));
    },
    startThreadButton: (li) => li.querySelector(SEL.startThread),
    openSearchResult: (li) => li.querySelector(SEL.searchResult)?.click(),
    closeThread() {
      const x = $(SEL.threadClose);
      x?.click();
      return !!x;
    },

    // Channel shown in the message pane (works on the search page too, where the URL doesn't change)
    paneChannel: () => $(`${SEL.messages} ${SEL.message}`)?.getAttribute("data-msg-channel-id") || null,
    sidebarChannelId: (li) => li.getAttribute("data-item-key"),
    // Parent message ts of the open thread
    threadParent: () => $(SEL.threadList)?.id.match(/^[A-Z0-9]+-(\d+\.\d+)-thread-list/)?.[1] || null,
    // Long threads open scrolled to the newest reply; go to the parent
    threadScrollTop() {
      const s = $(SEL.threadScroller);
      if (s) s.scrollTop = 0;
    },

    // Which area a message box belongs to: "messages", "thread", or null (search box, etc.)
    composerArea(el) {
      if (!el?.matches?.(SEL.composer.split(" ").pop()) || !el.closest('[data-qa="message_input"]') || el.closest(SEL.topSearch)) return null;
      return el.closest(SEL.thread) ? "thread" : "messages";
    },
    composerFor(area) {
      return $$(SEL.composer).find((el) => this.composerArea(el) === area) || null;
    },
    isEmpty: (el) => el.innerText.trim() === "",

    sidebarFilter: () => $(SEL.sidebarFilter),
    clearSidebarFilter() {
      const f = $(SEL.sidebarFilter);
      if (!f?.value) return;
      // React keeps its own copy of the value: set it the way typing would
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(f, "");
      f.dispatchEvent(new Event("input", { bubbles: true }));
    },
    // Name of the open channel; null for DMs and other views
    channelName: () => $(SEL.channelName)?.getAttribute("aria-label")?.match(/#(\S+)$/)?.[1] || null,
    // The search bar opens on a real-looking pointer press, not a bare click()
    openSearch() {
      const b = $(SEL.topSearch);
      if (!b) return false;
      const r = b.getBoundingClientRect();
      const o = { bubbles: true, cancelable: true, button: 0, clientX: r.x + 20, clientY: r.y + r.height / 2 };
      for (const [Ev, type] of [[PointerEvent, "pointerdown"], [MouseEvent, "mousedown"], [PointerEvent, "pointerup"], [MouseEvent, "mouseup"], [MouseEvent, "click"]]) b.dispatchEvent(new Ev(type, o));
      return true;
    },
    searchBox: () => $(SEL.searchBox),
    modalOpen: () => !!$(SEL.modal),
  };
})();
