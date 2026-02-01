/**
 * ZERO Trade Notes Manager
 * CRUD operations for timestamped trade notes in Shadow Mode.
 * Notes are stored in Store.state.shadow.notes[].
 */

import { Store } from "../store.js";
import { Market } from "./market.js";

const MAX_NOTES = 50;
const MAX_NOTE_LENGTH = 280;

export const TradeNotes = {
  /**
   * Add a new note for the current session and token.
   */
  async addNote(text) {
    if (!Store.state?.shadow) return null;
    if (!text || !text.trim()) return null;

    const trimmed = text.trim().slice(0, MAX_NOTE_LENGTH);
    const note = {
      id: `note_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      ts: Date.now(),
      text: trimmed,
      mint: Market.currentMint || null,
      symbol: Market.currentSymbol || null,
      sessionId: Store.state.session?.id || null,
      edited: false,
      editedTs: null,
    };

    const notes = Store.state.shadow.notes || [];
    notes.push(note);

    // Evict oldest if over limit
    while (notes.length > MAX_NOTES) {
      notes.shift();
    }

    Store.state.shadow.notes = notes;
    await Store.save();
    return note;
  },

  /**
   * Edit an existing note by ID.
   */
  async editNote(noteId, text) {
    if (!Store.state?.shadow) return false;
    if (!text || !text.trim()) return false;

    const notes = Store.state.shadow.notes || [];
    const note = notes.find((n) => n.id === noteId);
    if (!note) return false;

    note.text = text.trim().slice(0, MAX_NOTE_LENGTH);
    note.edited = true;
    note.editedTs = Date.now();

    await Store.save();
    return true;
  },

  /**
   * Delete a note by ID.
   */
  async deleteNote(noteId) {
    if (!Store.state?.shadow) return false;

    const notes = Store.state.shadow.notes || [];
    const idx = notes.findIndex((n) => n.id === noteId);
    if (idx === -1) return false;

    notes.splice(idx, 1);
    await Store.save();
    return true;
  },

  /**
   * Get notes for the current session.
   */
  getSessionNotes() {
    if (!Store.state?.shadow) return [];
    const sessionId = Store.state.session?.id;
    if (!sessionId) return [];

    return (Store.state.shadow.notes || [])
      .filter((n) => n.sessionId === sessionId)
      .sort((a, b) => b.ts - a.ts);
  },

  /**
   * Get notes tagged with a specific token mint.
   */
  getNotesForMint(mint) {
    if (!Store.state?.shadow || !mint) return [];

    return (Store.state.shadow.notes || [])
      .filter((n) => n.mint === mint)
      .sort((a, b) => b.ts - a.ts);
  },
};
