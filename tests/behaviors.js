// Live behavior tests for slack-vim. Run in an app.slack.com tab with the
// extension loaded (paste into the DevTools console, or run it through browser
// automation). It presses the spec's keys and checks what happened, so a
// Slack markup change shows up as the behavior that broke. Non-destructive:
// it never types, sends or reacts. It opens the current channel again, an
// existing thread if one is visible, and the (empty) reply box of a message
// without replies.
(async () => {
  const html = document.documentElement;
  const st = () => ({ area: html.dataset.slackVimArea || "", key: html.dataset.slackVimKey || "" });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const press = async (key, target = document.activeElement || document.body, wait = key === "Enter" ? 1500 : 150) => {
    const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    target.dispatchEvent(e);
    await sleep(wait);
    return e.defaultPrevented;
  };
  // A synthetic key press can't write the clipboard (Chrome wants a real one),
  // so y is checked by the link it computed; a real press says "copied".
  const copied = () => html.dataset.slackVimCopied || "";
  const results = [];
  const check = (name, ok, detail = "") => results.push({ behavior: name, result: ok ? "pass" : "FAIL", detail });
  const skip = (name, why) => results.push({ behavior: name, result: "skip", detail: why });
  const permalink = /^https:\/\/[\w-]+\.slack\.com\/archives\/[A-Z0-9]+\/p\d{16}/;

  // On a search results page: results on the left, the opened result's channel on the right
  const search = document.querySelector('[data-qa="search_view"]');
  if (search) {
    const results_ = [...search.querySelectorAll('[role="listitem"]')].filter((li) => li.querySelector('[data-qa="search_result"]'));
    const keyOf = (li) => li && (li.getAttribute("data-item-key") || li.id);
    document.activeElement?.blur?.();
    await press("k");
    check("cursor starts on a search result", st().area === "search" && results_.some((li) => keyOf(li) === st().key), JSON.stringify(st()));
    await press("j");
    check("j moves to the next result", st().key === keyOf(results_[1]), JSON.stringify(st()));
    delete html.dataset.slackVimCopied;
    await press("y");
    await sleep(200);
    check("y copies the result's link", permalink.test(copied()), copied().replace(/\/p\d+.*/, "/p…"));
    const want = (copied().match(/\/p(\d{10})(\d{6})/) || []).slice(1).join(".");
    await press("Enter", undefined, 3500);
    check("Enter opens the result on the right, cursor on its message", st().area === "messages" && st().key === want && !document.activeElement.isContentEditable, JSON.stringify(st()));
    await press("H");
    check("H back to the results", st().area === "search", JSON.stringify(st()));
    await press("L");
    check("L to the opened channel", st().area === "messages", JSON.stringify(st()));
    console.table(results);
    return results;
  }

  const composer = [...document.querySelectorAll('[data-qa="message_input"] [data-qa="texty_input"][contenteditable="true"]')].find((el) => !el.closest(".p-threads_flexpane"));

  // 1. typing is never intercepted
  if (composer) {
    composer.focus();
    check("keys pass through while typing", !(await press("j", composer)), "j in the message box");
  } else skip("keys pass through while typing", "no message box (read-only channel?)");

  // 2. Esc in an empty message box enters the cursor
  if (composer && composer.innerText.trim() === "") {
    composer.focus();
    const handled = await press("Escape", composer);
    check("Esc in empty message box", handled && st().area === "messages" && !!st().key, JSON.stringify(st()));
  } else {
    document.activeElement?.blur?.();
    await press("k"); // any key starts the cursor
    skip("Esc in empty message box", composer ? "message box has a draft" : "no message box");
  }

  // 3. j / k move between messages
  await press("k");
  const a = st().key;
  await press("k");
  const b = st().key;
  await press("j");
  const c = st().key;
  check("k moves up, j moves down", st().area === "messages" && a && b && a !== b && c === a, `${a} -> ${b} -> ${c}`);

  // 4. y copies the message link
  delete html.dataset.slackVimCopied;
  await press("y");
  await sleep(200);
  check("y copies message link", permalink.test(copied()), (copied() || "no link").replace(/\/p\d+.*/, "/p…"));

  // 5. H to the sidebar lands on the open channel; j/k there
  await press("H");
  const sel = document.querySelector('[data-qa="channel-sidebar"] [role="treeitem"][aria-current="true"]');
  check("H moves to sidebar, on the open channel", st().area === "sidebar" && sel && st().key === sel.getAttribute("data-item-key"), JSON.stringify(st()));
  await press("j");
  const moved = st().key;
  await press("k");
  check("j / k in sidebar", moved && moved !== st().key && st().area === "sidebar", `${moved} / ${st().key}`);
  await press("H");
  check("H at the left edge stays in sidebar", st().area === "sidebar");
  const sidebarItems = [...document.querySelectorAll('[data-qa="channel-sidebar"] [role="treeitem"]')].filter((li) => !li.querySelector('[data-qa^="section_heading_toggle"]'));
  await press("G");
  check("G in sidebar goes to the last item", st().key === sidebarItems.at(-1)?.getAttribute("data-item-key"), JSON.stringify(st()));
  await press("g");
  await press("g");
  check("gg in sidebar goes to the top item (Threads)", st().key === sidebarItems[0]?.getAttribute("data-item-key"), JSON.stringify(st()));
  const firstChannel = sidebarItems.findIndex((li) => li.querySelector('[data-qa="channel-sidebar-channel"]'));
  for (let i = 0; i < firstChannel; i++) await press("j");
  await press("k");
  check("k from the first channel goes up into Threads … Directories", st().key === sidebarItems[firstChannel - 1]?.getAttribute("data-item-key"), JSON.stringify(st()));
  check("other letters in sidebar don't reach Slack", await press("q") && st().area === "sidebar");
  // / filters the sidebar; Esc gives up and clears it
  const filter = document.querySelector('[data-qa="sidebar-text-filter-input_input"]');
  await press("/");
  check("/ in sidebar focuses the conversation filter", document.activeElement === filter);
  if (document.activeElement === filter && sel) {
    const name = sel.querySelector('[data-qa^="channel_sidebar_name_"]')?.getAttribute("data-qa").replace("channel_sidebar_name_", "");
    document.execCommand("insertText", false, name);
    await sleep(600);
    await press("Escape", filter, 300);
    check("Esc in the filter clears it, cursor in the sidebar", !filter.value && document.activeElement !== filter && st().area === "sidebar", JSON.stringify(st()));
    // Enter opens the first match (the open channel, so nothing changes)
    await press("/");
    document.execCommand("insertText", false, name);
    await sleep(600);
    await press("Enter", filter, 2000);
    check("Enter in the filter opens the first match", !filter.value && st().area === "messages" && !document.activeElement.isContentEditable, JSON.stringify(st()));
    await press("H");
  }
  sel?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); // back on the open channel
  await sleep(100);

  // 6. Enter on a channel opens it with the cursor on its newest message
  await press("Enter");
  await sleep(500);
  const msgs = [...document.querySelectorAll('[data-qa="message_pane"] [role="listitem"]')].filter((li) => li.querySelector('[data-qa="message_container"]'));
  const newest = msgs[msgs.length - 1];
  check("Enter on channel opens it, cursor on newest message", st().area === "messages" && newest && st().key === newest.getAttribute("data-item-key") && !document.activeElement.isContentEditable, JSON.stringify(st()));
  await press("k");
  await press("k");
  await press("G", undefined, 600);
  check("G in messages goes to the newest message", st().key === newest?.getAttribute("data-item-key"), JSON.stringify(st()));

  // 7. Enter on a message without replies starts a thread, in its reply box
  const noReplies = [...msgs].reverse().find((li) => !li.querySelector('[data-qa="reply_bar_count"]'));
  if (noReplies) {
    noReplies.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await sleep(100);
    await press("Enter", undefined, 2500);
    const box = document.activeElement;
    const parent = document.querySelector('.p-threads_flexpane [id*="-thread-list"]')?.id.match(/-(\d+\.\d+)-thread-list/)?.[1];
    check("Enter on message without replies opens its reply box", parent === noReplies.getAttribute("data-item-key") && box.isContentEditable && !!box.closest(".p-threads_flexpane"), `parent ${parent}`);
    if (box.isContentEditable && box.innerText.trim() === "") await press("Escape", box);
    if (!document.activeElement.isContentEditable) await press("x", undefined, 1000);
  } else skip("Enter on message without replies", "every visible message has replies");

  // 8. Enter on a message with replies opens the thread, cursor on the parent
  const withReplies = [...msgs].reverse().find((li) => li.querySelector('[data-qa="reply_bar_count"]'));
  if (withReplies) {
    withReplies.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await sleep(100);
    await press("Enter");
    await sleep(500);
    check("Enter on message opens its thread", st().area === "thread" && st().key === withReplies.getAttribute("data-item-key") && !document.activeElement.isContentEditable, JSON.stringify(st()));
    await press("j");
    delete html.dataset.slackVimCopied;
    await press("y");
    await sleep(200);
    const link = copied();
    check("y in thread copies reply link", permalink.test(link) && /thread_ts=/.test(link), link.replace(/\/p\d+.*/, "/p…"));
    await press("H");
    check("H from thread to messages", st().area === "messages");
    await press("L");
    check("L from messages to thread", st().area === "thread");
    await press("L");
    check("L at the right edge stays in thread", st().area === "thread");
    const replies = [...document.querySelectorAll('.p-threads_flexpane [role="listitem"]')].filter((li) => li.querySelector('[data-qa="message_container"]'));
    await press("G", undefined, 600);
    check("G in thread goes to the last reply", st().key === replies.at(-1)?.getAttribute("data-item-key"), JSON.stringify(st()));
    await press("g");
    await press("g", undefined, 600);
    check("gg in thread goes to the parent", st().key === withReplies.getAttribute("data-item-key"), JSON.stringify(st()));
    await press("i");
    const reply = document.activeElement;
    const inReply = reply.isContentEditable && !!reply.closest(".p-threads_flexpane");
    check("i in thread focuses the reply box", inReply, reply.getAttribute("data-qa") || reply.tagName);
    if (inReply && reply.innerText.trim() === "") {
      await press("Escape", reply);
      check("Esc from the reply box back to the thread", st().area === "thread" && !document.activeElement.isContentEditable, JSON.stringify(st()));
    }
    if (!document.activeElement.isContentEditable) {
      await press("x", undefined, 1000);
      check("x closes the thread, cursor on its message", !document.querySelector(".p-threads_flexpane") && st().area === "messages" && st().key === withReplies.getAttribute("data-item-key"), JSON.stringify(st()));
    } else skip("x closes the thread", "still in the reply box (draft?)");
  } else skip("thread behaviors", "no message with replies in view");

  // 9. opening a chat by clicking it starts on the messages, not the message box
  const home = document.querySelector('[data-qa="channel-sidebar"] [role="treeitem"][aria-current="true"]');
  const other = home && [...document.querySelectorAll('[data-qa="channel-sidebar"] [role="treeitem"]')].find((li) => li !== home && li.querySelector('[data-qa="channel-sidebar-channel"]'));
  if (other) {
    other.querySelector('[data-qa="channel-sidebar-channel"]').click();
    await sleep(2500);
    const last = [...document.querySelectorAll('[data-qa="message_pane"] [role="listitem"]')].filter((li) => li.querySelector('[data-qa="message_container"]')).pop();
    check("clicking a chat starts on its newest message", st().area === "messages" && last && st().key === last.getAttribute("data-item-key") && !document.activeElement.isContentEditable, JSON.stringify(st()));
    home.querySelector('[data-qa="channel-sidebar-channel"]').click();
    await sleep(2500);
  } else skip("clicking a chat starts on its newest message", "no other channel in the sidebar");

  // 10. / in the messages searches the channel
  const channelName = document.querySelector('[data-qa="channel_name_button"]')?.getAttribute("aria-label")?.match(/#(\S+)$/)?.[1];
  document.activeElement?.blur?.();
  await press("k");
  await press("/", undefined, 1200);
  const q = document.activeElement;
  const inSearch = q.getAttribute("aria-label") === "Query" && !q.closest('[data-qa="message_input"]');
  check("/ in messages opens search limited to the channel", inSearch && (channelName ? q.innerText.trim() === `in:#${channelName}` : q.innerText.trim() === ""), q.innerText.trim());
  if (inSearch) {
    const r = document.createRange();
    r.selectNodeContents(q);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    document.execCommand("delete");
    q.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await sleep(500);
  }

  // 11. i goes into the message box, Esc comes back
  if (composer) {
    await press("i");
    const box = document.activeElement;
    const inBox = box.isContentEditable && !!box.closest('[data-qa="message_input"]');
    check("i focuses the message box", inBox && !st().area, box.getAttribute("data-qa"));
    if (inBox && box.innerText.trim() === "") {
      await press("Escape", box);
      check("Esc from the box after i", st().area !== "" && !document.activeElement.isContentEditable, JSON.stringify(st()));
    }
  } else skip("i focuses the message box", "no message box");

  skip("search results", "run again on a search results page");
  console.table(results);
  return results;
})();
