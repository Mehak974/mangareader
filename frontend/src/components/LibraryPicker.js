"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useApp } from "@/context/AppContext";

export default function LibraryPicker() {
  const {
    libraryPickerOpen,
    setLibraryPickerOpen,
    libraryPickerManga,
    libraries,
    addToLibrary,
    removeFromLibrary,
    createLibrary,
  } = useApp();

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  if (!libraryPickerOpen || !libraryPickerManga) return null;

  const mangaId = String(libraryPickerManga.id);

  const isInLibrary = (lib) =>
    lib.manga?.some((m) => String(m.mangaId) === mangaId);

  const handleToggle = async (lib) => {
    if (isInLibrary(lib)) {
      await removeFromLibrary(lib.id, mangaId);
    } else {
      await addToLibrary(lib.id, libraryPickerManga);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    await createLibrary(name);
    setNewName("");
    setShowCreate(false);
    setCreating(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleCreate();
    if (e.key === "Escape") {
      setShowCreate(false);
      setNewName("");
    }
  };

  const close = () => {
    setLibraryPickerOpen(false);
    setShowCreate(false);
    setNewName("");
  };

  return (
    <>
      <div className="lib-picker-backdrop" onClick={close} />
      <div
        className="lib-picker"
        role="dialog"
        aria-modal="true"
        aria-label="Choose libraries"
        onKeyDown={(e) => e.key === "Escape" && close()}
      >
        {/* Header */}
        <div className="lib-picker-header">
          <div className="lib-picker-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 3h12v18l-6-4-6 4V3z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            Add to Library
          </div>
          <button className="lib-picker-close" onClick={close} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Manga being added */}
        <div className="lib-picker-manga">
          {libraryPickerManga.cover && (
            <div
              className="lib-picker-manga-cover"
              style={{ position: "relative", overflow: "hidden" }}
            >
              <Image
                src={libraryPickerManga.cover}
                alt={`Cover for ${libraryPickerManga.t || libraryPickerManga.title || "Unknown"}`}
                fill
                sizes="60px"
                style={{ objectFit: "cover" }}
              />
            </div>
          )}
          <div className="lib-picker-manga-info">
            <div className="lib-picker-manga-title">
              {libraryPickerManga.t || libraryPickerManga.title || "Unknown"}
            </div>
            <div className="lib-picker-manga-genre">
              {libraryPickerManga.g || libraryPickerManga.genre || ""}
            </div>
          </div>
        </div>

        {/* Library list */}
        <div className="lib-picker-list">
          {libraries.map((lib) => {
            const checked = isInLibrary(lib);
            return (
              <button
                key={lib.id}
                className={`lib-picker-item ${checked ? "checked" : ""}`}
                onClick={() => handleToggle(lib)}
              >
                <span className="lib-picker-checkbox">
                  {checked ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="18" height="18" rx="4" fill="var(--accent)" />
                      <path d="M7 12.5l3 3 7-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="18" height="18" rx="4" stroke="var(--text3)" strokeWidth="1.5" />
                    </svg>
                  )}
                </span>
                <span className="lib-picker-item-name">
                  {lib.name === "default" ? "Default Library" : lib.name}
                </span>
                <span className="lib-picker-item-count">
                  {lib.manga?.length || 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Create new library */}
        {showCreate ? (
          <div className="lib-picker-create">
            <input
              type="text"
              className="lib-picker-create-input"
              placeholder="Library name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={100}
              autoFocus
              disabled={creating}
            />
            <button
              className="lib-picker-create-btn"
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
            >
              {creating ? "..." : "Add"}
            </button>
            <button
              className="lib-picker-create-cancel"
              onClick={() => { setShowCreate(false); setNewName(""); }}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            className="lib-picker-new"
            onClick={() => setShowCreate(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Create New Library
          </button>
        )}

        {/* Done */}
        <button className="lib-picker-done" onClick={close}>
          Done
        </button>
      </div>
    </>
  );
}
