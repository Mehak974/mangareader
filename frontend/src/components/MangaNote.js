"use client";

import React, { useState, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import sanitizeHtml from "sanitize-html";

export default function MangaNote({ mangaId }) {
  const { isLoggedIn, user, setSigninSheetOpen } = useApp();
  const [note, setNote] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const editorRef = useRef(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setIsLoading(false);
      return;
    }

    const fetchNote = async () => {
      try {
        const res = await fetch(`/api/notes/${mangaId}`);
        if (res.ok) {
          const data = await res.json();
          setNote(data.data?.content || "");
        }
      } catch (err) {
        console.error("Failed to fetch note:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNote();
  }, [mangaId, isLoggedIn]);

  const handleSave = async () => {
    if (!editorRef.current) return;
    setIsSaving(true);
    
    let content = editorRef.current.innerHTML;
    
    content = sanitizeHtml(content, {
      allowedTags: ['b', 'i', 'em', 'strong', 'u', 'span', 'p', 'br', 'div', 'font'],
      allowedAttributes: {
        'span': ['style'],
        'font': ['color', 'size', 'face']
      },
      allowedStyles: {
        '*': {
          'color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/]
        }
      }
    });

    try {
      const res = await fetch(`/api/notes/${mangaId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const data = await res.json();
        setNote(data.data?.content || "");
        setIsEditing(false);
      }
    } catch (err) {
      console.error("Failed to save note:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/notes/${mangaId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setNote("");
        setIsEditing(false);
      }
    } catch (err) {
      console.error("Failed to delete note:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    if (editorRef.current) editorRef.current.focus();
  };

  if (isLoading) {
    return (
      <div className="mn-loading"></div>
    );
  }

  return (
    <>
      <style>{`
        .mn-container {
          width: 100%;
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: var(--rl);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .mn-guest {
          padding: 20px;
          background: var(--bg2);
          border: 1px solid var(--accent-border);
          border-radius: var(--rl);
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
        }
        .mn-guest-glow {
          position: absolute;
          top: -40px;
          right: -40px;
          width: 120px;
          height: 120px;
          background: var(--accent);
          filter: blur(50px);
          opacity: 0.15;
          border-radius: 50%;
          pointer-events: none;
        }
        .mn-guest h3 {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
        }
        .mn-guest p {
          font-size: 13px;
          color: var(--text2);
          line-height: 1.5;
          margin: 0;
        }
        .mn-header-view {
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .mn-header-view h3 {
          font-size: 13px;
          font-weight: 700;
          color: var(--text2);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 0;
        }
        .mn-btn-icon {
          background: transparent;
          border: none;
          color: var(--text3);
          padding: 6px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .mn-btn-icon:hover {
          background: var(--surface2);
          color: var(--text);
        }
        .mn-view-content {
          padding: 0 16px 16px;
          font-size: 14px;
          color: var(--text);
          line-height: 1.6;
        }
        .mn-toolbar {
          background: var(--bg3);
          border-bottom: 1px solid var(--border);
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 4px;
          overflow-x: auto;
        }
        .mn-divider {
          width: 1px;
          height: 16px;
          background: var(--border2);
          margin: 0 4px;
        }
        .mn-color-btn {
          width: 24px;
          height: 24px;
          border-radius: 4px;
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .mn-color-btn:hover {
          background: var(--surface2);
        }
        .mn-color-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.2);
        }
        .mn-editor {
          width: 100%;
          min-height: 120px;
          max-height: 350px;
          overflow-y: auto;
          padding: 16px;
          font-size: 14px;
          color: var(--text);
          line-height: 1.6;
          outline: none;
        }
        .mn-editor:empty:before {
          content: attr(data-placeholder);
          color: var(--text3);
          pointer-events: none;
          display: block;
        }
        .mn-footer {
          background: var(--bg3);
          border-top: 1px solid var(--border);
          padding: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .mn-btn-cancel {
          background: transparent;
          border: none;
          color: var(--text3);
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          border-radius: var(--rm);
          cursor: pointer;
        }
        .mn-btn-cancel:hover {
          color: var(--text);
        }
        .mn-btn-delete {
          background: transparent;
          border: none;
          color: var(--red);
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          border-radius: var(--rm);
          cursor: pointer;
          opacity: 0.8;
        }
        .mn-btn-delete:hover {
          background: rgba(248, 113, 113, 0.1);
          opacity: 1;
        }
        .mn-loading {
          width: 100%;
          height: 120px;
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: var(--rl);
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
      `}</style>

      {/* GUEST VIEW */}
      {!isLoggedIn && (
        <div className="mn-guest">
          <div className="mn-guest-glow"></div>
          <h3>
            <svg width="18" height="18" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Personal Notes
          </h3>
          <p>
            Ever dropped a series and forgot why? Keep private notes for any manga, visible only to you!
          </p>
          <button onClick={() => setSigninSheetOpen(true)} className="btn btn-p" style={{ fontSize: '13px', padding: '6px 12px', marginTop: '4px' }}>
            Log in to add note
          </button>
        </div>
      )}

      {/* LOGGED IN - VIEW MODE */}
      {isLoggedIn && !isEditing && note && (
        <div className="mn-container">
          <div className="mn-header-view">
            <h3>
              <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              My Note
            </h3>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="mn-btn-icon" onClick={() => setIsEditing(true)} title="Edit Note">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>
              <button className="mn-btn-icon" onClick={handleDelete} disabled={isSaving} title="Delete Note">
                <svg width="14" height="14" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
          <div 
            className="mn-view-content"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(note) }}
          />
        </div>
      )}

      {/* LOGGED IN - EDIT MODE OR EMPTY NOTE */}
      {isLoggedIn && (isEditing || !note) && (
        <div className="mn-container" style={{ borderColor: 'var(--accent-border)', boxShadow: '0 4px 20px rgba(168, 85, 247, 0.05)' }}>
          <div className="mn-toolbar">
            <button onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }} className="mn-btn-icon" title="Bold">
              <strong style={{ fontFamily: 'serif', fontSize: '16px' }}>B</strong>
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }} className="mn-btn-icon" title="Italic">
              <em style={{ fontFamily: 'serif', fontSize: '16px' }}>I</em>
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); execCommand('underline'); }} className="mn-btn-icon" title="Underline">
              <u style={{ fontFamily: 'serif', fontSize: '16px' }}>U</u>
            </button>
            
            <div className="mn-divider"></div>
            
            {["#ffffff", "#f87171", "#ffc94d", "#4ade80", "#60a5fa", "#c084fc"].map(color => (
              <button 
                key={color}
                onMouseDown={(e) => { e.preventDefault(); execCommand('foreColor', color); }} 
                className="mn-color-btn"
                title="Text Color"
              >
                <div className="mn-color-dot" style={{ backgroundColor: color }}></div>
              </button>
            ))}
          </div>
          
          <div 
            ref={editorRef}
            contentEditable
            className="mn-editor"
            data-placeholder="Write your note here... (e.g. Dropped at ch 45 because...)"
            dangerouslySetInnerHTML={{ __html: note || "" }}
            onInput={(e) => {
              if (e.currentTarget.textContent.trim() === "") e.currentTarget.innerHTML = "";
            }}
          />
          
          <div className="mn-footer">
            {note ? (
              <button onClick={handleDelete} disabled={isSaving} className="mn-btn-delete">
                Delete
              </button>
            ) : <div />}
            
            <div style={{ display: 'flex', gap: '8px' }}>
              {isEditing && (
                <button onClick={() => setIsEditing(false)} disabled={isSaving} className="mn-btn-cancel">
                  Cancel
                </button>
              )}
              <button onClick={handleSave} disabled={isSaving} className="btn btn-p" style={{ fontSize: '12px', padding: '6px 16px' }}>
                {isSaving ? "Saving..." : "Save Note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
