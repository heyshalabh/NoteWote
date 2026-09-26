/**
 * NoteWote— Notes App
 * Vanilla JS · LocalStorage persistence
 */

(() => {
  "use strict";

  // ---------- State ----------
  const STORAGE_KEY = "noteflow_notes_v1";
  const THEME_KEY = "noteflow_theme";

  let notes = [];
  let currentFilter = "all"; // all | pinned | favourites | archive | tag:xxx
  let searchQuery = "";
  let editingId = null; // null = new note
  let deleteTargetId = null;
  let focusNoteId = null;
  let selectedColour = "yellow";

  // ---------- DOM refs ----------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const notesGrid = $("#notesGrid");
  const emptyState = $("#emptyState");
  const emptyTitle = $("#emptyTitle");
  const emptyText = $("#emptyText");
  const emptyAddBtn = $("#emptyAddBtn");
  const searchInput = $("#searchInput");
  const searchClear = $("#searchClear");
  const pageTitle = $("#pageTitle");
  const addNoteBtn = $("#addNoteBtn");
  const tagsList = $("#tagsList");
  const themeToggle = $("#themeToggle");
  const themeIcon = $("#themeIcon");
  const themeLabel = $("#themeLabel");
  const sidebar = $("#sidebar");
  const menuBtn = $("#menuBtn");
  const sidebarClose = $("#sidebarClose");

  // Editor
  const editorModal = $("#editorModal");
  const editorTitle = $("#editorTitle");
  const noteTitle = $("#noteTitle");
  const noteContent = $("#noteContent");
  const noteTag = $("#noteTag");
  const notePinned = $("#notePinned");
  const noteFavourite = $("#noteFavourite");
  const colourPicker = $("#colourPicker");
  const charCount = $("#charCount");
  const wordCount = $("#wordCount");
  const editorSave = $("#editorSave");
  const editorCancel = $("#editorCancel");
  const editorClose = $("#editorClose");
  const tagSuggestions = $("#tagSuggestions");

  // Delete
  const deleteModal = $("#deleteModal");
  const deleteConfirm = $("#deleteConfirm");
  const deleteCancel = $("#deleteCancel");

  // Focus
  const focusMode = $("#focusMode");
  const focusBack = $("#focusBack");
  const focusSave = $("#focusSave");
  const focusTitle = $("#focusTitle");
  const focusContent = $("#focusContent");
  const focusWordCount = $("#focusWordCount");

  // Toast
  const toast = $("#toast");
  const toastMessage = $("#toastMessage");

  // Counts
  const countAll = $("#countAll");
  const countPinned = $("#countPinned");
  const countFavourites = $("#countFavourites");
  const countArchive = $("#countArchive");

  // ---------- Helpers ----------
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function now() {
    return new Date().toISOString();
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const today = new Date();
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
  }

  function countWords(text) {
    const t = (text || "").trim();
    if (!t) return 0;
    return t.split(/\s+/).filter(Boolean).length;
  }

  function truncate(str, len = 140) {
    if (!str) return "";
    const clean = str.replace(/\s+/g, " ").trim();
    return clean.length > len ? clean.slice(0, len) + "…" : clean;
  }

  function showToast(msg, duration = 2200) {
    toastMessage.textContent = msg;
    toast.hidden = false;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.hidden = true;
    }, duration);
  }

  // ---------- Storage ----------
  function loadNotes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      notes = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(notes)) notes = [];
    } catch {
      notes = [];
    }
  }

  function saveNotes() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  // ---------- Theme ----------
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const isDark = theme === "dark";
    themeIcon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
    themeLabel.textContent = isDark ? "Light mode" : "Dark mode";
    localStorage.setItem(THEME_KEY, theme);
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") {
      applyTheme(saved);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      applyTheme("dark");
    } else {
      applyTheme("light");
    }
  }

  // ---------- Filtering & Sorting ----------
  function getFilteredNotes() {
    let list = [...notes];

    // Filter by view
    if (currentFilter === "pinned") {
      list = list.filter((n) => n.pinned && !n.archived);
    } else if (currentFilter === "favourites") {
      list = list.filter((n) => n.favourite && !n.archived);
    } else if (currentFilter === "archive") {
      list = list.filter((n) => n.archived);
    } else if (currentFilter.startsWith("tag:")) {
      const tag = currentFilter.slice(4).toLowerCase();
      list = list.filter((n) => !n.archived && (n.tag || "").toLowerCase() === tag);
    } else {
      // all
      list = list.filter((n) => !n.archived);
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (n) =>
          (n.title || "").toLowerCase().includes(q) ||
          (n.content || "").toLowerCase().includes(q) ||
          (n.tag || "").toLowerCase().includes(q)
      );
    }

    // Sort: pinned first (in all/tags), then updated desc
    list.sort((a, b) => {
      if (currentFilter === "all" || currentFilter.startsWith("tag:")) {
        if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
      }
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    return list;
  }

  function getAllTags() {
    const map = {};
    notes.forEach((n) => {
      if (n.archived) return;
      const t = (n.tag || "").trim();
      if (t) {
        const key = t.toLowerCase();
        if (!map[key]) map[key] = { label: t, count: 0 };
        map[key].count++;
      }
    });
    return Object.values(map).sort((a, b) => a.label.localeCompare(b.label));
  }

  // ---------- Render ----------
  function updateCounts() {
    const active = notes.filter((n) => !n.archived);
    countAll.textContent = active.length;
    countPinned.textContent = active.filter((n) => n.pinned).length;
    countFavourites.textContent = active.filter((n) => n.favourite).length;
    countArchive.textContent = notes.filter((n) => n.archived).length;
  }

  function renderTags() {
    const tags = getAllTags();
    tagsList.innerHTML = "";

    if (tags.length === 0) {
      const empty = document.createElement("p");
      empty.className = "tag-empty";
      empty.style.cssText = "padding:0.4rem 0.85rem;font-size:0.85rem;color:var(--text-muted);";
      empty.textContent = "No tags yet";
      tagsList.appendChild(empty);
      return;
    }

    tags.forEach((t) => {
      const btn = document.createElement("button");
      btn.className = "tag-item" + (currentFilter === "tag:" + t.label.toLowerCase() ? " active" : "");
      btn.innerHTML = `
        <span class="tag-dot"></span>
        <span>${escapeHtml(t.label)}</span>
        <span class="tag-count">${t.count}</span>
      `;
      btn.addEventListener("click", () => {
        setFilter("tag:" + t.label.toLowerCase());
        closeSidebar();
      });
      tagsList.appendChild(btn);
    });

    // Update datalist
    tagSuggestions.innerHTML = tags
      .map((t) => `<option value="${escapeAttr(t.label)}">`)
      .join("");
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function escapeAttr(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderNotes() {
    const list = getFilteredNotes();
    notesGrid.innerHTML = "";

    updateCounts();
    renderTags();
    updatePageTitle();

    if (list.length === 0) {
      emptyState.hidden = false;
      notesGrid.hidden = true;
      updateEmptyState();
      return;
    }

    emptyState.hidden = true;
    notesGrid.hidden = false;

    list.forEach((note) => {
      const card = document.createElement("article");
      card.className = `note-card colour-${note.colour || "yellow"}`;
      card.dataset.id = note.id;
      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");

      const badges = [];
      if (note.pinned) badges.push('<span class="badge-icon" title="Pinned"><i class="fa-solid fa-thumbtack"></i></span>');
      if (note.favourite) badges.push('<span class="badge-icon" title="Favourite"><i class="fa-solid fa-star"></i></span>');

      card.innerHTML = `
        <div class="note-card-top">
          <h3 class="note-card-title">${escapeHtml(note.title || "Untitled")}</h3>
          <div class="note-card-badges">${badges.join("")}</div>
        </div>
        <p class="note-card-preview">${escapeHtml(truncate(note.content, 160)) || "No content"}</p>
        <div class="note-card-footer">
          <div class="note-card-meta">
            <span>${formatDate(note.updatedAt)}</span>
            ${note.tag ? `<span class="note-tag-chip">${escapeHtml(note.tag)}</span>` : ""}
          </div>
          <div class="note-card-actions">
            <button class="card-action" data-action="focus" title="Focus Mode" aria-label="Focus Mode">
              <i class="fa-solid fa-expand"></i>
            </button>
            <button class="card-action ${note.pinned ? "active" : ""}" data-action="pin" title="Pin" aria-label="Pin">
              <i class="fa-solid fa-thumbtack"></i>
            </button>
            <button class="card-action ${note.favourite ? "active" : ""}" data-action="fav" title="Favourite" aria-label="Favourite">
              <i class="fa-solid fa-star"></i>
            </button>
            <button class="card-action" data-action="archive" title="${note.archived ? "Unarchive" : "Archive"}" aria-label="Archive">
              <i class="fa-solid fa-${note.archived ? "box-open" : "box-archive"}"></i>
            </button>
            <button class="card-action danger" data-action="delete" title="Delete" aria-label="Delete">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      `;

      // Card click → edit
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-action]")) return;
        openEditor(note.id);
      });

      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openEditor(note.id);
        }
      });

      // Action buttons
      card.querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          handleCardAction(action, note.id);
        });
      });

      notesGrid.appendChild(card);
    });
  }

  function updatePageTitle() {
    const titles = {
      all: "All Notes",
      pinned: "Pinned",
      favourites: "Favourites",
      archive: "Archive",
    };
    if (currentFilter.startsWith("tag:")) {
      const tag = currentFilter.slice(4);
      pageTitle.textContent = `#${tag}`;
    } else {
      pageTitle.textContent = titles[currentFilter] || "Notes";
    }
  }

  function updateEmptyState() {
    if (searchQuery) {
      emptyTitle.textContent = "No matches";
      emptyText.textContent = "Try a different search term.";
      emptyAddBtn.hidden = true;
    } else if (currentFilter === "pinned") {
      emptyTitle.textContent = "No pinned notes";
      emptyText.textContent = "Pin important notes to keep them at the top.";
      emptyAddBtn.hidden = true;
    } else if (currentFilter === "favourites") {
      emptyTitle.textContent = "No favourites yet";
      emptyText.textContent = "Star notes you love to find them quickly.";
      emptyAddBtn.hidden = true;
    } else if (currentFilter === "archive") {
      emptyTitle.textContent = "Archive is empty";
      emptyText.textContent = "Archived notes will appear here.";
      emptyAddBtn.hidden = true;
    } else if (currentFilter.startsWith("tag:")) {
      emptyTitle.textContent = "No notes with this tag";
      emptyText.textContent = "Create a note and add this tag.";
      emptyAddBtn.hidden = false;
    } else {
      emptyTitle.textContent = "No notes yet";
      emptyText.textContent = "Tap the + button to create your first note.";
      emptyAddBtn.hidden = false;
    }
  }

  // ---------- Filter nav ----------
  function setFilter(filter) {
    currentFilter = filter;

    // Sidebar nav
    $$(".nav-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.filter === filter);
    });

    // Bottom nav
    $$(".bottom-nav-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.filter === filter);
    });

    // Tags active state handled in renderTags
    renderNotes();
  }

  // ---------- CRUD ----------
  function openEditor(id = null) {
    editingId = id;
    selectedColour = "yellow";

    if (id) {
      const note = notes.find((n) => n.id === id);
      if (!note) return;
      editorTitle.textContent = "Edit Note";
      noteTitle.value = note.title || "";
      noteContent.value = note.content || "";
      noteTag.value = note.tag || "";
      notePinned.checked = !!note.pinned;
      noteFavourite.checked = !!note.favourite;
      selectedColour = note.colour || "yellow";
    } else {
      editorTitle.textContent = "New Note";
      noteTitle.value = "";
      noteContent.value = "";
      noteTag.value = "";
      notePinned.checked = false;
      noteFavourite.checked = false;
      selectedColour = "yellow";
    }

    updateColourPicker();
    updateEditorStats();
    editorModal.hidden = false;
    noteTitle.focus();
  }

  function closeEditor() {
    editorModal.hidden = true;
    editingId = null;
  }

  function updateColourPicker() {
    $$(".colour-swatch", colourPicker).forEach((sw) => {
      sw.classList.toggle("active", sw.dataset.colour === selectedColour);
    });
  }

  function updateEditorStats() {
    const text = noteContent.value || "";
    const chars = text.length;
    const words = countWords(text);
    charCount.textContent = `${chars} character${chars !== 1 ? "s" : ""}`;
    wordCount.textContent = `${words} word${words !== 1 ? "s" : ""}`;
  }

  function saveNote() {
    const title = noteTitle.value.trim();
    const content = noteContent.value.trim();
    const tag = noteTag.value.trim();

    if (!title && !content) {
      showToast("Write something first");
      noteTitle.focus();
      return;
    }

    if (editingId) {
      const idx = notes.findIndex((n) => n.id === editingId);
      if (idx === -1) return;
      notes[idx] = {
        ...notes[idx],
        title: title || "Untitled",
        content,
        tag,
        colour: selectedColour,
        pinned: notePinned.checked,
        favourite: noteFavourite.checked,
        updatedAt: now(),
      };
      showToast("Note updated");
    } else {
      const note = {
        id: uid(),
        title: title || "Untitled",
        content,
        tag,
        colour: selectedColour,
        pinned: notePinned.checked,
        favourite: noteFavourite.checked,
        archived: false,
        createdAt: now(),
        updatedAt: now(),
      };
      notes.unshift(note);
      showToast("Note created");
    }

    saveNotes();
    closeEditor();
    renderNotes();
  }

  function handleCardAction(action, id) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;

    if (action === "pin") {
      note.pinned = !note.pinned;
      note.updatedAt = now();
      saveNotes();
      renderNotes();
      showToast(note.pinned ? "Pinned" : "Unpinned");
    } else if (action === "fav") {
      note.favourite = !note.favourite;
      note.updatedAt = now();
      saveNotes();
      renderNotes();
      showToast(note.favourite ? "Added to favourites" : "Removed from favourites");
    } else if (action === "archive") {
      note.archived = !note.archived;
      note.updatedAt = now();
      saveNotes();
      renderNotes();
      showToast(note.archived ? "Archived" : "Restored");
    } else if (action === "delete") {
      deleteTargetId = id;
      deleteModal.hidden = false;
    } else if (action === "focus") {
      openFocusMode(id);
    }
  }

  function confirmDelete() {
    if (!deleteTargetId) return;
    notes = notes.filter((n) => n.id !== deleteTargetId);
    saveNotes();
    deleteModal.hidden = true;
    deleteTargetId = null;
    renderNotes();
    showToast("Note deleted");
  }

  // ---------- Focus Mode ----------
  function openFocusMode(id) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    focusNoteId = id;
    focusTitle.value = note.title || "";
    focusContent.value = note.content || "";
    updateFocusStats();
    focusMode.hidden = false;
    focusContent.focus();
  }

  function closeFocusMode() {
    focusMode.hidden = true;
    focusNoteId = null;
  }

  function saveFocusMode() {
    if (!focusNoteId) return;
    const note = notes.find((n) => n.id === focusNoteId);
    if (!note) return;
    note.title = focusTitle.value.trim() || "Untitled";
    note.content = focusContent.value.trim();
    note.updatedAt = now();
    saveNotes();
    closeFocusMode();
    renderNotes();
    showToast("Saved");
  }

  function updateFocusStats() {
    const words = countWords(focusContent.value);
    focusWordCount.textContent = `${words} word${words !== 1 ? "s" : ""}`;
  }

  // ---------- Sidebar (mobile) ----------
  function openSidebar() {
    sidebar.classList.add("open");
    let backdrop = document.querySelector(".sidebar-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "sidebar-backdrop";
      backdrop.addEventListener("click", closeSidebar);
      document.body.appendChild(backdrop);
    }
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    const backdrop = document.querySelector(".sidebar-backdrop");
    if (backdrop) backdrop.remove();
  }

  // ---------- Events ----------
  function bindEvents() {
    // Add note
    addNoteBtn.addEventListener("click", () => openEditor());
    emptyAddBtn.addEventListener("click", () => openEditor());

    // Search
    searchInput.addEventListener("input", () => {
      searchQuery = searchInput.value.trim();
      searchClear.hidden = !searchQuery;
      renderNotes();
    });
    searchClear.addEventListener("click", () => {
      searchInput.value = "";
      searchQuery = "";
      searchClear.hidden = true;
      renderNotes();
      searchInput.focus();
    });

    // Nav filters
    $$(".nav-item[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setFilter(btn.dataset.filter);
        closeSidebar();
      });
    });
    $$(".bottom-nav-item[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => setFilter(btn.dataset.filter));
    });

    // Theme
    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      applyTheme(current === "dark" ? "light" : "dark");
    });

    // Sidebar mobile
    menuBtn.addEventListener("click", openSidebar);
    sidebarClose.addEventListener("click", closeSidebar);

    // Editor
    editorSave.addEventListener("click", saveNote);
    editorCancel.addEventListener("click", closeEditor);
    editorClose.addEventListener("click", closeEditor);
    noteContent.addEventListener("input", updateEditorStats);
    noteTitle.addEventListener("input", updateEditorStats);

    colourPicker.addEventListener("click", (e) => {
      const sw = e.target.closest(".colour-swatch");
      if (!sw) return;
      selectedColour = sw.dataset.colour;
      updateColourPicker();
    });

    // Keyboard: Ctrl/Cmd+S to save in editor
    editorModal.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveNote();
      }
      if (e.key === "Escape") closeEditor();
    });

    // Delete modal
    deleteConfirm.addEventListener("click", confirmDelete);
    deleteCancel.addEventListener("click", () => {
      deleteModal.hidden = true;
      deleteTargetId = null;
    });
    deleteModal.addEventListener("click", (e) => {
      if (e.target === deleteModal) {
        deleteModal.hidden = true;
        deleteTargetId = null;
      }
    });

    // Focus mode
    focusBack.addEventListener("click", () => {
      // Auto-save on exit if changed? Keep simple: just exit, use Save button
      closeFocusMode();
    });
    focusSave.addEventListener("click", saveFocusMode);
    focusContent.addEventListener("input", updateFocusStats);
    focusTitle.addEventListener("input", updateFocusStats);
    focusMode.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveFocusMode();
      }
      if (e.key === "Escape") closeFocusMode();
    });

    // Close editor overlay click
    editorModal.addEventListener("click", (e) => {
      if (e.target === editorModal) closeEditor();
    });
  }

  // ---------- Init ----------
  function init() {
    loadNotes();
    initTheme();
    bindEvents();
    renderNotes();
  }

  init();
})();
