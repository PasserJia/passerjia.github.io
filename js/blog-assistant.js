(() => {
  const homePath = /^\/(?:page\/\d+\/?)?$/;
  if (!homePath.test(window.location.pathname)) return;

  const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const apiBase = window.BLOG_ASSISTANT_API
    || (local ? 'http://127.0.0.1:18100' : 'https://ai.passerjia.com/blog-assistant-api');
  const id = () => crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const conversationKey = 'passerjia-blog-assistant-conversation';
  let conversationId = sessionStorage.getItem(conversationKey) || id();
  sessionStorage.setItem(conversationKey, conversationId);

  // Lucide icon paths, ISC licensed.
  const icons = {
    chat: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8"/><path d="M8 13h5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    sparkles: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/>',
    rotate: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>'
  };
  const icon = name => `<svg class="pj-chat-icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;

  const root = document.createElement('div');
  root.className = 'pj-chat-root';
  root.innerHTML = `
    <section class="pj-chat-panel" role="dialog" aria-modal="false" aria-label="博客知识库问答">
      <header class="pj-chat-header">
        <span class="pj-chat-avatar">${icon('sparkles')}</span>
        <span class="pj-chat-title"><strong>博客知识助手</strong><small>基于知识库回答</small></span>
        <button class="pj-chat-reset" type="button" title="清空对话" aria-label="清空对话">${icon('rotate')}</button>
      </header>
      <div class="pj-chat-messages" aria-live="polite"></div>
      <form class="pj-chat-composer">
        <textarea class="pj-chat-input" rows="1" maxlength="1000" placeholder="问问博客里的内容" aria-label="输入问题"></textarea>
        <button class="pj-chat-send" type="submit" aria-label="发送问题">${icon('send')}</button>
      </form>
    </section>
    <button class="pj-chat-launcher" type="button" aria-label="打开博客知识助手" aria-expanded="false">
      <span class="pj-icon-chat">${icon('chat')}</span><span class="pj-icon-close">${icon('x')}</span>
    </button>`;
  document.body.appendChild(root);

  const panel = root.querySelector('.pj-chat-panel');
  const launcher = root.querySelector('.pj-chat-launcher');
  const messages = root.querySelector('.pj-chat-messages');
  const composer = root.querySelector('.pj-chat-composer');
  const input = root.querySelector('.pj-chat-input');
  const send = root.querySelector('.pj-chat-send');
  const reset = root.querySelector('.pj-chat-reset');
  let busy = false;

  function addMessage(kind, text = '') {
    const wrapper = document.createElement('div');
    wrapper.className = `pj-chat-message is-${kind}`;
    const bubble = document.createElement('div');
    bubble.className = 'pj-chat-bubble';
    bubble.textContent = text;
    wrapper.appendChild(bubble);
    messages.appendChild(wrapper);
    scrollToBottom();
    return { wrapper, bubble };
  }

  function welcome() {
    messages.replaceChildren();
    addMessage('assistant', '你好，我会根据博客知识库回答问题。');
    const suggestions = document.createElement('div');
    suggestions.className = 'pj-chat-suggestions';
    ['Quartz 持久化需要哪些表？', '这篇博客有哪些技术内容？'].forEach(question => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pj-chat-suggestion';
      button.textContent = question;
      button.addEventListener('click', () => ask(question));
      suggestions.appendChild(button);
    });
    messages.appendChild(suggestions);
  }

  function resetConversation() {
    conversationId = id();
    sessionStorage.setItem(conversationKey, conversationId);
    welcome();
  }

  function setOpen(open) {
    root.classList.toggle('is-open', open);
    launcher.setAttribute('aria-expanded', String(open));
    launcher.setAttribute('aria-label', open ? '关闭博客知识助手' : '打开博客知识助手');
    panel.setAttribute('aria-hidden', String(!open));
    if (open) setTimeout(() => input.focus(), 180);
  }

  function scrollToBottom() {
    requestAnimationFrame(() => { messages.scrollTop = messages.scrollHeight; });
  }

  function resizeInput() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 92)}px`;
  }

  async function ask(question) {
    const normalized = question.trim();
    if (!normalized || busy) return;
    busy = true;
    send.disabled = true;
    root.querySelector('.pj-chat-suggestions')?.remove();
    addMessage('user', normalized);
    input.value = '';
    resizeInput();
    const answer = addMessage('assistant');
    answer.bubble.innerHTML = '<span class="pj-chat-typing"><i></i><i></i><i></i></span>';
    let started = false;
    let sources = [];

    try {
      const response = await fetch(`${apiBase}/api/public/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: normalized, conversationId, requestId: id() })
      });
      if (!response.ok || !response.body) {
        const problem = await response.json().catch(() => null);
        throw new Error(problem?.message || '服务暂时不可用');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || '';
        for (const block of blocks) {
          const event = block.match(/^event:(.+)$/m)?.[1]?.trim();
          const dataLine = block.match(/^data:(.+)$/m)?.[1]?.trim();
          if (!event || !dataLine) continue;
          const data = JSON.parse(dataLine);
          if (event === 'meta' && data.conversationId) {
            conversationId = data.conversationId;
            sessionStorage.setItem(conversationKey, conversationId);
          }
          if (event === 'sources') sources = data.sources || [];
          if (event === 'delta') {
            if (!started) { answer.bubble.textContent = ''; started = true; }
            answer.bubble.textContent += data.text || '';
            scrollToBottom();
          }
        }
        if (done) break;
      }
      if (!started) answer.bubble.textContent = '知识库暂时没有返回内容。';
      if (sources.length) {
        const sourceList = document.createElement('div');
        sourceList.className = 'pj-chat-sources';
        sources.slice(0, 3).forEach(source => {
          const item = document.createElement(source.url ? 'a' : 'span');
          item.className = 'pj-chat-source';
          item.textContent = source.heading ? `${source.title} / ${source.heading}` : source.title;
          item.title = `${item.textContent} · v${source.documentVersion || 1} · ${source.retrievalMethod || 'HYBRID'} · ${Math.round((source.score || 0) * 100)}%`;
          if (source.url) {
            item.href = source.url;
            item.target = '_blank';
            item.rel = 'noopener';
          }
          sourceList.appendChild(item);
        });
        answer.wrapper.appendChild(sourceList);
      }
    } catch (error) {
      answer.bubble.textContent = error.message || '服务暂时不可用，请稍后再试。';
    } finally {
      busy = false;
      send.disabled = false;
      scrollToBottom();
      input.focus();
    }
  }

  launcher.addEventListener('click', () => setOpen(!root.classList.contains('is-open')));
  reset.addEventListener('click', resetConversation);
  composer.addEventListener('submit', event => { event.preventDefault(); ask(input.value); });
  input.addEventListener('input', resizeInput);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask(input.value); }
    if (event.key === 'Escape') setOpen(false);
  });

  welcome();
})();
