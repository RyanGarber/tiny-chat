import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { BaseEditor, Editor, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import { HistoryEditor } from 'slate-history';
import { deserialize } from '@/slate/serializer.tsx';
import { extractText } from '@/utils/text';
import { type zConfig, type zData } from '@tiny-chat/core-backend/src/types.ts';
import { type MessageOmitted } from '@tiny-chat/core-backend/src/types.ts';
import { reloadConfig } from '@/managers/configuration';

type CustomEditor = BaseEditor & ReactEditor & HistoryEditor;

interface Messaging {
  editor: CustomEditor | null;
  setEditor: (editor: CustomEditor) => void;
  clearText: () => void;
  setData: (data: zData) => Promise<void>;
  cursorPosition: number | null;

  files: File[];
  addFiles: (...files: File[]) => void;
  removeFile: (file: File) => void;
  addQuote: (message: MessageOmitted, content: string) => void;

  editing: MessageOmitted | null;
  setEditing: (editing: MessageOmitted | null) => void;

  truncating: boolean;
  setTruncating: (truncating: boolean) => void;

  insertingAfter: MessageOmitted | null;
  setInsertingAfter: (insertingAfter: MessageOmitted | null) => void;

  reset: () => void;

  config: zConfig | null;
  setConfig: (value: zConfig) => void;

  scrollRequested: number;
  requestScrollToBottom: () => void;
}

export const useMessaging = create(
  subscribeWithSelector<Messaging>((set, get) => ({
    editor: null,
    setEditor: (editor) => {
      set({ editor });
    },

    cursorPosition: null,

    clearText: () => {
      const { editor } = get();
      if (!editor) return;
      Transforms.select(editor, {
        anchor: Editor.start(editor, []),
        focus: Editor.end(editor, []),
      });
      Transforms.delete(editor);
      Transforms.setNodes(editor, { type: 'paragraph' });
    },

    setData: async (data: zData) => {
      const { editor, clearText } = get();
      if (!editor) return;

      clearText();
      Transforms.insertNodes(editor, deserialize(extractText(data)));
      Transforms.removeNodes(editor, { at: [0] });

      const files: File[] = [];
      for (const file of data.filter((p) => p.type === 'file')) {
        files.push(
          new File([await (await fetch(file.url)).blob()], file.name!, { type: file.mime }),
        );
      }
      set({ files });
    },

    files: [],
    addFiles: (...files) => {
      set({ files: [...get().files, ...files] });
    },
    removeFile: (file) => {
      set({ files: get().files.filter((f) => f !== file) });
    },
    addQuote: (message, content) => {
      const { editor, cursorPosition } = get();
      if (!editor) return;

      const quote = {
        type: 'quote',
        model: message.config.model ?? '',
        children: [{ text: content }],
      };
      const insertAt = cursorPosition ?? 0;
      editor.insertNode(quote, { at: [insertAt] });
    },

    editing: null,
    setEditing: (value) => {
      const { setConfig, setInsertingAfter, editor, setData } = get();
      if (!editor) return;

      if (value) setInsertingAfter(null);

      set({ editing: value, truncating: value !== null });
      void setData(value?.data ?? []);

      if (value) setConfig(value.config);
      else reloadConfig();
    },

    truncating: false,
    setTruncating: (truncating) => {
      set({ truncating });
    },

    insertingAfter: null,
    setInsertingAfter: (value) => {
      const { editing, setEditing } = get();
      if (value && editing) setEditing(null);
      set({ files: [], insertingAfter: value });
    },

    reset: () => {
      console.trace('Resetting messaging state');
      const { setEditing, setInsertingAfter, setData } = get();
      set({ files: [] });
      setEditing(null);
      setInsertingAfter(null);
      void setData([]);
    },

    scrollRequested: 0,
    requestScrollToBottom: () => set({ scrollRequested: get().scrollRequested + 1 }),

    config: null,
    setConfig: (value) => {
      set({ config: value });
    },
  })),
);
