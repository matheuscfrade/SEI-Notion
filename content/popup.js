/**
 * Popup do Notion — um único modal para ver e editar a página do processo.
 */
(function (root) {
  const HOST_ID = "sei-notion-modal-host";
  let draggingActivityId = "";

  const CSS = `
    :host { all: initial; display: block; height: 100%; }
    :host > div {
      height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    *, *::before, *::after { box-sizing: border-box; }
    .sn-root {
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      color: #0f172a;
      line-height: 1.4;
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 48px 16px 24px;
      overflow: hidden;
    }
    .sn-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
    }
    .sn-modal {
      position: relative;
      width: min(860px, 98vw);
      max-width: 100%;
      max-height: calc(100vh - 72px);
      overflow-x: hidden;
      overflow-y: auto;
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 24px 64px rgba(15, 23, 42, 0.28);
      border: 1px solid #e2e8f0;
    }
    .sn-head {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      background: linear-gradient(135deg, #1e3a8a, #111827);
      color: #fff;
      min-width: 0;
    }
    .sn-logo {
      width: 28px; height: 28px; border-radius: 8px;
      background: rgba(255,255,255,0.16);
      display: grid; place-items: center;
      font-weight: 800; font-size: 12px;
      flex-shrink: 0;
    }
    .sn-head-text { flex: 1; min-width: 0; overflow: hidden; }
    .sn-head h2 { margin: 0; font-size: 14px; font-weight: 800; }
    .sn-nup {
      margin: 2px 0 0; font-size: 11px; opacity: 0.85;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere; word-break: break-all;
    }
    .sn-x {
      border: 0; background: transparent; color: #fff;
      font-size: 20px; line-height: 1; cursor: pointer; padding: 4px 8px;
    }
    .sn-body { padding: 14px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
    .sn-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; max-width: 100%; }
    .sn-field span {
      font-size: 11px; font-weight: 800; letter-spacing: 0.03em;
      text-transform: uppercase; color: #64748b;
    }
    .sn-field input, .sn-field textarea, .sn-field select, .sn-input {
      font: inherit; font-size: 13px; color: #0f172a;
      border: 1px solid #cbd5e1; border-radius: 6px;
      padding: 8px 10px; width: 100%; max-width: 100%;
      min-width: 0; background: #fff; box-sizing: border-box;
      outline: none;
    }
    .sn-field input:focus, .sn-field textarea:focus, .sn-field select:focus, .sn-input:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 1px #3b82f6;
    }
    .sn-field textarea { min-height: 72px; resize: vertical; }
    .sn-field.is-sei input, .sn-field.is-sei textarea, .sn-field.is-sei select {
      background: #f8fafc; color: #334155; cursor: default;
    }
    .sn-sei-tag {
      display: inline-block; margin-left: 6px;
      font-size: 9px; font-weight: 800; letter-spacing: 0.04em;
      text-transform: uppercase; color: #1e3a8a;
      background: #eef2ff; border-radius: 999px; padding: 1px 6px;
    }
    .sn-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .sn-chip {
      border: 1px solid #cbd5e1; background: #f8fafc; color: #334155;
      border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 700;
      cursor: pointer;
    }
    .sn-chip.on { background: #1e3a8a; border-color: #1e3a8a; color: #fff; }
    .sn-chip-locked { cursor: default; }
    .sn-msg { font-size: 12px; color: #64748b; margin: 0; }
    .sn-err { color: #b91c1c; font-size: 12px; margin: 0; }
    .sn-lock {
      background: #fff7ed;
      border: 1px solid #fdba74;
      color: #9a3412;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 12px;
      font-weight: 600;
    }
    .sn-mine {
      background: #ecfdf5;
      border: 1px solid #6ee7b7;
      color: #047857;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 12px;
      font-weight: 600;
    }
    .sn-overlay {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      bottom: 0;
      z-index: 30;
      background: rgba(15, 23, 42, 0.38);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
    }
    .sn-overlay[hidden] { display: none !important; }
    .sn-overlay-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 22px 28px;
      min-width: 200px;
      max-width: 86%;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.22);
      color: #1e3a8a;
      font-size: 14px;
      font-weight: 800;
      text-align: center;
      line-height: 1.35;
    }
    .sn-spinner {
      width: 36px;
      height: 36px;
      border: 4px solid #bfdbfe;
      border-top-color: #1d4ed8;
      border-radius: 50%;
      animation: sn-spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes sn-spin { to { transform: rotate(360deg); } }
    .sn-foot {
      display: flex; flex-wrap: wrap; gap: 8px;
      padding: 0 14px 14px;
      min-width: 0;
    }
    .sn-btn {
      border: 0; border-radius: 8px; padding: 8px 12px;
      font: inherit; font-size: 13px; font-weight: 700; cursor: pointer;
    }
    .sn-btn[disabled] { opacity: 0.55; cursor: default; }
    .sn-btn-primary { background: #1e3a8a; color: #fff; }
    .sn-btn-ghost { background: #f1f5f9; color: #0f172a; border: 1px solid #e2e8f0; }
    .sn-btn-link {
      background: transparent; color: #1e3a8a; margin-left: auto;
      text-decoration: none; display: inline-flex; align-items: center;
    }
    .sn-kanban-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 6px;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
    }
    .sn-kanban-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }
    .sn-kanban-title {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: #1e3a8a;
    }
    .sn-date-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      width: 100%;
      box-sizing: border-box;
    }
    .sn-date-wrap .sn-date-input {
      width: 100%;
      box-sizing: border-box;
      font-variant-numeric: tabular-nums;
      cursor: pointer;
      background: #fff;
      outline: none;
    }
    .sn-field .sn-date-wrap .sn-date-input,
    .sn-date-wrap .sn-input {
      font: inherit;
      font-size: 13px;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 7px 32px 7px 10px !important;
      height: 36px;
    }
    .sn-kanban-new-box .sn-date-wrap .sn-date-input,
    .sn-kanban-edit-box .sn-date-wrap .sn-date-input,
    .sn-kanban-date-wrap .sn-date-input,
    .sn-date-wrap .sn-kanban-input {
      font: inherit;
      font-size: 12px;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 32px 6px 8px !important;
      height: 31px;
    }
    .sn-date-wrap .sn-date-input:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 1px #3b82f6;
    }
    .sn-date-btn {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      border: 0;
      cursor: pointer;
      font-size: 14px;
      padding: 2px 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.75;
      line-height: 1;
      transition: opacity 0.15s, background-color 0.15s;
    }
    .sn-date-btn:hover {
      opacity: 1;
      background-color: #e2e8f0;
    }
    .sn-date-btn[disabled] {
      opacity: 0.35;
      cursor: default;
    }
    .sn-calendar-popover {
      position: absolute;
      z-index: 999999;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.18), 0 8px 10px -6px rgba(0, 0, 0, 0.12);
      padding: 12px;
      width: 250px;
      font-family: inherit;
      color: #0f172a;
      top: calc(100% + 4px);
      left: 0;
      user-select: none;
    }
    .sn-calendar-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .sn-calendar-title {
      font-size: 12px;
      font-weight: 800;
      color: #1e3a8a;
    }
    .sn-calendar-nav-btn {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      cursor: pointer;
      padding: 2px 6px;
      font-size: 10px;
      font-weight: 800;
      color: #334155;
    }
    .sn-calendar-nav-btn:hover {
      background: #e2e8f0;
    }
    .sn-calendar-weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      text-align: center;
      font-size: 10px;
      font-weight: 800;
      color: #64748b;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    .sn-calendar-days {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
    }
    .sn-calendar-day {
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      border: 0;
      background: transparent;
      color: #1e293b;
      padding: 0;
    }
    .sn-calendar-day:hover:not(:disabled) {
      background: #eff6ff;
      color: #1e3a8a;
    }
    .sn-calendar-day.is-today {
      border: 1px solid #3b82f6;
      font-weight: 800;
    }
    .sn-calendar-day.is-selected {
      background: #1e3a8a !important;
      color: #ffffff !important;
      font-weight: 800;
    }
    .sn-calendar-day.is-other-month {
      color: #cbd5e1;
    }
    .sn-calendar-foot {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid #f1f5f9;
    }
    .sn-calendar-quick-btn {
      background: transparent;
      border: 0;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      color: #1e3a8a;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .sn-calendar-quick-btn:hover {
      background: #f1f5f9;
    }
    .sn-tpl-picker-wrap {
      position: relative;
      display: inline-block;
    }
    .sn-tpl-btn {
      transition: background-color 0.15s, border-color 0.15s;
    }
    .sn-tpl-btn:hover:not(:disabled) {
      background: #dbeafe !important;
      border-color: #60a5fa !important;
    }
    .sn-tpl-popover {
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      z-index: 999999;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.18), 0 8px 10px -6px rgba(0, 0, 0, 0.12);
      width: 280px;
      max-width: 90vw;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      box-sizing: border-box;
      user-select: none;
    }
    .sn-tpl-search-wrap {
      position: relative;
      width: 100%;
    }
    .sn-tpl-search-wrap input {
      width: 100%;
      font-size: 11px;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      box-sizing: border-box;
      outline: none;
    }
    .sn-tpl-search-wrap input:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 1px #3b82f6;
    }
    .sn-tpl-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 200px;
      overflow-y: auto;
      margin: 0;
      padding: 0;
    }
    .sn-tpl-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      color: #1e293b;
      cursor: pointer;
      border: 0;
      background: transparent;
      text-align: left;
      width: 100%;
      box-sizing: border-box;
      line-height: 1.3;
      transition: background-color 0.12s, color 0.12s;
    }
    .sn-tpl-item:hover, .sn-tpl-item:focus {
      background: #eff6ff;
      color: #1e3a8a;
      outline: none;
    }
    .sn-tpl-item-icon {
      font-size: 12px;
      flex-shrink: 0;
    }
    .sn-tpl-item-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sn-tpl-empty {
      padding: 10px 8px;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
      font-style: italic;
    }
    .sn-kanban-new-box {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 6px 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin-top: 2px;
      align-items: center;
    }
    .sn-kanban-new-box #sn-new-act-title {
      flex: 1 1 160px;
      min-width: 140px;
    }
    .sn-kanban-new-box #sn-new-act-assignee {
      flex: 0 1 130px;
      min-width: 110px;
    }
    .sn-kanban-new-box .sn-date-wrap,
    .sn-kanban-new-box .sn-kanban-date-wrap {
      flex: 0 0 118px;
      width: 118px;
    }
    .sn-kanban-new-box #sn-new-act-status {
      flex: 0 1 120px;
      min-width: 100px;
    }
    .sn-kanban-new-box #sn-new-act-btn {
      flex: 0 0 auto;
      padding: 5px 10px;
      font-size: 12px;
      white-space: nowrap;
    }
    .sn-kanban-input {
      font: inherit;
      font-size: 12px;
      color: #0f172a;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #fff;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      height: 31px;
      outline: none;
    }
    .sn-kanban-input:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 1px #3b82f6;
    }
    .sn-kanban-board {
      display: flex;
      flex-direction: row;
      align-items: stretch;
      gap: 12px;
      margin-top: 8px;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      overflow-x: auto;
      overflow-y: hidden;
      padding-bottom: 10px;
    }
    .sn-kanban-board::-webkit-scrollbar {
      height: 8px;
    }
    .sn-kanban-board::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-radius: 4px;
    }
    .sn-kanban-board::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }
    .sn-kanban-board::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }
    .sn-kanban-col {
      flex: 1 1 250px;
      min-width: 250px;
      width: auto;
      max-width: none;
      display: flex;
      flex-direction: column;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      max-height: none;
      height: auto;
    }
    .sn-kanban-col-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
      background: #f1f5f9;
      border-radius: 8px 8px 0 0;
      font-size: 12px;
      font-weight: 700;
      color: #334155;
      gap: 4px;
    }
    .sn-kanban-col-nav {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      margin-left: auto;
      margin-right: 4px;
    }
    .sn-kanban-col-btn {
      border: 0;
      background: #e2e8f0;
      color: #475569;
      cursor: pointer;
      font-size: 10px;
      padding: 1px 4px;
      border-radius: 4px;
      line-height: 1.2;
    }
    .sn-kanban-col-btn:hover {
      background: #cbd5e1;
      color: #0f172a;
    }
    .sn-kanban-badge {
      font-size: 11px;
      background: #e2e8f0;
      color: #475569;
      border-radius: 999px;
      padding: 1px 6px;
      font-weight: 700;
    }
    .sn-kanban-cards {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px;
      overflow-y: auto;
      min-height: 90px;
      flex: 1;
      transition: background 0.15s;
    }
    .sn-kanban-cards.is-dragover {
      background: #f0f9ff;
      box-shadow: inset 0 0 0 2px #7dd3fc;
      border-radius: 6px;
    }
    .sn-kanban-placeholder {
      height: 4px;
      margin: 1px 0;
      background: #0284c7;
      border-radius: 999px;
      pointer-events: none;
      flex-shrink: 0;
    }
    .sn-kanban-cards:has(.sn-kanban-placeholder) .sn-kanban-empty {
      display: none;
    }
    .sn-kanban-empty {
      padding: 12px 6px;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      font-style: italic;
    }
    .sn-kanban-card {
      background: #fff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
      cursor: grab;
      display: flex;
      flex-direction: column;
      gap: 6px;
      user-select: none;
      transition: box-shadow 0.15s, opacity 0.15s;
    }
    .sn-kanban-card.is-editing {
      cursor: default;
      border-color: #3b82f6;
      box-shadow: 0 0 0 1px #3b82f6;
    }
    .sn-kanban-card:hover {
      box-shadow: 0 3px 6px rgba(15, 23, 42, 0.1);
      border-color: #94a3b8;
    }
    .sn-kanban-card.is-dragging {
      opacity: 0.4;
      cursor: grabbing;
    }
    .sn-kanban-card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 6px;
    }
    .sn-kanban-card-title {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.3;
      flex: 1;
    }
    .sn-kanban-card-actions {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .sn-kanban-card-btn {
      border: 0;
      background: transparent;
      color: #94a3b8;
      cursor: pointer;
      font-size: 12px;
      padding: 1px 4px;
      line-height: 1;
      border-radius: 4px;
    }
    .sn-kanban-card-btn:hover {
      background: #f1f5f9;
      color: #1e3a8a;
    }
    .sn-kanban-card-del:hover {
      background: #fee2e2;
      color: #b91c1c;
    }
    .sn-kanban-edit-box {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 2px 0;
    }
    .sn-kanban-card-meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
      font-size: 11px;
      color: #64748b;
    }
    .sn-kanban-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: #f1f5f9;
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 10px;
      font-weight: 600;
      color: #475569;
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sn-kanban-todo-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #f1f5f9;
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 10px;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
    }
    .sn-kanban-todo-badge:hover {
      background: #e2e8f0;
      color: #0f172a;
    }
    .sn-kanban-todo-badge.is-done {
      background: #dcfce7;
      color: #15803d;
    }
    .sn-card-checklist {
      border-top: 1px solid #f1f5f9;
      padding-top: 6px;
      margin-top: 2px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .sn-card-todo-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
    }
    .sn-card-todo-item input[type="checkbox"] {
      width: 13px;
      height: 13px;
      margin: 0;
      cursor: pointer;
    }
    .sn-card-todo-item span {
      flex: 1;
      color: #334155;
    }
    .sn-card-todo-item.on span {
      text-decoration: line-through;
      color: #94a3b8;
    }
    .sn-card-todo-add {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
    }
    .sn-card-todo-add input {
      flex: 1;
      font-size: 11px;
      padding: 4px 6px;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }
    .sn-card-todo-add button {
      font-size: 11px;
      padding: 4px 8px;
      border: 0;
      background: #1e3a8a;
      color: #fff;
      border-radius: 4px;
      cursor: pointer;
    }
    .sn-nup-always {
      display: grid; grid-template-columns: auto 1fr; align-items: center;
      gap: 8px; padding: 6px 10px;
      border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;
    }
    .sn-nup-always span { font-size: 10px; }
    .sn-nup-always input {
      border: 0; background: transparent; padding: 0;
      font-size: 12px; font-variant-numeric: tabular-nums;
      text-align: right; color: #0f172a;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sn-nup-always.is-sei input { background: transparent; cursor: default; }
    .sn-fold { display: flex; flex-direction: column; min-width: 0; }
    .sn-fold-toggle {
      display: flex; align-items: center; justify-content: space-between;
      gap: 10px; margin: 0; padding: 7px 10px;
      border: 1px solid #e2e8f0; border-radius: 8px;
      background: #f8fafc; cursor: pointer; user-select: none;
    }
    .sn-fold-head-fixed {
      display: flex; align-items: center; justify-content: space-between;
      gap: 10px; margin: 0; padding: 7px 10px;
      border: 1px solid #e2e8f0; border-radius: 8px 8px 0 0;
      background: #f8fafc; user-select: none;
    }
    .sn-sei-fixed .sn-sei-panel {
      border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;
      padding: 10px; background: #fff;
    }
    .sn-fold.is-open .sn-fold-toggle {
      border-radius: 8px 8px 0 0;
    }
    .sn-fold-label {
      font-size: 11px; font-weight: 800; letter-spacing: 0.03em;
      text-transform: uppercase; color: #334155;
    }
    .sn-switch { position: relative; width: 32px; height: 18px; flex-shrink: 0; }
    .sn-switch input {
      appearance: none; -webkit-appearance: none;
      position: absolute; inset: 0; margin: 0; opacity: 0;
      cursor: pointer; z-index: 1;
    }
    .sn-switch i {
      display: block; width: 100%; height: 100%;
      background: #cbd5e1; border-radius: 999px; pointer-events: none;
      transition: background 0.15s ease;
    }
    .sn-switch i::after {
      content: ""; position: absolute; top: 2px; left: 2px;
      width: 14px; height: 14px; background: #fff; border-radius: 50%;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.25);
      transition: transform 0.15s ease;
    }
    .sn-switch input:checked + i { background: #1e3a8a; }
    .sn-switch input:checked + i::after { transform: translateX(14px); }
    .sn-switch input:focus-visible + i {
      outline: 2px solid #1e3a8a; outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
      .sn-switch i, .sn-switch i::after { transition: none; }
    }
    .sn-sei-panel {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 6px 10px; padding: 8px 10px 10px;
      border: 1px solid #e2e8f0; border-top: 0;
      border-radius: 0 0 8px 8px; background: #f8fafc; min-width: 0;
    }
    .sn-sei-panel[hidden], .sn-other-panel[hidden] { display: none; }
    .sn-other-panel {
      display: flex; flex-direction: column; gap: 6px;
      padding: 8px 10px 10px; border: 1px solid #e2e8f0; border-top: 0;
      border-radius: 0 0 8px 8px; background: #fff; min-width: 0;
    }
    .sn-other-hint { font-size: 10px; line-height: 1.4; color: #64748b; margin: 0; }
    .sn-sei-panel .sn-field { gap: 1px; }
    .sn-sei-panel .sn-field.sn-span2 { grid-column: 1 / -1; }
    .sn-sei-panel .sn-field span { font-size: 10px; }
    .sn-sei-panel .sn-field input,
    .sn-sei-panel .sn-field textarea,
    .sn-sei-panel .sn-field select {
      border: 0; background: transparent; padding: 1px 0;
      font-size: 12px; border-radius: 0; color: #0f172a;
    }
    .sn-sei-panel .sn-field.is-sei input,
    .sn-sei-panel .sn-field.is-sei textarea,
    .sn-sei-panel .sn-field.is-sei select { background: transparent; }
    .sn-sei-panel .sn-field textarea {
      min-height: 36px; max-height: 72px; resize: none; line-height: 1.35;
    }
    .sn-sei-panel .sn-field input {
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sn-sei-panel .sn-chips { gap: 4px; }
    .sn-sei-panel .sn-chip { padding: 1px 7px; font-size: 11px; }
    .sn-sei-panel .sn-msg { font-size: 11px; }
    .sn-sei-hint {
      grid-column: 1 / -1;
      margin: 2px 0 0;
      padding: 6px 0 0;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      line-height: 1.4;
      color: #64748b;
      font-weight: 500;
    }
    .sn-sei-hint .sn-sei-tag {
      margin: 0 2px;
      vertical-align: 1px;
    }
    .sn-sei-link {
      font-size: 12px; font-weight: 700; color: #1e3a8a;
      text-decoration: none; width: fit-content;
    }
    .sn-sei-link:hover { text-decoration: underline; }
    .sn-sei-panel .sn-sei-link { padding: 1px 0; }

    .sn-root.is-panel {
      position: relative;
      inset: auto;
      height: 100%;
      width: 100%;
      padding: 0;
      display: flex;
      align-items: stretch;
      justify-content: stretch;
      overflow: hidden;
    }
    .sn-root.is-panel .sn-backdrop { display: none; }
    .sn-root.is-panel .sn-modal {
      width: 100%;
      max-width: none;
      max-height: none;
      height: 100%;
      min-height: 0;
      border-radius: 12px 12px 0 0;
      box-shadow: 0 -8px 28px rgba(15, 23, 42, 0.18);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .sn-root.is-panel .sn-head { flex-shrink: 0; padding: 6px 10px; }
    .sn-root.is-panel .sn-head h2 { font-size: 13px; }
    .sn-root.is-panel .sn-nup { font-size: 10px; }
    .sn-info-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      min-width: 0;
      flex-shrink: 0;
    }
    .sn-info-row > .sn-fold { min-width: 0; }
    .sn-root.is-panel .sn-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-x: hidden;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
      padding: 8px 10px;
      scrollbar-gutter: stable;
    }
    .sn-root.is-panel .sn-body::-webkit-scrollbar { width: 10px; }
    .sn-root.is-panel .sn-body::-webkit-scrollbar-thumb {
      background: #94a3b8;
      border-radius: 6px;
    }
    .sn-root.is-panel .sn-body::-webkit-scrollbar-track { background: #e2e8f0; }
    .sn-root.is-panel .sn-body > .sn-err,
    .sn-root.is-panel .sn-body > .sn-lock,
    .sn-root.is-panel .sn-body > .sn-mine,
    .sn-root.is-panel .sn-body > .sn-msg {
      flex-shrink: 0;
    }
    .sn-side {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .sn-root.is-panel .sn-info-row {
      max-height: none;
      overflow: visible;
      flex-shrink: 0;
    }
    .sn-root.is-panel .sn-side-kanban {
      min-height: 0;
      overflow: visible;
      display: flex;
      flex-direction: column;
      flex: 0 0 auto;
    }
    .sn-root.is-panel .sn-side-kanban > .sn-kanban-section {
      flex: 0 0 auto;
      min-height: 0;
      margin-top: 0;
      padding-top: 0;
      border-top: 0;
      overflow: visible;
      display: flex;
      flex-direction: column;
    }
    .sn-root.is-panel .sn-kanban-board {
      flex: 0 0 auto;
      min-height: 0;
      width: 100%;
      margin-top: 6px;
      overflow-x: auto;
      overflow-y: visible;
      padding-bottom: 4px;
    }
    .sn-root.is-panel .sn-kanban-col {
      flex: 1 1 250px;
      min-width: 250px;
      max-width: none;
      max-height: none;
      height: auto;
    }
    .sn-root.is-panel .sn-kanban-cards {
      overflow: visible;
      max-height: none;
    }
    .sn-root.is-panel .sn-field input,
    .sn-root.is-panel .sn-field textarea,
    .sn-root.is-panel .sn-field select,
    .sn-root.is-panel .sn-input {
      padding: 5px 8px;
      font-size: 12px;
    }
    .sn-root.is-panel .sn-field textarea { min-height: 44px; }
    .sn-root.is-panel .sn-field span { font-size: 10px; }
    .sn-root.is-panel .sn-other-hint { display: none; }
    .sn-root.is-panel .sn-fold-head-fixed,
    .sn-root.is-panel .sn-fold-toggle { padding: 5px 8px; }
    .sn-root.is-panel .sn-sei-panel { padding: 8px; }
    .sn-root.is-panel .sn-kanban-new-box { margin-bottom: 4px; }
    .sn-root.is-panel .sn-foot { flex-shrink: 0; padding: 6px 10px 8px; }
    .sn-root.is-panel.is-collapsed .sn-body,
    .sn-root.is-panel.is-collapsed .sn-foot,
    .sn-root.is-panel.is-collapsed .sn-resize { display: none; }
    .sn-root.is-panel.is-collapsed .sn-modal {
      border-radius: 10px 10px 0 0;
    }
    .sn-root.is-panel.is-collapsed .sn-head { cursor: pointer; }
    .sn-popout {
      border: 0;
      background: rgba(255,255,255,0.14);
      color: #fff;
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .sn-popout:hover { background: rgba(255,255,255,0.24); }
    .sn-root.is-page {
      position: relative;
      inset: auto;
      height: 100%;
      width: 100%;
      padding: 0;
    }
    .sn-root.is-page .sn-backdrop { display: none; }
    .sn-root.is-page .sn-modal {
      width: 100%;
      max-width: none;
      max-height: none;
      height: 100%;
      border-radius: 0;
      box-shadow: none;
      border: 0;
    }
    .sn-root.is-page .sn-body {
      overflow-y: auto;
    }
    .sn-resize {
      height: 10px;
      cursor: ns-resize;
      background: #e2e8f0;
      flex-shrink: 0;
      position: relative;
      touch-action: none;
    }
    .sn-resize::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 2px;
      width: 36px;
      height: 3px;
      margin-left: -18px;
      border-radius: 99px;
      background: #94a3b8;
    }
    .sn-resize:hover, .sn-resize.is-drag { background: #dbeafe; }
    .sn-resize:hover::after, .sn-resize.is-drag::after { background: #3b82f6; }
    .sn-toggle {
      border: 0;
      background: rgba(255,255,255,0.14);
      color: #fff;
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .sn-toggle:hover { background: rgba(255,255,255,0.24); }
    .sn-head.is-flash {
      animation: sn-flash 0.9s ease;
    }
    @keyframes sn-flash {
      0%, 100% { filter: none; }
      35% { filter: brightness(1.35); }
    }
    @media (max-width: 900px) {
      .sn-info-row { grid-template-columns: 1fr; }
      .sn-root.is-panel .sn-info-row { max-height: none; }
    }
  `;

  let current = null;
  let showSeiInfo = false;
  let showOtherInfo = false;
  let uiMode = "modal";
  let panelCollapsed = false;
  let panelHeight = 0;
  let panelChrome = null;
  let heightTimer = null;
  let panelResizing = false;
  let lastHostBox = null;
  const ownerId =
    "sn-" +
    Math.random().toString(36).slice(2) +
    "-" +
    String(Date.now()).slice(-4);
  const BAG_KEY = "__SEI_NOTION_PANEL__";

  const COLLAPSED_H = 44;
  const MIN_PANEL_H = 220;
  const MAX_PANEL_H = 720;
  const LEGACY_DEFAULT_H = 360;

  function mountDoc() {
    try {
      if (window.top && window.top.document) {
        return window.top.document;
      }
    } catch (_) {
      /* cross-origin */
    }
    return document;
  }

  function getBag() {
    try {
      const w = window.top || window;
      if (!w[BAG_KEY]) {
        w[BAG_KEY] = { host: null, ownerId: null };
      }
      return w[BAG_KEY];
    } catch (_) {
      return null;
    }
  }

  function weOwn() {
    const bag = getBag();
    return !!(
      bag &&
      current &&
      current.host &&
      bag.ownerId === ownerId &&
      bag.host === current.host
    );
  }

  function claimHost(host) {
    const bag = getBag();
    if (bag) {
      bag.host = host;
      bag.ownerId = ownerId;
    }
  }

  function releaseClaim() {
    const bag = getBag();
    if (bag && bag.ownerId === ownerId) {
      bag.host = null;
      bag.ownerId = null;
    }
  }

  function sweepHosts(doc, keep) {
    if (!doc) return;
    const nodes = doc.querySelectorAll(
      '[id="' + HOST_ID + '"], [data-sei-notion-mode="panel"]'
    );
    nodes.forEach((el) => {
      if (el !== keep) {
        try {
          el.remove();
        } catch (_) {
          /* ignore */
        }
      }
    });
  }

  function canDockInColumn(doc) {
    if (!doc) return null;
    const telaD = doc.getElementById("divInfraAreaTelaD");
    if (!telaD) return null;
    const arvore = findArvoreEl(doc);
    if (arvore && telaD.contains(arvore)) return null;
    return telaD;
  }

  function clampHeight(value, doc) {
    const viewH = (doc && doc.defaultView && doc.defaultView.innerHeight) || 800;
    const max = Math.min(MAX_PANEL_H, Math.max(MIN_PANEL_H, Math.round(viewH * 0.7)));
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0 || n === LEGACY_DEFAULT_H) {
      return Math.min(max, Math.max(MIN_PANEL_H, Math.round(viewH * 0.44)));
    }
    return Math.min(max, Math.max(MIN_PANEL_H, Math.round(n)));
  }

  function persistPanelHeight(h) {
    if (heightTimer) clearTimeout(heightTimer);
    heightTimer = setTimeout(() => {
      try {
        chrome.storage.local.get("seiNotion_settings", (data) => {
          const prev =
            data && data.seiNotion_settings && typeof data.seiNotion_settings === "object"
              ? data.seiNotion_settings
              : {};
          chrome.storage.local.set({
            seiNotion_settings: { ...prev, processPanelHeight: h }
          });
        });
      } catch (_) {
        /* ignore */
      }
    }, 400);
  }

  function qsFirst(doc, selectors) {
    if (!doc) return null;
    for (let i = 0; i < selectors.length; i += 1) {
      try {
        const el = doc.querySelector(selectors[i]);
        if (el) return el;
      } catch (_) {
        /* ignore */
      }
    }
    return null;
  }

  function findArvoreEl(doc) {
    return qsFirst(doc, [
      "iframe#ifrArvore",
      "iframe[name='ifrArvore']",
      "frame#ifrArvore",
      "frame[name='ifrArvore']"
    ]);
  }

  function findVizEl(doc) {
    return qsFirst(doc, [
      "iframe#ifrVisualizacao",
      "iframe[name='ifrVisualizacao']",
      "frame#ifrVisualizacao",
      "frame[name='ifrVisualizacao']",
      "iframe#ifrConteudoVisualizacao",
      "iframe[name='ifrConteudoVisualizacao']"
    ]);
  }

  function vizAnchor(doc) {
    const win = (doc && doc.defaultView) || window;
    const viewW = win.innerWidth || 800;
    const arvore = findArvoreEl(doc);
    const telaE = doc.getElementById("divInfraAreaTelaE");
    const tree = arvore || telaE;
    let left = Math.round(viewW * 0.28);
    let width = viewW - left;

    if (tree) {
      const t = tree.getBoundingClientRect();
      if (t.width > 40) {
        left = Math.max(0, Math.round(t.right));
        width = Math.max(240, viewW - left);
      }
    } else {
      const telaD = doc.getElementById("divInfraAreaTelaD");
      if (telaD) {
        const r = telaD.getBoundingClientRect();
        if (r.width >= 80) {
          left = Math.max(0, Math.round(r.left));
          width = Math.max(240, Math.round(r.width));
        }
      }
    }

    return { left, width, arvore };
  }

  function rememberStyle(el, key) {
    if (!el || !panelChrome || panelChrome.orig[key]) return;
    panelChrome.orig[key] = {
      height: el.style.height,
      maxHeight: el.style.maxHeight,
      bottom: el.style.bottom,
      minHeight: el.style.minHeight
    };
    panelChrome.els = panelChrome.els || {};
    panelChrome.els[key] = el;
  }

  function shrinkVizEl(el, h, key) {
    if (!el) return;
    rememberStyle(el, key);
    let pos = "static";
    try {
      pos = ((el.ownerDocument && el.ownerDocument.defaultView) || window).getComputedStyle(el).position;
    } catch (_) {
      /* ignore */
    }
    if (pos === "absolute" || pos === "fixed") {
      const next = h + "px";
      if (el.style.bottom === next) return;
      el.style.setProperty("bottom", next, "important");
    } else {
      const next = "calc(100% - " + h + "px)";
      if (el.style.height === next && el.style.maxHeight === next) return;
      el.style.setProperty("height", next, "important");
      el.style.setProperty("max-height", next, "important");
    }
  }

  function restoreShrunkEl(el, orig) {
    if (!el) return;
    try {
      el.style.removeProperty("height");
      el.style.removeProperty("max-height");
      el.style.removeProperty("bottom");
      if (orig) {
        el.style.height = orig.height || "";
        el.style.maxHeight = orig.maxHeight || "";
        el.style.bottom = orig.bottom || "";
        el.style.minHeight = orig.minHeight || "";
      }
    } catch (_) {
      /* ignore */
    }
  }

  function applyPanelChrome(doc, height, collapsed) {
    if (!doc) return "fixed";
    const h = collapsed ? COLLAPSED_H : height;
    if (!panelChrome) panelChrome = { doc, orig: {}, els: {} };

    const arvore = findArvoreEl(doc);
    const viz = findVizEl(doc);
    const conteudo = qsFirst(doc, [
      "iframe#ifrConteudoVisualizacao",
      "iframe[name='ifrConteudoVisualizacao']"
    ]);

    if (viz && viz !== arvore) shrinkVizEl(viz, h, "viz");
    if (conteudo && conteudo !== viz && conteudo !== arvore) {
      shrinkVizEl(conteudo, h, "conteudo");
    }
    return "fixed";
  }

  function restorePanelChrome() {
    if (!panelChrome) return;
    const els = panelChrome.els || {};
    const orig = panelChrome.orig || {};
    try {
      if (els.col && orig.col) {
        els.col.style.display = orig.col.display || "";
        els.col.style.flexDirection = orig.col.flexDirection || "";
        els.col.style.minHeight = orig.col.minHeight || "";
        els.col.style.overflow = orig.col.overflow || "";
      }
      if (els.colIframe && orig.colIframe) {
        els.colIframe.style.height = orig.colIframe.height || "";
        els.colIframe.style.flex = orig.colIframe.flex || "";
        els.colIframe.style.minHeight = orig.colIframe.minHeight || "";
      }
    } catch (_) {
      /* ignore */
    }
    Object.keys(els).forEach((key) => {
      if (key === "col" || key === "colIframe") return;
      restoreShrunkEl(els[key], orig[key]);
    });
    panelChrome = null;
  }

  function ensureColumnChrome(col) {
    if (!col || !panelChrome) return;
    if (!panelChrome.orig.col) {
      panelChrome.orig.col = {
        display: col.style.display,
        flexDirection: col.style.flexDirection,
        minHeight: col.style.minHeight,
        overflow: col.style.overflow
      };
      const iframe = col.querySelector("iframe, frame");
      if (iframe) {
        panelChrome.els.colIframe = iframe;
        panelChrome.orig.colIframe = {
          height: iframe.style.height,
          flex: iframe.style.flex,
          minHeight: iframe.style.minHeight
        };
      }
      panelChrome.els.col = col;
    }
    col.style.display = "flex";
    col.style.flexDirection = "column";
    col.style.minHeight = "0";
    col.style.overflow = "hidden";
    const iframe = panelChrome.els.colIframe || col.querySelector("iframe, frame");
    if (iframe) {
      iframe.style.flex = "1 1 auto";
      iframe.style.minHeight = "0";
      iframe.style.height = "auto";
    }
  }

  function layoutHost(host, doc, opts) {
    if (!host) return;
    const d = doc || (current && current.doc);
    const options = opts || {};
    const h = panelCollapsed ? COLLAPSED_H : panelHeight;
    const col = canDockInColumn(d);
    host.setAttribute("data-sei-notion-mode", "panel");
    host.setAttribute("data-sei-notion-owner", ownerId);
    sweepHosts(d, host);

    if (col) {
      if (!panelChrome) panelChrome = { doc: d, orig: {}, els: {} };
      ensureColumnChrome(col);
      const sameBox =
        lastHostBox &&
        lastHostBox.mode === "column" &&
        lastHostBox.height === h;
      if (sameBox && !options.force && host.parentNode === col) {
        return;
      }
      lastHostBox = { mode: "column", height: h, left: 0, width: 0 };
      host.style.position = "relative";
      host.style.left = "auto";
      host.style.right = "auto";
      host.style.top = "auto";
      host.style.bottom = "auto";
      host.style.width = "100%";
      host.style.height = h + "px";
      host.style.flex = "0 0 " + h + "px";
      host.style.zIndex = "20";
      host.style.overflow = "hidden";
      host.style.display = "flex";
      host.style.flexDirection = "column";
      host.style.boxSizing = "border-box";
      host.style.order = "99";
      if (host.parentNode !== col) col.appendChild(host);
      if (current) current.dock = "column";
      return;
    }

    const box = vizAnchor(d);
    const sameBox =
      lastHostBox &&
      lastHostBox.mode === "fixed" &&
      lastHostBox.left === box.left &&
      lastHostBox.width === box.width &&
      lastHostBox.height === h;
    if (sameBox && !options.force) {
      if (!panelResizing) applyPanelChrome(d, panelHeight, panelCollapsed);
      return;
    }
    lastHostBox = { mode: "fixed", left: box.left, width: box.width, height: h };
    host.style.position = "fixed";
    host.style.left = box.left + "px";
    host.style.width = box.width + "px";
    host.style.right = "auto";
    host.style.bottom = "0px";
    host.style.top = "auto";
    host.style.height = h + "px";
    host.style.flex = "";
    host.style.zIndex = "2147483646";
    host.style.overflow = "hidden";
    host.style.display = "flex";
    host.style.flexDirection = "column";
    host.style.boxSizing = "border-box";
    host.style.order = "";
    if (current) current.dock = "fixed";
    if (!panelResizing) applyPanelChrome(d, panelHeight, panelCollapsed);
  }

  function mountParent(doc) {
    const col = canDockInColumn(doc);
    if (col) return col;
    return (doc && (doc.body || doc.documentElement)) || document.documentElement;
  }

  function stopPanelWatch() {
    if (current && current.watchTimer) {
      clearInterval(current.watchTimer);
      current.watchTimer = null;
    }
    if (current && current.watchMo) {
      try {
        current.watchMo.disconnect();
      } catch (_) {
        /* ignore */
      }
      current.watchMo = null;
    }
  }

  function startPanelWatch(doc, host) {
    stopPanelWatch();
    const tick = () => {
      if (panelResizing) return;
      if (!current || uiMode !== "panel" || !current.host) return;
      if (!weOwn()) {
        stopPanelWatch();
        return;
      }
      const d = current.doc || doc;
      sweepHosts(d, current.host);
      const parent = mountParent(d);
      if (!current.host.isConnected || current.host.parentNode !== parent) {
        parent.appendChild(current.host);
        lastHostBox = null;
      }
      layoutHost(current.host, d);
    };
    const timer = setInterval(tick, 1500);
    let mo = null;
    try {
      mo = new MutationObserver(() => {
        if (panelResizing) return;
        tick();
      });
      const col = canDockInColumn(doc) || doc.getElementById("divInfraAreaTelaD");
      if (col) {
        mo.observe(col, { childList: true, subtree: false });
      }
    } catch (_) {
      mo = null;
    }
    if (current) {
      current.watchTimer = timer;
      current.watchMo = mo;
    }
    return { timer, mo };
  }

  function isPanelMode() {
    return uiMode === "panel";
  }

  function isPageMode() {
    return uiMode === "page";
  }

  function setCollapsed(next) {
    if (!current || !isPanelMode()) return;
    const was = panelCollapsed;
    panelCollapsed = !!next;
    const root = current.shadow && current.shadow.querySelector(".sn-root");
    if (root) root.classList.toggle("is-collapsed", panelCollapsed);
    const toggle = current.shadow && current.shadow.getElementById("sn-toggle");
    if (toggle) {
      toggle.textContent = panelCollapsed ? "▴" : "▾";
      toggle.setAttribute("aria-label", panelCollapsed ? "Expandir painel" : "Recolher painel");
    }
    layoutHost(current.host, current.doc);
    if (was !== panelCollapsed && current.ctx) {
      if (panelCollapsed && current.ctx.onCollapse) {
        try {
          current.ctx.onCollapse();
        } catch (_) {
          /* ignore */
        }
      }
    }
  }

  function setPanelHeight(next, opts) {
    if (!current || !isPanelMode() || panelCollapsed) return;
    const options = opts || {};
    panelHeight = clampHeight(next, current.doc);
    if (panelResizing || options.live) {
      lastHostBox = lastHostBox
        ? { ...lastHostBox, height: panelHeight }
        : lastHostBox;
      current.host.style.height = panelHeight + "px";
      if (current.dock === "column") {
        current.host.style.flex = "0 0 " + panelHeight + "px";
      }
      return;
    }
    layoutHost(current.host, current.doc, { force: true });
    persistPanelHeight(panelHeight);
  }

  function reveal() {
    if (!current) return;
    if (isPanelMode()) {
      setCollapsed(false);
      const head = current.shadow && current.shadow.querySelector(".sn-head");
      if (head) {
        head.classList.remove("is-flash");
        void head.offsetWidth;
        head.classList.add("is-flash");
      }
    }
  }

  function close() {
    const ctx = current && current.ctx;
    stopPanelWatch();
    if (current && current.onKey && current.doc) {
      current.doc.removeEventListener("keydown", current.onKey, true);
    }
    if (current && current.onWinResize && current.win) {
      current.win.removeEventListener("resize", current.onWinResize);
    }
    const owned = weOwn() || (current && current.host);
    if (owned && current && current.host && current.host.parentNode) {
      current.host.remove();
    }
    const doc = (current && current.doc) || mountDoc();
    releaseClaim();
    sweepHosts(doc, null);
    restorePanelChrome();
    lastHostBox = null;
    panelResizing = false;
    current = null;
    showSeiInfo = false;
    showOtherInfo = false;
    if (ctx && ctx.onClose) {
      try {
        ctx.onClose();
      } catch (_) {
        /* ignore */
      }
    }
  }

  function isOpen() {
    if (!current) return false;
    const bag = getBag();
    if (bag && bag.ownerId && bag.ownerId !== ownerId) return false;
    return true;
  }

  function mappingHas(mapping, key) {
    if (!mapping || !mapping[key]) return false;
    const Schema = globalThis.SeiNotionSchema;
    if (Schema && Schema.FIXED_ORDER_ROLES) {
      if (key !== "status" && Schema.FIXED_ORDER_ROLES.indexOf(key) === -1) {
        return false;
      }
    }
    return true;
  }

  const SEI_PANEL_ORDER = [
    "processNumber",
    "processType"
  ];

  function seiReadonlyRoles() {
    const Schema = globalThis.SeiNotionSchema;
    const roles = (Schema && Schema.SEI_READONLY_ROLES) || [
      "processNumber",
      "processType",
      "assignee",
      "labels",
      "seiUrl",
      "notes"
    ];
    return roles.filter((r) => r !== "due");
  }

  function isSeiReadonlyRole(role) {
    return seiReadonlyRoles().indexOf(role) >= 0;
  }

  function foldBlock(opts) {
    const inner = String((opts && opts.inner) || "");
    if (!inner) return "";
    const open = !!(opts && opts.open);
    return (
      `<div class="sn-fold${open ? " is-open" : ""}" id="${opts.wrapId}">` +
      `<label class="sn-fold-toggle">` +
      `<span class="sn-fold-label">${esc(opts.label || "")}</span>` +
      `<span class="sn-switch">` +
      `<input type="checkbox" id="${opts.inputId}" role="switch" aria-checked="${open ? "true" : "false"}" aria-controls="${opts.panelId}"${open ? " checked" : ""} />` +
      `<i></i></span></label>` +
      `<div class="${opts.panelClass}" id="${opts.panelId}"${open ? "" : " hidden"}>${inner}</div>` +
      `</div>`
    );
  }

  function seiFieldClass(role) {
    const wide =
      role === "processType" ||
      role === "labels" ||
      role === "notes" ||
      role === "seiUrl";
    return "sn-field is-sei" + (wide ? " sn-span2" : "");
  }


  function seiTag() {
    return '<em class="sn-sei-tag">SEI</em>';
  }

  function pickLive(live, stored) {
    const L = String(live || "").trim();
    if (L) return L;
    return String(stored || "").trim();
  }

  function httpUrl(u) {
    const s = String(u || "").trim();
    return /^https?:\/\//i.test(s) ? s : "";
  }

  function pickSeiUrl(page, ctx) {
    const live = (ctx && ctx.seiUrl) || "";
    const draft = (ctx && ctx.draft && ctx.draft.seiUrl) || "";
    const stored = (page && page.seiUrl) || "";
    const bad = (u) =>
      globalThis.SeiNotionDom && SeiNotionDom.isControlListUrl
        ? SeiNotionDom.isControlListUrl(u)
        : /procedimento_controlar/i.test(String(u || ""));
    if (live && !bad(live)) return live;
    if (draft && !bad(draft)) return draft;
    if (stored && !bad(stored)) return stored;
    return live || draft || stored || "";
  }

  const MONTH_NAMES_BR = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const WEEKDAYS_BR = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  function formatBrDate(val) {
    if (!val) return "";
    const s = String(val).trim();
    const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (mIso) return `${mIso[3]}/${mIso[2]}/${mIso[1]}`;
    const mBr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (mBr) return `${mBr[1].padStart(2, "0")}/${mBr[2].padStart(2, "0")}/${mBr[3]}`;
    return s;
  }

  function dateValue(iso) {
    return formatBrDate(iso);
  }

  function toIsoDate(val) {
    if (!val) return "";
    const s = String(val).trim();
    const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (mIso) return `${mIso[1]}-${mIso[2]}-${mIso[3]}`;
    const mBr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (mBr) {
      const day = mBr[1].padStart(2, "0");
      const month = mBr[2].padStart(2, "0");
      const year = mBr[3];
      return `${year}-${month}-${day}`;
    }
    return "";
  }

  function parseDateBr(text) {
    const s = String(text || "").trim();
    if (!s) return null;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];
    const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!br) return null;
    const d = Number(br[1]);
    const mo = Number(br[2]);
    const y = Number(br[3]);
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
      return null;
    }
    return (
      String(y) +
      "-" +
      String(mo).padStart(2, "0") +
      "-" +
      String(d).padStart(2, "0")
    );
  }

  function maskDateBr(el) {
    if (!el) return;
    el.addEventListener("input", () => {
      const digits = String(el.value || "").replace(/\D/g, "").slice(0, 8);
      let next = digits;
      if (digits.length > 4) {
        next = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);
      } else if (digits.length > 2) {
        next = digits.slice(0, 2) + "/" + digits.slice(2);
      }
      el.value = next;
    });
  }

  function dateInputHtml(id, name, val, dis, extraClass, dataAttrs) {
    const brVal = formatBrDate(val);
    const idAttr = id ? `id="${id}"` : "";
    const nameAttr = name ? `name="${name}"` : "";
    const cls = extraClass || "";
    const attrs = dataAttrs || "";
    const isKanban = cls.includes("kanban");
    const inputCls = isKanban ? "sn-kanban-input sn-date-input" : "sn-input sn-date-input";
    return `
      <div class="sn-date-wrap ${cls}">
        <input ${idAttr} ${nameAttr} class="${inputCls}" type="text" placeholder="dd/mm/aaaa" maxlength="10" value="${esc(brVal)}" ${attrs} ${dis} autocomplete="off" />
        <button type="button" class="sn-date-btn" title="Selecionar data no calendário" tabindex="-1" ${dis}>📅</button>
      </div>
    `;
  }

  function render(ctx) {
    const mapping = ctx.mapping || {};
    const page = ctx.page || null;
    const draft = ctx.draft || {};
    const locked = !!ctx.locked;
    const busy = !!ctx.busy || locked;
    const labelSource =
      draft.labels ||
      (page && page.labels && page.labels.length ? page.labels : null) ||
      (ctx.seiLabels && ctx.seiLabels.length ? ctx.seiLabels : []) ||
      [];
    const selectedLabels = new Set(
      labelSource.map((l) => (typeof l === "string" ? l : l.name))
    );
    const labelNames = [];
    const addLabel = (n) => {
      if (n && !labelNames.includes(n)) labelNames.push(n);
    };
    (ctx.labelOptions || []).forEach((o) => addLabel(o.name || o));
    selectedLabels.forEach(addLabel);
    (ctx.seiLabels || []).forEach(addLabel);
    if (!page && !draft.labels) {
      (ctx.seiLabels || []).forEach((n) => selectedLabels.add(n));
    }

    let liveName = String(ctx.name || "").trim();
    if (liveName === String(ctx.processNumber || "").trim()) {
      liveName = "";
    }
    const titleVal = pickLive(
      liveName,
      page && page.title
    ) || "";
    const notesVal = pickLive(
      ctx.description,
      (page && page.notes) || ""
    );
    const statusVal =
      "statusName" in draft && draft.statusName !== null && draft.statusName !== undefined
        ? draft.statusName
        : (page && page.status && page.status.name) || "";
    const dueVal = dateValue(
      ctx.seiDue || (("due" in draft && draft.due !== null && draft.due !== undefined) ? draft.due : (page && page.due) || "")
    );
    const assigneeVal = pickLive(ctx.seiAssignee, page && page.assignee)
      .replace(/^[\s:.\-–—]+/, "")
      .replace(/^(?:para|a)\s+/i, "")
      .trim();
    const processTypeVal = pickLive(
      ctx.seiProcessType,
      page && page.processType
    );
    const seiUrlVal = pickSeiUrl(page, ctx);

    const statusOpts = (ctx.statusOptions || [])
      .map((o) => {
        const n = o.name || o;
        const sel = n === statusVal ? " selected" : "";
        return `<option value="${esc(n)}"${sel}>${esc(n)}</option>`;
      })
      .join("");

    const liveLabels = (ctx.seiLabels || []).filter(Boolean);
    const labelChips = liveLabels.length
      ? liveLabels
          .map(
            (n) =>
              `<span class="sn-chip on sn-chip-locked" data-label="${esc(n)}">${esc(n)}</span>`
          )
          .join("")
      : labelNames
          .filter((n) => selectedLabels.has(n))
          .map(
            (n) =>
              `<span class="sn-chip on sn-chip-locked" data-label="${esc(n)}">${esc(n)}</span>`
          )
          .join("");

    const nupField = `<label class="${seiFieldClass("processNumber")}"><span>${esc((mapping && mapping.processNumber) || "Número SEI")}</span>
          <input id="sn-nupfield" type="text" title="${esc(ctx.processNumber || "")}" value="${esc(ctx.processNumber || "")}" readonly disabled /></label>`;
    const titleLabel = mapping.title || "Especificação";
    const titleField = mappingHas(mapping, "title")
      ? `<label class="${seiFieldClass("title")}"><span>${esc(titleLabel)}</span>
          <input id="sn-title" type="text" title="${esc(titleVal)}" value="${esc(titleVal)}" readonly disabled /></label>`
      : "";
    const processTypeField = mappingHas(mapping, "processType")
      ? `<label class="${seiFieldClass("processType")}"><span>${esc(mapping.processType || "Tipo de processo")}</span>
          <input id="sn-processtype" type="text" title="${esc(processTypeVal)}" value="${esc(processTypeVal)}" readonly disabled /></label>`
      : "";
    const statusField = mappingHas(mapping, "status")
      ? `<label class="sn-field"><span>${esc(mapping.status || "Status")}</span>
          <select id="sn-status" ${busy ? "disabled" : ""}>
            <option value="">—</option>${statusOpts}
          </select></label>`
      : "";
    const dueField = mappingHas(mapping, "due")
      ? `<label class="${seiFieldClass("due")}"><span>${esc(mapping.due || "Prazo")}</span>
          ${dateInputHtml("sn-due", "due", dueVal, busy || locked ? "disabled" : "")}</label>`
      : "";
    const labelsField = mappingHas(mapping, "labels")
      ? `<div class="${seiFieldClass("labels")}"><span>${esc(mapping.labels || "Marcadores")}</span><div class="sn-chips" id="sn-labels">${labelChips || '<p class="sn-msg">Nenhum marcador no SEI.</p>'}</div></div>`
      : "";
    const assigneeField = mappingHas(mapping, "assignee")
      ? `<label class="${seiFieldClass("assignee")}"><span>${esc(mapping.assignee || "Atribuição")}</span>
          <input id="sn-assignee" type="text" title="${esc(assigneeVal)}" value="${esc(assigneeVal)}" readonly disabled /></label>`
      : "";
    const notesField = mappingHas(mapping, "notes")
      ? `<label class="${seiFieldClass("notes")}"><span>${esc(mapping.notes || "Observações")}</span>
          <textarea id="sn-notes" readonly disabled>${esc(notesVal)}</textarea></label>`
      : "";
    const seiHref = httpUrl(seiUrlVal);
    const seiLinkText =
      (globalThis.SeiNotionSchema && SeiNotionSchema.SEI_URL_LINK_TEXT) ||
      "Abrir no SEI";
    const urlField = mappingHas(mapping, "seiUrl")
      ? `<div class="${seiFieldClass("seiUrl")}"><span>${esc(mapping.seiUrl || "URL SEI")}</span>${
          seiHref
            ? `<a class="sn-sei-link" id="sn-seiurl" href="${esc(seiHref)}" target="_blank" rel="noopener noreferrer">${esc(seiLinkText)}</a>`
            : '<p class="sn-msg">—</p>'
        }</div>`
      : "";

    const extraValues = {
      ...((page && page.extra) || {}),
      ...(draft.extra || {})
    };
    const extraByName = {};
    const extraDefsByName = {};
    (ctx.extraFields || []).forEach((field) => {
      if (!field || !field.name) return;
      extraDefsByName[field.name] = field;
    });
    const extraNameList = [];
    function addExtraName(n) {
      n = String(n || "").trim();
      if (!n || extraNameList.indexOf(n) !== -1) return;
      const mapped = [
        "processNumber",
        "title",
        "processType",
        "status",
        "labels",
        "assignee",
        "due",
        "seiUrl",
        "notes"
      ].some((role) => mapping[role] === n);
      if (mapped) return;
      extraNameList.push(n);
    }
    (ctx.extraFields || []).forEach((f) => addExtraName(f && f.name));
    (Array.isArray(mapping.extra) ? mapping.extra : []).forEach(addExtraName);
    extraNameList.forEach((name) => {
      const field = extraDefsByName[name] || {
        name,
        type: "rich_text",
        options: []
      };
      extraByName[name] = extraFieldHtml(
        field,
        extraValues[name],
        busy,
        ctx,
        false
      );
    });
    const roleHtml = {
      processNumber: nupField,
      title: titleField,
      processType: processTypeField,
      status: statusField,
      labels: labelsField,
      assignee: assigneeField,
      due: dueField,
      seiUrl: urlField,
      notes: notesField
    };
    const Schema = globalThis.SeiNotionSchema;
    const ordered = Schema && Schema.popupFields ? Schema.popupFields(mapping) : [];
    const seiByRole = {};
    const otherParts = [];
    const takenExtra = new Set();
    function takeField(kind, role, name, html) {
      if (!html) return;
      if (kind === "extra" && name) takenExtra.add(name);
      if (kind === "role" && isSeiReadonlyRole(role)) seiByRole[role] = html;
      else otherParts.push(html);
    }
    if (ordered.length) {
      ordered.forEach((item) => {
        const html =
          item.kind === "role"
            ? roleHtml[item.role] || ""
            : extraByName[item.name] || "";
        takeField(item.kind, item.role, item.name, html);
      });
    } else {
      takeField("role", "processNumber", null, nupField);
      takeField("role", "title", null, titleField);
      takeField("role", "processType", null, processTypeField);
      takeField("role", "status", null, statusField);
      takeField("role", "due", null, dueField);
      takeField("role", "labels", null, labelsField);
      takeField("role", "assignee", null, assigneeField);
      takeField("role", "notes", null, notesField);
      takeField("role", "seiUrl", null, urlField);
      
      Object.keys(extraByName).forEach((n) => {
        if (!takenExtra.has(n)) takeField("extra", null, n, extraByName[n]);
      });
    }
    const seiOrdered = SEI_PANEL_ORDER.map((r) => seiByRole[r])
      .filter(Boolean)
      .concat(
        Object.keys(seiByRole)
          .filter((r) => SEI_PANEL_ORDER.indexOf(r) < 0)
          .map((r) => seiByRole[r])
      );
    const seiBlock = `
      <div class="sn-fold is-open sn-sei-fixed" id="sn-sei-wrap">
        <div class="sn-fold-head-fixed">
          <span class="sn-fold-label">Informações do SEI</span>
        </div>
        <div class="sn-sei-panel" id="sn-sei-panel">
          ${seiOrdered.join("")}
        </div>
      </div>
    `;
    const panel = (ctx.uiMode || uiMode) === "panel";
    const pageMode = (ctx.uiMode || uiMode) === "page";
    const docked = panel || pageMode;
    const kanban = kanbanHtml(ctx, page, busy, locked);
    const otherBlock = `
      <div class="sn-fold is-open sn-sei-fixed" id="sn-other-wrap">
        <div class="sn-fold-head-fixed">
          <span class="sn-fold-label">Informações do Notion</span>
        </div>
        <div class="sn-other-panel" id="sn-other-panel">
          ${otherParts.join("")}
        </div>
      </div>
    `;
    const fieldsHtml =
      `<div class="sn-info-row">${seiBlock}${otherBlock}</div>` +
      `<div class="sn-side sn-side-kanban">${kanban}</div>`;

    let action = "";
    if (locked) {
      action = `<button type="button" class="sn-btn sn-btn-primary" id="sn-retry">Tentar de novo</button>`;
    } else if (page) {
      action = `<button type="button" class="sn-btn sn-btn-primary" id="sn-save" ${busy ? "disabled" : ""}>${busy ? "Salvando…" : "Salvar alterações"}</button>`;
    } else {
      action = `<button type="button" class="sn-btn sn-btn-primary" id="sn-create" ${busy ? "disabled" : ""}>${busy ? "Criando…" : "Criar página no Notion"}</button>`;
    }

    const collapsed = panel && panelCollapsed;
    const rootClass =
      "sn-root" +
      (panel ? " is-panel" : "") +
      (pageMode ? " is-panel is-page" : "") +
      (collapsed ? " is-collapsed" : "");
    const closeLabel = pageMode ? "Fechar aba" : panel ? "Recolher painel" : "Fechar";
    const cancelLabel = pageMode ? "Fechar aba" : panel ? "Recolher" : "Fechar";
    const modalAttrs = panel
      ? 'aria-label="Painel Notion"'
      : pageMode
        ? 'aria-label="SEI Notion"'
        : 'role="dialog" aria-modal="true"';
    const popoutBtn = pageMode
      ? ""
      : `<button type="button" class="sn-popout" id="sn-popout" title="Abrir em nova aba" aria-label="Abrir em nova aba">⧉</button>`;

    return `
      <div class="${rootClass}">
        ${docked ? "" : '<div class="sn-backdrop" id="sn-backdrop"></div>'}
        <div class="sn-modal" ${modalAttrs}>
          ${panel ? '<div class="sn-resize" id="sn-resize" title="Arraste para redimensionar"></div>' : ""}
          <div class="sn-head">
            <div class="sn-logo">N</div>
            <div class="sn-head-text">
              <h2>${locked ? "Em edição por outra pessoa" : page ? "Página no Notion" : "Sem página no Notion"}</h2>
              <div class="sn-nup">${esc(ctx.processNumber || "")}</div>
            </div>
            ${popoutBtn}
            ${panel ? `<button type="button" class="sn-toggle" id="sn-toggle" aria-label="${collapsed ? "Expandir painel" : "Recolher painel"}">${collapsed ? "▴" : "▾"}</button>` : ""}
            <button type="button" class="sn-x" id="sn-close" aria-label="${closeLabel}">${pageMode ? "×" : panel ? (collapsed ? "▴" : "×") : "×"}</button>
          </div>
          <div class="sn-body">
            ${ctx.error ? `<p class="sn-err">${esc(ctx.error)}</p>` : ""}
            ${locked ? `<p class="sn-lock">${esc(ctx.lockName || "Outra pessoa")} está editando agora. Você pode ver os dados, mas não salvar até a pessoa sair da edição (ou o bloqueio expirar em ~1 minuto sem atividade).</p>` : ""}
            ${ctx.lockMine && !locked ? `<p class="sn-mine">Você está editando. Enquanto estiver com o processo em edição, as outras pessoas não conseguem salvar.</p>` : ""}
            ${!page && !ctx.error && !locked ? `<p class="sn-msg">Este processo ainda não está no Notion. Preencha as informações do Notion e crie o card.${docked ? "" : " Os próximos cliques abrem o mesmo card para editar."}</p>` : ""}
            ${fieldsHtml}
          </div>
          <div class="sn-foot">
            ${action}
            <button type="button" class="sn-btn sn-btn-ghost" id="sn-cancel">${cancelLabel}</button>
          </div>
          <div class="sn-overlay" id="sn-loading" ${busy ? "" : "hidden"}>
            <div class="sn-overlay-card">
              <span class="sn-spinner" aria-hidden="true"></span>
              <span id="sn-loading-text">${esc(ctx.busyLabel || "Carregando dados do Notion…")}</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  const expandedActivities = new Set();
  const editingActivities = new Set();

  function kanbanHtml(ctx, page, busy, locked) {
    if (!page || !page.pageId) {
      return `
        <div class="sn-kanban-section">
          <div class="sn-kanban-head">
            <span class="sn-kanban-title">Quadro de Atividades (Kanban)</span>
          </div>
          <p class="sn-msg" style="font-size: 11px;">Crie a página deste processo no Notion para adicionar atividades e gerenciar no Kanban.</p>
        </div>
      `;
    }

    const rawCols =
      ctx.activityStatusColumns && ctx.activityStatusColumns.length
        ? ctx.activityStatusColumns.slice()
        : [];

    const activitiesRaw = Array.isArray(ctx.activities) ? ctx.activities : [];
    const activities =
      globalThis.SeiNotionSchema && SeiNotionSchema.sortActivities
        ? SeiNotionSchema.sortActivities(activitiesRaw)
        : activitiesRaw.slice();
    const templates =
      (Array.isArray(ctx.activityTemplates) && ctx.activityTemplates.length ? ctx.activityTemplates : null) ||
      (Array.isArray(ctx.templates) && ctx.templates.length ? ctx.templates : []) ||
      [];
    const freeze = !!busy || !!locked;
    const dis = freeze ? " disabled" : "";

    // Ensure all unique activity statuses are represented as columns
    const colNames = new Set(rawCols.map((c) => c.name));
    activities.forEach((act) => {
      if (act.statusName && !colNames.has(act.statusName)) {
        rawCols.push({
          id: act.statusName,
          name: act.statusName,
          color: act.statusColor || "default"
        });
        colNames.add(act.statusName);
      }
    });

    if (!rawCols.length) {
      rawCols.push(
        { id: "A Fazer", name: "A Fazer", color: "gray" },
        { id: "Em Andamento", name: "Em Andamento", color: "blue" },
        { id: "Concluído", name: "Concluído", color: "green" }
      );
    }

    const colMap = {};
    rawCols.forEach((c) => {
      colMap[c.name] = [];
    });
    const fallbackCol = rawCols[0] ? rawCols[0].name : "A Fazer";

    activities.forEach((act) => {
      const st = act.statusName || fallbackCol;
      if (colMap[st]) {
        colMap[st].push(act);
      } else {
        if (!colMap[fallbackCol]) colMap[fallbackCol] = [];
        colMap[fallbackCol].push(act);
      }
    });

    const tplPickerHtml = `
      <div class="sn-tpl-picker-wrap">
        <button type="button" id="sn-act-tpl-btn" class="sn-btn sn-btn-ghost sn-tpl-btn" style="padding: 5px 10px; font-size: 11px; font-weight: 700; color: ${templates.length ? "#1e3a8a" : "#64748b"}; background: ${templates.length ? "#eff6ff" : "#f8fafc"}; border: 1px solid ${templates.length ? "#93c5fd" : "#cbd5e1"}; display: inline-flex; align-items: center; gap: 5px; border-radius: 6px; cursor: ${freeze || !templates.length ? "default" : "pointer"};" ${freeze || !templates.length ? "disabled" : ""}>
          <span>⚡ Importar atividades</span>
          ${templates.length ? '<span style="font-size: 9px; opacity: 0.7;">▼</span>' : ""}
        </button>
        <div id="sn-act-tpl-popover" class="sn-tpl-popover" style="display: none;">
          <div class="sn-tpl-search-wrap">
            <input type="text" id="sn-tpl-search-input" class="sn-kanban-input" placeholder="🔍 Buscar modelo…" autocomplete="off" />
          </div>
          <div id="sn-tpl-list" class="sn-tpl-list"></div>
        </div>
      </div>
    `;

    const statusSelectOpts = rawCols
      .map((c) => `<option value="${esc(c.name)}">${esc(c.name)}</option>`)
      .join("");

    const newActBox = `
      <div class="sn-kanban-new-box">
        <input id="sn-new-act-title" class="sn-kanban-input" type="text" placeholder="Nova atividade *" maxlength="2000" ${dis} />
        <input id="sn-new-act-assignee" class="sn-kanban-input" type="text" placeholder="Responsável" value="${esc(ctx.seiAssignee || "")}" maxlength="200" ${dis} />
        ${dateInputHtml("sn-new-act-due", "", ctx.seiDue, dis, "sn-kanban-date-wrap")}
        <select id="sn-new-act-status" class="sn-kanban-input" ${dis}>
          ${statusSelectOpts}
        </select>
        <button type="button" id="sn-new-act-btn" class="sn-btn sn-btn-primary" ${dis}>Criar</button>
        ${tplPickerHtml}
      </div>
    `;

    const colsHtml = rawCols
      .map((col, idx) => {
        const items = colMap[col.name] || [];
        const colNavHtml = `
          <div class="sn-kanban-col-nav">
            ${idx > 0 ? `<button type="button" class="sn-kanban-col-btn sn-col-left" data-col-idx="${idx}" title="Mover coluna para esquerda" ${dis}>◀</button>` : ""}
            ${idx < rawCols.length - 1 ? `<button type="button" class="sn-kanban-col-btn sn-col-right" data-col-idx="${idx}" title="Mover coluna para direita" ${dis}>▶</button>` : ""}
          </div>
        `;

        const cardsHtml = items.length
          ? items
              .map((act) => {
                const isEditing = editingActivities.has(act.activityId);
                if (isEditing) {
                  return `
                    <div class="sn-kanban-card is-editing" data-activity-id="${esc(act.activityId)}">
                      <div class="sn-kanban-edit-box">
                        <span style="font-size: 11px; font-weight: 800; color: #1e3a8a;">Editar Atividade</span>
                        <input class="sn-kanban-input sn-edit-title" type="text" placeholder="Título *" value="${esc(act.title)}" maxlength="2000" ${dis} />
                        <input class="sn-kanban-input sn-edit-assignee" type="text" placeholder="Responsável" value="${esc(act.assignee || "")}" maxlength="200" ${dis} />
                        <div class="sn-date-wrap" style="width: 100%;">
                          <input class="sn-kanban-input sn-date-input sn-edit-due" type="text" placeholder="dd/mm/aaaa" maxlength="10" value="${esc(formatBrDate(act.due))}" ${dis} autocomplete="off" />
                          <button type="button" class="sn-date-btn" title="Selecionar data no calendário" tabindex="-1" ${dis}>📅</button>
                        </div>
                        <select class="sn-kanban-input sn-edit-status" ${dis}>
                          ${rawCols.map((c) => `<option value="${esc(c.name)}"${(act.statusName || rawCols[0].name) === c.name ? " selected" : ""}>${esc(c.name)}</option>`).join("")}
                        </select>
                        <div style="display: flex; gap: 6px; margin-top: 4px;">
                          <button type="button" class="sn-btn sn-btn-primary sn-btn-save-act-edit" data-activity-id="${esc(act.activityId)}" style="padding: 5px 12px; font-size: 11px;" ${dis}>💾 Salvar</button>
                          <button type="button" class="sn-btn sn-btn-ghost sn-btn-cancel-act-edit" data-activity-id="${esc(act.activityId)}" style="padding: 5px 10px; font-size: 11px;">Cancelar</button>
                        </div>
                      </div>
                    </div>
                  `;
                }

                const isExpanded = expandedActivities.has(act.activityId);
                const todos = Array.isArray(act.checklist) ? act.checklist : [];
                const todoCount = act.todoCount || todos.length;
                const completed =
                  act.todoCompleted || todos.filter((t) => t.checked).length;
                const doneClass =
                  todoCount > 0 && completed === todoCount ? " is-done" : "";
                const badgeText =
                  todoCount > 0 ? `${completed}/${todoCount}` : "Checklist";

                const checklistItemsHtml = isExpanded
                  ? `<div class="sn-card-checklist">
                      ${
                        todos.length
                          ? todos
                              .map(
                                (t) => `
                              <div class="sn-card-todo-item${t.checked ? " on" : ""}" data-todo-id="${esc(t.id)}">
                                <input type="checkbox" data-act-id="${esc(act.activityId)}" data-todo-id="${esc(t.id)}"${t.checked ? " checked" : ""}${dis} />
                                <span>${esc(t.text)}</span>
                                <button type="button" class="sn-todo-del" data-act-id="${esc(act.activityId)}" data-todo-id="${esc(t.id)}"${dis}>×</button>
                              </div>
                            `
                              )
                              .join("")
                          : '<span style="font-size: 10px; color: #94a3b8;">Sem itens no checklist.</span>'
                      }
                      <div class="sn-card-todo-add">
                        <input type="text" placeholder="Novo item" data-act-id="${esc(act.activityId)}" maxlength="2000"${dis} />
                        <button type="button" class="sn-btn-card-add-todo" data-act-id="${esc(act.activityId)}"${dis}>+</button>
                      </div>
                    </div>`
                  : "";

                return `
                  <div class="sn-kanban-card" draggable="${freeze ? "false" : "true"}" data-activity-id="${esc(act.activityId)}">
                    <div class="sn-kanban-card-top">
                      <span class="sn-kanban-card-title">${esc(act.title)}</span>
                      <div class="sn-kanban-card-actions">
                        <button type="button" class="sn-kanban-card-btn sn-kanban-card-edit" data-activity-id="${esc(act.activityId)}" title="Editar atividade" draggable="false"${dis}>✏️</button>
                        <button type="button" class="sn-kanban-card-btn sn-kanban-card-del" data-activity-id="${esc(act.activityId)}" title="Excluir atividade" draggable="false"${dis}>×</button>
                      </div>
                    </div>
                    <div class="sn-kanban-card-meta">
                      <span class="sn-kanban-todo-badge${doneClass}" data-act-toggle="${esc(act.activityId)}" title="Ver checklist">
                        <span>✓</span> ${esc(badgeText)}
                      </span>
                      ${act.assignee ? `<span class="sn-kanban-chip" title="Atribuição / Responsável">👤 ${esc(act.assignee)}</span>` : ""}
                      ${act.due ? `<span class="sn-kanban-chip" title="Prazo">📅 ${esc(dateValue(act.due))}</span>` : ""}
                    </div>
                    ${checklistItemsHtml}
                  </div>
                `;
              })
              .join("")
          : '<div class="sn-kanban-empty">Arraste aqui</div>';

        return `
          <div class="sn-kanban-col">
            <div class="sn-kanban-col-head">
              <span>${esc(col.name)}</span>
              ${colNavHtml}
              <span class="sn-kanban-badge">${items.length}</span>
            </div>
            <div class="sn-kanban-cards" data-status-name="${esc(col.name)}">
              ${cardsHtml}
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="sn-kanban-section">
        <div class="sn-kanban-head">
          <span class="sn-kanban-title">Quadro de Atividades (${activities.length})</span>
        </div>
        ${newActBox}
        <div class="sn-kanban-board">
          ${colsHtml}
        </div>
      </div>
    `;
  }

  function extraFieldHtml(field, value, busy, ctx, readonly) {
    const fromSei = !!readonly;
    const dis = busy || fromSei ? "disabled" : "";
    const id = "sn-extra-" + field.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const label = `<span>${esc(field.name)}${fromSei ? " " + seiTag() : ""}</span>`;
    const wrap = fromSei ? "sn-field is-sei" : "sn-field";
    let current = value;
    if (field.type === "select" || field.type === "status" || field.type === "people") {
      const isPeople = field.type === "people";
      const optsList = (field.options || []).slice();
      if (
        current &&
        !optsList.some(
          (o) => (o.name || o) === current || (o.id || o) === current
        )
      ) {
        optsList.unshift(isPeople ? { name: current, id: current } : { name: current });
      }
      const opts = optsList
        .map((o) => {
          const n = typeof o === "object" ? o.name || o.id || "" : String(o);
          const v = isPeople && typeof o === "object" ? o.id || n : n;
          const sel = v === current || n === current ? " selected" : "";
          return `<option value="${esc(v)}"${sel}>${esc(n)}</option>`;
        })
        .join("");
      return `<label class="${wrap}">${label}<select id="${id}" data-extra-name="${esc(field.name)}" data-extra-type="${field.type}" ${dis}><option value="">—</option>${opts}</select></label>`;
    }
    if (field.type === "date") {
      return `<label class="${wrap}">${label}${dateInputHtml(id, field.name, current, dis, "", `data-extra-name="${esc(field.name)}" data-extra-type="date"`)}</label>`;
    }
    if (field.type === "checkbox") {
      const on = current ? " checked" : "";
      return `<label class="${wrap} sn-check">${label}<input id="${id}" data-extra-name="${esc(field.name)}" data-extra-type="checkbox" type="checkbox"${on} ${dis} /></label>`;
    }
    if (field.type === "number") {
      const v = current == null ? "" : String(current);
      return `<label class="${wrap}">${label}<input id="${id}" data-extra-name="${esc(field.name)}" data-extra-type="number" type="number" value="${esc(v)}" ${dis} /></label>`;
    }
    if (field.type === "multi_select") {
      const selected = new Set();
      (Array.isArray(current) ? current : []).forEach((n) => selected.add(n));
      if (fromSei) {
        const chips = [...selected]
          .map((n) => `<span class="sn-chip on sn-chip-locked">${esc(n)}</span>`)
          .join("");
        return `<div class="${wrap}">${label}<div class="sn-chips" data-extra-name="${esc(field.name)}" data-extra-type="multi_select" data-sei-locked="1">${chips || '<p class="sn-msg">Nenhum marcador no SEI.</p>'}</div></div>`;
      }
      const chips = (field.options || [])
        .map((o) => {
          const n = o.name || o;
          const on = selected.has(n) ? " on" : "";
          return `<button type="button" class="sn-chip sn-extra-chip${on}" data-label="${esc(n)}">${esc(n)}</button>`;
        })
        .join("");
      return `<div class="${wrap}">${label}<div class="sn-chips" data-extra-name="${esc(field.name)}" data-extra-type="multi_select">${chips || '<p class="sn-msg">Sem opções.</p>'}</div></div>`;
    }
    return `<label class="${wrap}">${label}<input id="${id}" data-extra-name="${esc(field.name)}" data-extra-type="${field.type}" type="text" value="${esc(current || "")}" ${fromSei ? "readonly" : ""} ${dis} /></label>`;
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function saveUiState(shadow) {
    if (!shadow) return null;
    const modal = shadow.querySelector(".sn-modal");
    const bodyEl = shadow.querySelector(".sn-body");
    const modalScrollTop = modal ? modal.scrollTop : 0;
    const modalScrollLeft = modal ? modal.scrollLeft : 0;
    const bodyScrollTop = bodyEl ? bodyEl.scrollTop : 0;
    const bodyScrollLeft = bodyEl ? bodyEl.scrollLeft : 0;

    const kanbanBoard = shadow.querySelector(".sn-kanban-board");
    const boardScrollLeft = kanbanBoard ? kanbanBoard.scrollLeft : 0;

    const colScrolls = {};
    shadow.querySelectorAll(".sn-kanban-cards").forEach((el) => {
      const status = el.getAttribute("data-status-name");
      if (status) colScrolls[status] = el.scrollTop;
    });

    const active = shadow.activeElement;
    let activeSelector = null;
    let activeCursor = null;
    if (active) {
      if (active.id) {
        activeSelector = "#" + active.id;
      } else if (active.getAttribute("data-activity-id") && active.className) {
        const cls = active.className.trim().split(/\s+/)[0];
        activeSelector = `[data-activity-id="${active.getAttribute("data-activity-id")}"] .${cls}`;
      } else if (active.getAttribute("data-act-id") && active.className) {
        const cls = active.className.trim().split(/\s+/)[0];
        activeSelector = `[data-act-id="${active.getAttribute("data-act-id")}"] .${cls}`;
      }
      if (typeof active.selectionStart === "number") {
        activeCursor = { start: active.selectionStart, end: active.selectionEnd };
      }
    }

    const newActDraft = {
      title: shadow.getElementById("sn-new-act-title") ? shadow.getElementById("sn-new-act-title").value : "",
      assignee: shadow.getElementById("sn-new-act-assignee") ? shadow.getElementById("sn-new-act-assignee").value : "",
      due: shadow.getElementById("sn-new-act-due") ? shadow.getElementById("sn-new-act-due").value : "",
      status: shadow.getElementById("sn-new-act-status") ? shadow.getElementById("sn-new-act-status").value : ""
    };

    const editingDrafts = {};
    shadow.querySelectorAll(".sn-kanban-card.is-editing").forEach((card) => {
      const actId = card.getAttribute("data-activity-id");
      if (!actId) return;
      const titleInput = card.querySelector(".sn-edit-title");
      const assInput = card.querySelector(".sn-edit-assignee");
      const dueInput = card.querySelector(".sn-edit-due");
      const statusSelect = card.querySelector(".sn-edit-status");
      editingDrafts[actId] = {
        title: titleInput ? titleInput.value : "",
        assignee: assInput ? assInput.value : "",
        due: dueInput ? dueInput.value : "",
        status: statusSelect ? statusSelect.value : ""
      };
    });

    return {
      modalScrollTop,
      modalScrollLeft,
      bodyScrollTop,
      bodyScrollLeft,
      boardScrollLeft,
      colScrolls,
      activeSelector,
      activeCursor,
      newActDraft,
      editingDrafts
    };
  }

  function restoreUiState(shadow, state) {
    if (!shadow || !state) return;

    function applyState() {
      const modal = shadow.querySelector(".sn-modal");
      if (modal) {
        modal.scrollTop = state.modalScrollTop;
        modal.scrollLeft = state.modalScrollLeft;
      }
      const bodyEl = shadow.querySelector(".sn-body");
      if (bodyEl) {
        bodyEl.scrollTop = state.bodyScrollTop || 0;
        bodyEl.scrollLeft = state.bodyScrollLeft || 0;
      }

      const kanbanBoard = shadow.querySelector(".sn-kanban-board");
      if (kanbanBoard && state.boardScrollLeft) {
        kanbanBoard.scrollLeft = state.boardScrollLeft;
      }

      if (state.colScrolls) {
        shadow.querySelectorAll(".sn-kanban-cards").forEach((el) => {
          const status = el.getAttribute("data-status-name");
          if (status && typeof state.colScrolls[status] === "number") {
            el.scrollTop = state.colScrolls[status];
          }
        });
      }

      if (state.newActDraft) {
        const tEl = shadow.getElementById("sn-new-act-title");
        const aEl = shadow.getElementById("sn-new-act-assignee");
        const dEl = shadow.getElementById("sn-new-act-due");
        const sEl = shadow.getElementById("sn-new-act-status");
        if (tEl && state.newActDraft.title && !tEl.value) tEl.value = state.newActDraft.title;
        if (aEl && state.newActDraft.assignee && !aEl.value) aEl.value = state.newActDraft.assignee;
        if (dEl && state.newActDraft.due && !dEl.value) dEl.value = state.newActDraft.due;
        if (sEl && state.newActDraft.status && !sEl.value) sEl.value = state.newActDraft.status;
      }

      if (state.editingDrafts) {
        shadow.querySelectorAll(".sn-kanban-card.is-editing").forEach((card) => {
          const actId = card.getAttribute("data-activity-id");
          const draft = state.editingDrafts[actId];
          if (!draft) return;
          const titleInput = card.querySelector(".sn-edit-title");
          const assInput = card.querySelector(".sn-edit-assignee");
          const dueInput = card.querySelector(".sn-edit-due");
          const statusSelect = card.querySelector(".sn-edit-status");
          if (titleInput && draft.title && !titleInput.value) titleInput.value = draft.title;
          if (assInput && draft.assignee && !assInput.value) assInput.value = draft.assignee;
          if (dueInput && draft.due && !dueInput.value) dueInput.value = draft.due;
          if (statusSelect && draft.status && !statusSelect.value) statusSelect.value = draft.status;
        });
      }

      if (state.activeSelector) {
        try {
          const el = shadow.querySelector(state.activeSelector);
          if (el && typeof el.focus === "function") {
            el.focus({ preventScroll: true });
            if (state.activeCursor && typeof el.setSelectionRange === "function") {
              el.setSelectionRange(state.activeCursor.start, state.activeCursor.end);
            }
          }
        } catch (_) {}
      }
    }

    applyState();
    requestAnimationFrame(applyState);
  }

  function rerender(ctx) {
    if (!current) return;
    const uiState = saveUiState(current.shadow);
    const draft = readFormFrom(current.shadow, current.ctx);
    if (draft) ctx.draft = draft;
    current.ctx = ctx;
    current.wrap.innerHTML = render(ctx);
    bind(current.shadow, ctx);
    restoreUiState(current.shadow, uiState);
  }

  function applyFold(shadow, state) {
    const wrap = shadow.getElementById(state.wrapId);
    const panel = shadow.getElementById(state.panelId);
    const input = shadow.getElementById(state.inputId);
    if (wrap) wrap.classList.toggle("is-open", !!state.on);
    if (panel) {
      if (state.on) panel.removeAttribute("hidden");
      else panel.setAttribute("hidden", "");
    }
    if (input) {
      input.checked = !!state.on;
      input.setAttribute("aria-checked", state.on ? "true" : "false");
    }
  }

  function applySeiInfo(shadow, on) {
    showSeiInfo = !!on;
    applyFold(shadow, {
      wrapId: "sn-sei-wrap",
      panelId: "sn-sei-panel",
      inputId: "sn-sei-info",
      on: showSeiInfo
    });
  }

  function applyOtherInfo(shadow, on) {
    showOtherInfo = !!on;
    applyFold(shadow, {
      wrapId: "sn-other-wrap",
      panelId: "sn-other-panel",
      inputId: "sn-other-info",
      on: showOtherInfo
    });
  }

  function setupDatePickers(shadow) {
    function closeAllCalendars() {
      shadow.querySelectorAll(".sn-calendar-popover").forEach((p) => p.remove());
    }

    shadow.addEventListener("click", (ev) => {
      if (!ev.target.closest(".sn-date-wrap") && !ev.target.closest(".sn-calendar-popover")) {
        closeAllCalendars();
      }
    });

    shadow.querySelectorAll(".sn-date-wrap").forEach((wrap) => {
      const input = wrap.querySelector(".sn-date-input");
      const btn = wrap.querySelector(".sn-date-btn");
      if (!input) return;

      maskDateBr(input);

      function openCalendar(ev) {
        if (input.disabled || input.readOnly) return;
        if (ev) ev.stopPropagation();

        const existing = wrap.querySelector(".sn-calendar-popover");
        if (existing) {
          existing.remove();
          return;
        }
        closeAllCalendars();

        let currentYear = new Date().getFullYear();
        let currentMonth = new Date().getMonth();
        let selectedDay = null;
        let selectedMonth = null;
        let selectedYear = null;

        const val = String(input.value || "").trim();
        const m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m) {
          const d = parseInt(m[1], 10);
          const mo = parseInt(m[2], 10) - 1;
          const y = parseInt(m[3], 10);
          if (y >= 1900 && y <= 2100 && mo >= 0 && mo <= 11 && d >= 1 && d <= 31) {
            currentYear = y;
            currentMonth = mo;
            selectedDay = d;
            selectedMonth = mo;
            selectedYear = y;
          }
        }

        const popover = document.createElement("div");
        popover.className = "sn-calendar-popover";
        wrap.appendChild(popover);

        function renderCalendar() {
          const today = new Date();
          const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
          const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
          const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

          let daysHtml = "";

          for (let i = firstDayIndex - 1; i >= 0; i--) {
            const d = daysInPrevMonth - i;
            daysHtml += `<button type="button" class="sn-calendar-day is-other-month" data-day="${d}" data-month="${currentMonth - 1}" data-year="${currentYear}">${d}</button>`;
          }

          for (let d = 1; d <= daysInMonth; d++) {
            const isToday =
              today.getDate() === d &&
              today.getMonth() === currentMonth &&
              today.getFullYear() === currentYear;
            const isSelected =
              selectedDay === d &&
              selectedMonth === currentMonth &&
              selectedYear === currentYear;

            const cls = [
              "sn-calendar-day",
              isToday ? "is-today" : "",
              isSelected ? "is-selected" : ""
            ].filter(Boolean).join(" ");

            daysHtml += `<button type="button" class="${cls}" data-day="${d}" data-month="${currentMonth}" data-year="${currentYear}">${d}</button>`;
          }

          const totalRendered = firstDayIndex + daysInMonth;
          const remainder = (7 - (totalRendered % 7)) % 7;
          for (let d = 1; d <= remainder; d++) {
            daysHtml += `<button type="button" class="sn-calendar-day is-other-month" data-day="${d}" data-month="${currentMonth + 1}" data-year="${currentYear}">${d}</button>`;
          }

          popover.innerHTML = `
            <div class="sn-calendar-head">
              <button type="button" class="sn-calendar-nav-btn sn-cal-prev" title="Mês anterior">◀</button>
              <span class="sn-calendar-title">${MONTH_NAMES_BR[currentMonth]} ${currentYear}</span>
              <button type="button" class="sn-calendar-nav-btn sn-cal-next" title="Próximo mês">▶</button>
            </div>
            <div class="sn-calendar-weekdays">
              ${WEEKDAYS_BR.map((w) => `<span>${w}</span>`).join("")}
            </div>
            <div class="sn-calendar-days">
              ${daysHtml}
            </div>
            <div class="sn-calendar-foot">
              <button type="button" class="sn-calendar-quick-btn sn-cal-today">Hoje</button>
              <button type="button" class="sn-calendar-quick-btn sn-cal-clear" style="color: #ef4444;">Limpar</button>
            </div>
          `;

          popover.querySelector(".sn-cal-prev").addEventListener("click", (e) => {
            e.stopPropagation();
            if (currentMonth === 0) {
              currentMonth = 11;
              currentYear--;
            } else {
              currentMonth--;
            }
            renderCalendar();
          });

          popover.querySelector(".sn-cal-next").addEventListener("click", (e) => {
            e.stopPropagation();
            if (currentMonth === 11) {
              currentMonth = 0;
              currentYear++;
            } else {
              currentMonth++;
            }
            renderCalendar();
          });

          popover.querySelector(".sn-cal-today").addEventListener("click", (e) => {
            e.stopPropagation();
            const now = new Date();
            const dStr = String(now.getDate()).padStart(2, "0");
            const mStr = String(now.getMonth() + 1).padStart(2, "0");
            const yStr = String(now.getFullYear());
            input.value = `${dStr}/${mStr}/${yStr}`;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            popover.remove();
          });

          popover.querySelector(".sn-cal-clear").addEventListener("click", (e) => {
            e.stopPropagation();
            input.value = "";
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            popover.remove();
          });

          popover.querySelectorAll(".sn-calendar-day").forEach((dayBtn) => {
            dayBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              const d = parseInt(dayBtn.getAttribute("data-day"), 10);
              const mRaw = parseInt(dayBtn.getAttribute("data-month"), 10);
              let y = parseInt(dayBtn.getAttribute("data-year"), 10);
              let mo = mRaw;
              if (mo < 0) {
                mo = 11;
                y--;
              } else if (mo > 11) {
                mo = 0;
                y++;
              }
              const dStr = String(d).padStart(2, "0");
              const mStr = String(mo + 1).padStart(2, "0");
              const yStr = String(y);
              input.value = `${dStr}/${mStr}/${yStr}`;
              input.dispatchEvent(new Event("input", { bubbles: true }));
              input.dispatchEvent(new Event("change", { bubbles: true }));
              popover.remove();
            });
          });
        }

        renderCalendar();
      }

      if (btn) btn.addEventListener("click", openCalendar);
      input.addEventListener("click", openCalendar);
    });
  }

  function setupTemplatePicker(shadow, ctx, templates) {
    const pickerWrap = shadow.querySelector(".sn-tpl-picker-wrap");
    if (!pickerWrap) return;
    const btn = pickerWrap.querySelector("#sn-act-tpl-btn");
    const popover = pickerWrap.querySelector("#sn-act-tpl-popover");
    const searchInput = pickerWrap.querySelector("#sn-tpl-search-input");
    const tplList = pickerWrap.querySelector("#sn-tpl-list");

    if (!btn || !popover || !searchInput || !tplList || !templates || !templates.length) return;

    function normalizeStr(s) {
      return String(s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    }

    function closeTplPopover() {
      popover.style.display = "none";
      searchInput.value = "";
    }

    function openTplPopover(ev) {
      if (btn.disabled || ctx.locked) return;
      if (ev) ev.stopPropagation();
      const isVisible = popover.style.display !== "none";
      if (isVisible) {
        closeTplPopover();
        return;
      }
      shadow.querySelectorAll(".sn-calendar-popover").forEach((p) => p.remove());

      popover.style.display = "flex";
      renderTemplates("");
      setTimeout(() => {
        searchInput.focus();
      }, 50);
    }

    function importTemplate(tplId, tplName) {
      if (ctx.locked || !tplId) return;
      closeTplPopover();
      const assInput = shadow.getElementById("sn-new-act-assignee");
      const dueInput = shadow.getElementById("sn-new-act-due");
      const statusSelect = shadow.getElementById("sn-new-act-status");

      const assignee = assInput ? String(assInput.value || "").trim() : (ctx.seiAssignee || "");
      const due = dueInput ? (toIsoDate(dueInput.value) || "") : (ctx.seiDue ? toIsoDate(ctx.seiDue) : "");
      const cols = ctx.activityStatusColumns || [];
      const firstCol = cols.length ? cols[0].name : "A Fazer";
      const statusName = statusSelect && statusSelect.value ? statusSelect.value : firstCol;

      if (ctx.onImportActivityTemplate) {
        ctx.onImportActivityTemplate({
          templateId: tplId,
          templateName: tplName,
          assignee,
          due,
          statusName
        });
      } else if (ctx.onCreateActivity) {
        ctx.onCreateActivity({
          title: tplName,
          templateId: tplId,
          assignee,
          due,
          statusName
        });
      }
    }

    function renderTemplates(filterText) {
      const q = normalizeStr(filterText);
      const filtered = q
        ? templates.filter((t) => normalizeStr(t.name).includes(q))
        : templates;

      if (!filtered.length) {
        tplList.innerHTML = `<div class="sn-tpl-empty">Nenhum modelo encontrado</div>`;
        return filtered;
      }

      tplList.innerHTML = filtered
        .map(
          (t) => `
        <button type="button" class="sn-tpl-item" data-tpl-id="${esc(t.id)}" data-tpl-name="${esc(t.name || "Modelo")}">
          <span class="sn-tpl-item-icon">📋</span>
          <span class="sn-tpl-item-name" title="${esc(t.name || "Modelo")}">${esc(t.name || "Modelo")}</span>
        </button>
      `
        )
        .join("");

      tplList.querySelectorAll(".sn-tpl-item").forEach((itemBtn) => {
        itemBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const tplId = itemBtn.getAttribute("data-tpl-id");
          const tplName = itemBtn.getAttribute("data-tpl-name");
          importTemplate(tplId, tplName);
        });
      });

      return filtered;
    }

    btn.addEventListener("click", openTplPopover);

    searchInput.addEventListener("input", () => {
      renderTemplates(searchInput.value);
    });

    searchInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        closeTplPopover();
        btn.focus();
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        ev.stopPropagation();
        const filtered = renderTemplates(searchInput.value);
        if (filtered && filtered.length > 0) {
          importTemplate(filtered[0].id, filtered[0].name || "Modelo");
        }
      }
    });

    shadow.addEventListener("click", (ev) => {
      if (!ev.target.closest(".sn-tpl-picker-wrap")) {
        closeTplPopover();
      }
    });
  }

  function bind(shadow, ctx) {
    const $ = (id) => shadow.getElementById(id);
    const closeIt = () => {
      if (isPageMode()) {
        window.close();
        return;
      }
      if (isPanelMode()) {
        setCollapsed(true);
        return;
      }
      close();
    };
    const bd = $("sn-backdrop");
    const x = $("sn-close");
    const cancel = $("sn-cancel");
    const toggle = $("sn-toggle");
    const resize = $("sn-resize");
    const popout = $("sn-popout");
    if (popout && ctx.onPopout) {
      popout.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        ctx.onPopout();
      });
    }
    if (bd) {
      bd.addEventListener("click", (ev) => {
        if (ev.target === bd) closeIt();
      });
    }
    if (x) x.addEventListener("click", closeIt);
    if (cancel) cancel.addEventListener("click", closeIt);
    if (toggle) {
      toggle.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        setCollapsed(!panelCollapsed);
      });
    }
    const head = shadow.querySelector(".sn-head");
    if (head && isPanelMode()) {
      head.addEventListener("click", (ev) => {
        if (ev.target.closest("button")) return;
        if (panelCollapsed) setCollapsed(false);
      });
    }
    if (resize && isPanelMode()) {
      resize.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const startY = ev.clientY;
        const startH = panelHeight;
        panelResizing = true;
        resize.classList.add("is-drag");
        try {
          resize.setPointerCapture(ev.pointerId);
        } catch (_) {
          /* ignore */
        }
        const onMove = (e) => {
          setPanelHeight(startH + (startY - e.clientY), { live: true });
        };
        const onUp = () => {
          panelResizing = false;
          resize.classList.remove("is-drag");
          resize.removeEventListener("pointermove", onMove);
          resize.removeEventListener("pointerup", onUp);
          resize.removeEventListener("pointercancel", onUp);
          layoutHost(current && current.host, current && current.doc, { force: true });
          persistPanelHeight(panelHeight);
        };
        resize.addEventListener("pointermove", onMove);
        resize.addEventListener("pointerup", onUp);
        resize.addEventListener("pointercancel", onUp);
      });
    }
    if (ctx.onEditIntent && !ctx.locked) {
      const fireIntent = () => {
        try {
          ctx.onEditIntent();
        } catch (_) {
          /* ignore */
        }
      };
      shadow
        .querySelectorAll(
          "input:not([readonly]):not([disabled]), textarea:not([readonly]), select:not([disabled])"
        )
        .forEach((el) => {
          el.addEventListener("focus", fireIntent);
        });
      shadow
        .querySelectorAll(
          "#sn-save, #sn-create, #sn-new-act-btn, .sn-chip, .sn-kanban-card, .sn-kanban-col"
        )
        .forEach((el) => {
          el.addEventListener("pointerdown", fireIntent);
        });
    }

    const seiInfo = $("sn-sei-info");
    if (seiInfo) {
      applySeiInfo(shadow, showSeiInfo);
      seiInfo.addEventListener("change", () => {
        applySeiInfo(shadow, seiInfo.checked);
      });
    }
    shadow.querySelectorAll(".sn-chip:not(.sn-chip-locked)").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (ctx.locked) return;
        btn.classList.toggle("on");
      });
    });

    setupDatePickers(shadow);
    const templates =
      (Array.isArray(ctx.activityTemplates) && ctx.activityTemplates.length ? ctx.activityTemplates : null) ||
      (Array.isArray(ctx.templates) && ctx.templates.length ? ctx.templates : []) ||
      [];
    setupTemplatePicker(shadow, ctx, templates);

    const createBtn = $("sn-create");
    if (createBtn) {
      createBtn.addEventListener("click", () => {
        if (ctx.onCreate) ctx.onCreate(readFormFrom(shadow, ctx));
      });
    }
    const saveBtn = $("sn-save");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        if (!ctx.page) return;
        if (ctx.onSave) ctx.onSave(ctx.page.pageId, readFormFrom(shadow, ctx));
      });
    }
    const retryBtn = $("sn-retry");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        if (ctx.onRetry) ctx.onRetry();
      });
    }

    // Column Reorder Bindings (Left / Right)
    const rawCols = ctx.activityStatusColumns || [];
    shadow.querySelectorAll(".sn-col-left").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (ctx.locked) return;
        const idx = parseInt(btn.getAttribute("data-col-idx"), 10);
        if (isNaN(idx) || idx <= 0) return;
        const cols = rawCols.map((c) => c.name);
        const swap = cols[idx - 1];
        cols[idx - 1] = cols[idx];
        cols[idx] = swap;
        if (ctx.onReorderColumns) ctx.onReorderColumns(cols);
      });
    });

    shadow.querySelectorAll(".sn-col-right").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (ctx.locked) return;
        const idx = parseInt(btn.getAttribute("data-col-idx"), 10);
        if (isNaN(idx) || idx >= rawCols.length - 1) return;
        const cols = rawCols.map((c) => c.name);
        const swap = cols[idx + 1];
        cols[idx + 1] = cols[idx];
        cols[idx] = swap;
        if (ctx.onReorderColumns) ctx.onReorderColumns(cols);
      });
    });

    // Kanban Bindings
    function addActivityFromForm() {
      if (ctx.locked) return;
      const titleInput = $("sn-new-act-title");
      const assInput = $("sn-new-act-assignee");
      const dueInput = $("sn-new-act-due");
      const statusSelect = $("sn-new-act-status");

      const title = titleInput ? String(titleInput.value || "").trim() : "";
      if (!title) {
        if (titleInput) titleInput.focus();
        return;
      }
      const assignee = assInput ? String(assInput.value || "").trim() : "";
      const due = dueInput ? (toIsoDate(dueInput.value) || "") : "";
      const cols = ctx.activityStatusColumns || [];
      const firstCol = cols.length ? cols[0].name : "A Fazer";
      const statusName = statusSelect && statusSelect.value ? statusSelect.value : firstCol;

      if (titleInput) titleInput.value = "";

      if (ctx.onCreateActivity) {
        ctx.onCreateActivity({
          title,
          assignee,
          due,
          statusName
        });
      }
    }

    const addActBtn = $("sn-new-act-btn");
    if (addActBtn) addActBtn.addEventListener("click", addActivityFromForm);

    ["sn-new-act-title", "sn-new-act-assignee"].forEach((id) => {
      const el = $(id);
      if (el) {
        el.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            addActivityFromForm();
          }
        });
      }
    });

    // Activity Edit Mode Toggles & Save
    shadow.querySelectorAll(".sn-kanban-card-edit").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (ctx.locked) return;
        const actId = btn.getAttribute("data-activity-id");
        if (!actId) return;
        if (editingActivities.has(actId)) {
          editingActivities.delete(actId);
        } else {
          editingActivities.add(actId);
        }
        rerender(ctx);
      });
    });

    shadow.querySelectorAll(".sn-btn-cancel-act-edit").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const actId = btn.getAttribute("data-activity-id");
        if (actId) editingActivities.delete(actId);
        rerender(ctx);
      });
    });

    shadow.querySelectorAll(".sn-btn-save-act-edit").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (ctx.locked) return;
        const actId = btn.getAttribute("data-activity-id");
        if (!actId) return;
        const formEl = btn.closest(".sn-kanban-edit-box");
        if (!formEl) return;
        const titleInput = formEl.querySelector(".sn-edit-title");
        const assInput = formEl.querySelector(".sn-edit-assignee");
        const dueInput = formEl.querySelector(".sn-edit-due");
        const statusSelect = formEl.querySelector(".sn-edit-status");

        const title = titleInput ? String(titleInput.value || "").trim() : "";
        if (!title) {
          if (titleInput) titleInput.focus();
          return;
        }
        const assignee = assInput ? String(assInput.value || "").trim() : "";
        const due = dueInput ? (toIsoDate(dueInput.value) || "") : "";
        const statusName = statusSelect ? statusSelect.value : "";

        editingActivities.delete(actId);

        if (ctx.onUpdateActivity) {
          ctx.onUpdateActivity({
            activityId: actId,
            title,
            assignee,
            due,
            statusName
          });
        }
      });
    });

    // Drag & Drop (coluna e ordem na coluna)
    function clearKanbanPlaceholders() {
      shadow.querySelectorAll(".sn-kanban-placeholder").forEach((el) => el.remove());
      shadow.querySelectorAll(".sn-kanban-cards.is-dragover").forEach((el) => {
        el.classList.remove("is-dragover");
      });
    }

    function placeKanbanPlaceholder(dropZone, clientY) {
      const cards = [...dropZone.querySelectorAll(".sn-kanban-card")].filter(
        (c) => c.getAttribute("data-activity-id") !== draggingActivityId
      );
      let before = null;
      for (let i = 0; i < cards.length; i += 1) {
        const r = cards[i].getBoundingClientRect();
        if (clientY < r.top + r.height / 2) {
          before = cards[i];
          break;
        }
      }
      let ph = dropZone.querySelector(".sn-kanban-placeholder");
      if (!ph) {
        ph = document.createElement("div");
        ph.className = "sn-kanban-placeholder";
      }
      if (before) {
        if (ph.nextSibling !== before) dropZone.insertBefore(ph, before);
      } else if (ph.parentNode !== dropZone || ph.nextSibling) {
        dropZone.appendChild(ph);
      }
    }

    function orderedIdsFromZone(dropZone, movedId) {
      const ids = [];
      let placed = false;
      [...dropZone.children].forEach((el) => {
        if (el.classList && el.classList.contains("sn-kanban-placeholder")) {
          if (movedId && ids.indexOf(movedId) === -1) {
            ids.push(movedId);
            placed = true;
          }
          return;
        }
        if (!el.classList || !el.classList.contains("sn-kanban-card")) return;
        const id = el.getAttribute("data-activity-id");
        if (!id || id === movedId) return;
        ids.push(id);
      });
      if (movedId && !placed && ids.indexOf(movedId) === -1) ids.push(movedId);
      return ids;
    }

    shadow.querySelectorAll(".sn-kanban-card:not(.is-editing)").forEach((card) => {
      card.addEventListener("dragstart", (ev) => {
        if (ctx.locked) {
          ev.preventDefault();
          return;
        }
        if (
          ev.target &&
          ev.target.closest &&
          ev.target.closest("button, input, textarea, select, a, .sn-card-checklist")
        ) {
          ev.preventDefault();
          return;
        }
        draggingActivityId = card.getAttribute("data-activity-id") || "";
        ev.dataTransfer.setData("text/plain", draggingActivityId);
        ev.dataTransfer.effectAllowed = "move";
        card.classList.add("is-dragging");
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("is-dragging");
        draggingActivityId = "";
        clearKanbanPlaceholders();
      });
    });

    shadow.querySelectorAll(".sn-kanban-cards").forEach((dropZone) => {
      dropZone.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";
        dropZone.classList.add("is-dragover");
        shadow.querySelectorAll(".sn-kanban-cards.is-dragover").forEach((el) => {
          if (el !== dropZone) el.classList.remove("is-dragover");
        });
        shadow.querySelectorAll(".sn-kanban-placeholder").forEach((el) => {
          if (el.parentNode !== dropZone) el.remove();
        });
        placeKanbanPlaceholder(dropZone, ev.clientY);
      });
      dropZone.addEventListener("dragleave", (ev) => {
        if (!dropZone.contains(ev.relatedTarget)) {
          dropZone.classList.remove("is-dragover");
          const ph = dropZone.querySelector(".sn-kanban-placeholder");
          if (ph) ph.remove();
        }
      });
      dropZone.addEventListener("drop", (ev) => {
        ev.preventDefault();
        const actId =
          draggingActivityId || ev.dataTransfer.getData("text/plain") || "";
        const targetStatus = dropZone.getAttribute("data-status-name");
        const orderedIds = orderedIdsFromZone(dropZone, actId);
        clearKanbanPlaceholders();
        draggingActivityId = "";
        if (ctx.locked || !actId || !targetStatus) return;
        if (ctx.onReorderActivities) {
          ctx.onReorderActivities({
            activityId: actId,
            statusName: targetStatus,
            orderedIds
          });
        } else if (ctx.onMoveActivity) {
          ctx.onMoveActivity(actId, targetStatus);
        }
      });
    });

    // Activity Delete
    shadow.querySelectorAll(".sn-kanban-card-del").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (ctx.locked) return;
        const actId = btn.getAttribute("data-activity-id");
        if (!actId) return;
        if (window.confirm("Excluir esta atividade?")) {
          if (ctx.onDeleteActivity) ctx.onDeleteActivity(actId);
        }
      });
    });

    // Activity Checklist Toggle
    shadow.querySelectorAll("[data-act-toggle]").forEach((badge) => {
      badge.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const actId = badge.getAttribute("data-act-toggle");
        if (!actId) return;
        if (expandedActivities.has(actId)) {
          expandedActivities.delete(actId);
        } else {
          expandedActivities.add(actId);
        }
        rerender(ctx);
      });
    });

    // Activity Checklist Checkboxes
    shadow.querySelectorAll(".sn-card-todo-item input[type='checkbox']").forEach((ck) => {
      ck.addEventListener("change", (ev) => {
        ev.stopPropagation();
        if (ctx.locked) return;
        const actId = ck.getAttribute("data-act-id");
        const todoId = ck.getAttribute("data-todo-id");
        if (ctx.onToggleActivityTodo) {
          ctx.onToggleActivityTodo(actId, todoId, !!ck.checked);
        }
      });
    });

    // Activity Checklist Delete item
    shadow.querySelectorAll(".sn-card-todo-item .sn-todo-del").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (ctx.locked) return;
        const actId = btn.getAttribute("data-act-id");
        const todoId = btn.getAttribute("data-todo-id");
        if (ctx.onDeleteActivityTodo) {
          ctx.onDeleteActivityTodo(actId, todoId);
        }
      });
    });

    // Activity Checklist Add item
    function addCardTodo(actId, input) {
      if (ctx.locked) return;
      const text = input ? String(input.value || "").trim() : "";
      if (!text || !actId) return;
      if (input) input.value = "";
      if (ctx.onAddActivityTodo) {
        ctx.onAddActivityTodo(actId, text);
      }
    }

    shadow.querySelectorAll(".sn-btn-card-add-todo").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const actId = btn.getAttribute("data-act-id");
        const parent = btn.closest(".sn-card-todo-add");
        const input = parent ? parent.querySelector("input") : null;
        addCardTodo(actId, input);
      });
    });

    shadow.querySelectorAll(".sn-card-todo-add input").forEach((input) => {
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          ev.stopPropagation();
          const actId = input.getAttribute("data-act-id");
          addCardTodo(actId, input);
        }
      });
    });
  }

  function open(ctx) {
    const doc = mountDoc();
    close();
    uiMode =
      ctx && (ctx.uiMode === "panel" || ctx.uiMode === "page")
        ? ctx.uiMode
        : "modal";
    panelCollapsed = false;
    if (uiMode === "panel" || uiMode === "page") showOtherInfo = true;
    panelHeight = clampHeight(
      (ctx && ctx.panelHeight) || panelHeight,
      doc
    );
    ctx = { ...(ctx || {}), uiMode };

    sweepHosts(doc, null);

    const host = doc.createElement("div");
    host.id = HOST_ID;
    host.setAttribute("data-sei-notion-owner", ownerId);
    if (uiMode === "panel") {
      layoutHost(host, doc);
    } else if (uiMode === "page") {
      host.style.cssText =
        "position:fixed;inset:0;z-index:1;overflow:hidden;display:flex;flex-direction:column;";
    } else {
      host.style.cssText =
        "position:fixed;inset:0;z-index:2147483646;overflow:hidden;display:block;";
    }
    const shadow = host.attachShadow({ mode: "open" });
    const style = doc.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);
    const wrap = doc.createElement("div");
    wrap.innerHTML = render(ctx);
    shadow.appendChild(wrap);
    mountParent(doc).appendChild(host);

    const onKey = (ev) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        if (uiMode === "page") return;
        if (uiMode === "panel") {
          if (!panelCollapsed) setCollapsed(true);
        } else {
          close();
        }
      }
    };
    doc.addEventListener("keydown", onKey, true);

    let onWinResize = null;
    let win = window;
    try {
      win = doc.defaultView || window.top || window;
    } catch (_) {
      win = window;
    }
    if (uiMode === "panel") {
      onWinResize = () => {
        if (!current || uiMode !== "panel" || panelResizing) return;
        layoutHost(current.host, doc);
      };
      win.addEventListener("resize", onWinResize);
    }

    current = { doc, ctx, shadow, wrap, onKey, host, dock: "fixed", win, onWinResize };
    claimHost(host);
    bind(shadow, ctx);
    if (uiMode === "panel") {
      layoutHost(host, doc, { force: true });
      startPanelWatch(doc, host);
    }
  }

  function readFormFrom(shadow, ctx) {
    if (!shadow) return null;
    const $ = (id) => shadow.getElementById(id);
    const titleEl = $("sn-title");
    const notesEl = $("sn-notes");
    const statusEl = $("sn-status");
    const dueEl = $("sn-due");
    const labelsRoot = $("sn-labels");
    const page = ctx && ctx.page;
    const out = {
      processNumber: (ctx && ctx.processNumber) || (page && page.processNumber) || "",
      seiUrl: pickSeiUrl(page, ctx)
    };
    if (titleEl) out.name = titleEl.value.trim();
    else if (page && page.title) out.name = page.title;

    if (mappingHas(ctx && ctx.mapping, "notes")) {
      out.description = pickLive(
        ctx && ctx.description,
        notesEl ? notesEl.value : (page && page.notes) || ""
      );
    } else if (notesEl) {
      out.description = notesEl.value;
    } else if (page && page.notes) {
      out.description = page.notes;
    }

    if (statusEl) {
      out.statusName = statusEl.value || (page && page.status && page.status.name) || null;
    } else if (page && page.status && page.status.name) {
      out.statusName = page.status.name;
    }

    if (mappingHas(ctx && ctx.mapping, "due") || dueEl) {
      out.due =
        dueEl && dueEl.value
          ? (toIsoDate(dueEl.value) || parseDateBr(dueEl.value) || null)
          : (ctx && ctx.seiDue ? toIsoDate(ctx.seiDue) : (page && page.due ? toIsoDate(page.due) : null));
    }

    if (mappingHas(ctx && ctx.mapping, "processType")) {
      out.processType = pickLive(
        ctx && ctx.seiProcessType,
        (page && page.processType) || ""
      ) || (page && page.processType) || "";
    }

    if (mappingHas(ctx && ctx.mapping, "assignee")) {
      out.assignee = pickLive(
        ctx && ctx.seiAssignee,
        (page && page.assignee) || ""
      )
        .replace(/^[\s:.\-–—]+/, "")
        .replace(/^(?:para|a)\s+/i, "")
        .trim();
    }

    if (mappingHas(ctx && ctx.mapping, "labels")) {
      if (Array.isArray(ctx && ctx.seiLabels) && ctx.seiLabels.length) {
        out.labels = ctx.seiLabels.slice();
      } else if (labelsRoot) {
        const chips = [...shadow.querySelectorAll("#sn-labels .sn-chip.on")].map(
          (b) => b.getAttribute("data-label") || b.textContent
        );
        if (chips.length) {
          out.labels = chips;
        } else if (page && Array.isArray(page.labels) && page.labels.length) {
          out.labels = page.labels.map((l) => (typeof l === "string" ? l : l.name));
        } else {
          out.labels = [];
        }
      } else if (page && Array.isArray(page.labels)) {
        out.labels = page.labels.map((l) => (typeof l === "string" ? l : l.name));
      }
    }

    if (!mappingHas(ctx && ctx.mapping, "seiUrl")) {
      delete out.seiUrl;
    }

    const extra = { ...((page && page.extra) || {}) };
    shadow.querySelectorAll("[data-extra-type]").forEach((el) => {
      const name = el.getAttribute("data-extra-name");
      const type = el.getAttribute("data-extra-type");
      if (!name) return;
      if (type === "checkbox") extra[name] = !!el.checked;
      else if (type === "multi_select") {
        extra[name] = [...el.querySelectorAll(".sn-chip.on")].map((b) =>
          b.getAttribute("data-label")
        );
      } else if (type === "number") extra[name] = el.value === "" ? null : el.value;
      else if (type === "date") extra[name] = el.value ? (toIsoDate(el.value) || parseDateBr(el.value) || "") : "";
      else extra[name] = el.value !== "" ? el.value : (extra[name] !== undefined ? extra[name] : "");
    });
    out.extra = extra;
    out.extraFields = (ctx && ctx.extraFields) || [];
    return out;
  }

  function readForm() {
    if (!current) return null;
    return readFormFrom(current.shadow, current.ctx);
  }

  function setBusy(busy, label) {
    if (!current) return;
    current.ctx.busy = !!busy;
    if (label) current.ctx.busyLabel = label;
    const freeze = !!busy || !!current.ctx.locked;
    current.shadow
      .querySelectorAll(
        "input, textarea, select, button.sn-btn-primary, button.sn-kanban-card-del, #sn-new-act-btn, .sn-btn-card-add-todo, #sn-act-tpl-btn"
      )
      .forEach((el) => {
        if (el.id === "sn-sei-info" || el.id === "sn-other-info") return;
        if (el.id === "sn-retry") {
          el.disabled = !!busy;
          return;
        }
        el.disabled = freeze;
      });
    const save = current.shadow.getElementById("sn-save");
    const create = current.shadow.getElementById("sn-create");
    if (save) save.textContent = busy ? "Salvando…" : "Salvar alterações";
    if (create) create.textContent = busy ? "Criando…" : "Criar página no Notion";
    const overlay = current.shadow.getElementById("sn-loading");
    const text = current.shadow.getElementById("sn-loading-text");
    if (overlay) overlay.hidden = !busy;
    if (text) {
      text.textContent =
        label || current.ctx.busyLabel || "Carregando dados do Notion…";
    }
  }

  function update(partial, opts) {
    if (!current) return;
    const uiState = saveUiState(current.shadow);
    const prevHadPage = !!(current.ctx && current.ctx.page);
    const nextHasPage = !!(partial && ("page" in partial ? partial.page : current.ctx.page));
    const shouldPreserve = opts && opts.preserveForm && (!nextHasPage || prevHadPage);
    const draft =
      shouldPreserve ? readFormFrom(current.shadow, current.ctx) : null;
    const ctx = { ...current.ctx, ...partial };
    if (draft) {
      ctx.draft = draft;
      if (Array.isArray(draft.checklist) && draft.checklist.length) {
        ctx.checklist = draft.checklist;
      }
      if (draft.templateId) ctx.selectedTemplateId = draft.templateId;
    } else delete ctx.draft;
    current.ctx = { ...ctx, uiMode };
    current.wrap.innerHTML = render(current.ctx);
    bind(current.shadow, current.ctx);
    restoreUiState(current.shadow, uiState);
    if (isPanelMode() && current.host) {
      layoutHost(current.host, current.doc);
    }
  }

  function processNumber() {
    return current && current.ctx ? current.ctx.processNumber : null;
  }

  function hasLiveHost() {
    const bag = getBag();
    return !!(bag && bag.host && bag.host.isConnected);
  }

  window.addEventListener("pagehide", () => {
    stopPanelWatch();
    if (current && current.onWinResize && current.win) {
      current.win.removeEventListener("resize", current.onWinResize);
      current.onWinResize = null;
    }
  });

  root.SeiNotionPopup = {
    open,
    close,
    update,
    isOpen,
    processNumber,
    readForm,
    setBusy,
    hasLiveHost,
    reveal,
    setCollapsed,
    isPanel: isPanelMode
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
