// ============================================================
// @MENTION EDITOR
// ============================================================

let mentionState = {
  active: false,
  query: '',
  startOffset: 0,
  anchorNode: null,
  selectedIdx: 0,
};

let mentionHideMap = {}; // { userName: bool }

function initMentionEditor() {
  const editor   = document.getElementById('question-editor');
  const dropdown = document.getElementById('mention-dropdown');
  if (!editor) return;

  editor.innerHTML = '';
  mentionHideMap = {};
  updateHideBanner();

  // Remove old listeners by cloning
  const fresh = editor.cloneNode(true);
  editor.parentNode.replaceChild(fresh, editor);

  fresh.addEventListener('input', onEditorInput);
  fresh.addEventListener('keydown', onEditorKeydown);
  document.addEventListener('click', e => {
    if (!e.target.closest('.mention-wrap')) closeMentionDropdown();
  });
}

function onEditorInput() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range  = sel.getRangeAt(0);
  const node   = range.startContainer;
  const offset = range.startOffset;

  if (node.nodeType !== Node.TEXT_NODE) { closeMentionDropdown(); return; }

  const textBefore = node.textContent.slice(0, offset);
  const atIdx = textBefore.lastIndexOf('@');

  if (atIdx === -1) { closeMentionDropdown(); return; }

  const query = textBefore.slice(atIdx + 1);
  if (/\s/.test(query)) { closeMentionDropdown(); return; }

  mentionState = { active: true, query, startOffset: atIdx, anchorNode: node, selectedIdx: 0 };
  showMentionDropdown(query);
  updateHideBanner();
}

function onEditorKeydown(e) {
  const dropdown = document.getElementById('mention-dropdown');
  if (!mentionState.active || !dropdown.classList.contains('open')) return;

  const options = dropdown.querySelectorAll('.mention-option');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    mentionState.selectedIdx = Math.min(mentionState.selectedIdx + 1, options.length - 1);
    renderDropdownSelection();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    mentionState.selectedIdx = Math.max(mentionState.selectedIdx - 1, 0);
    renderDropdownSelection();
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    const sel = options[mentionState.selectedIdx];
    if (sel) { e.preventDefault(); commitMention(sel.dataset.name); }
  } else if (e.key === 'Escape') {
    closeMentionDropdown();
  }
}

function getMentionCandidates(query) {
  const q = query.toLowerCase();
  return Object.keys(state.users)
    .filter(n => n !== currentUser && n.toLowerCase().startsWith(q));
}

function showMentionDropdown(query) {
  const dropdown  = document.getElementById('mention-dropdown');
  const candidates = getMentionCandidates(query);

  if (!candidates.length) { closeMentionDropdown(); return; }

  mentionState.selectedIdx = 0;
  dropdown.innerHTML = candidates.map((name, i) =>
    `<div class="mention-option${i === 0 ? ' selected' : ''}" data-name="${name}" onclick="commitMention('${name}')">
      <div class="mention-avatar">${name[0].toUpperCase()}</div>
      <span>${name}</span>
    </div>`
  ).join('');
  dropdown.classList.add('open');
}

function renderDropdownSelection() {
  const dropdown = document.getElementById('mention-dropdown');
  dropdown.querySelectorAll('.mention-option').forEach((el, i) => {
    el.classList.toggle('selected', i === mentionState.selectedIdx);
  });
}

function closeMentionDropdown() {
  document.getElementById('mention-dropdown')?.classList.remove('open');
  mentionState.active = false;
}

function commitMention(name) {
  const { anchorNode, startOffset } = mentionState;
  if (!anchorNode) return;

  const sel   = window.getSelection();
  const range = sel.getRangeAt(0);

  const deleteRange = document.createRange();
  deleteRange.setStart(anchorNode, startOffset);
  deleteRange.setEnd(anchorNode, range.startOffset);
  deleteRange.deleteContents();

  const chip = document.createElement('span');
  chip.className     = 'mention-chip';
  chip.contentEditable = 'false';
  chip.dataset.mention = name;
  chip.textContent   = `@${name}`;

  const space       = document.createTextNode('\u00A0');
  const insertRange = document.createRange();
  insertRange.setStart(anchorNode, startOffset);
  insertRange.collapse(true);
  insertRange.insertNode(space);
  insertRange.insertNode(chip);

  const newRange = document.createRange();
  newRange.setStartAfter(space);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);

  closeMentionDropdown();

  if (!(name in mentionHideMap)) mentionHideMap[name] = true;
  updateHideBanner();
}

function updateHideBanner() {
  const editor = document.getElementById('question-editor');
  if (!editor) return;
  const chips    = editor.querySelectorAll('.mention-chip[data-mention]');
  const mentioned = [...new Set([...chips].map(c => c.dataset.mention))];

  Object.keys(mentionHideMap).forEach(n => {
    if (!mentioned.includes(n)) delete mentionHideMap[n];
  });

  const banner    = document.getElementById('hide-banner');
  const togglesEl = document.getElementById('hide-toggles');
  if (!banner || !togglesEl) return;

  if (mentioned.length === 0) { banner.style.display = 'none'; return; }

  banner.style.display = 'block';
  togglesEl.innerHTML = mentioned.map(name => `
    <div class="hide-toggle-row">
      <span>🙈 Masquer ce marché à <b>${name}</b> jusqu'à la résolution</span>
      <label class="toggle-switch">
        <input type="checkbox" id="hide-toggle-${name}" ${mentionHideMap[name] ? 'checked' : ''}
          onchange="mentionHideMap['${name}'] = this.checked">
        <span class="toggle-slider"></span>
      </label>
    </div>
  `).join('');
}

function getEditorText() {
  const editor = document.getElementById('question-editor');
  if (!editor) return '';
  let text = '';
  editor.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList.contains('mention-chip')) {
        text += `@${node.dataset.mention}`;
      } else {
        text += node.innerText || node.textContent;
      }
    }
  });
  return text.replace(/\u00A0/g, ' ').trim();
}

function getHiddenFrom() {
  return Object.entries(mentionHideMap)
    .filter(([, hide]) => hide)
    .map(([name]) => name);
}
