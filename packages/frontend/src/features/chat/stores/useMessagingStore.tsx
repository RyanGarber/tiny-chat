import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { BaseEditor, Editor, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import { HistoryEditor } from 'slate-history';
import { deserialize } from '@/features/slate/serializer';
import { type MessageState, type zData, type zDataPart } from '@tiny-chat/shared/src/types/chat.ts';
import { texts } from '@tiny-chat/shared/src/utils.ts';
import { useConfigStore } from '@/features/input/stores/useConfigStore';

type CustomEditor = BaseEditor & ReactEditor & HistoryEditor;

export type Upload = Extract<zDataPart, { type: 'upload' }>;

interface MessagingStore {
  editor: CustomEditor | null;
  setEditor: (editor: CustomEditor) => void;
  clearText: () => void;
  setData: (data: zData) => void;

  uploads: Upload[];
  addUploads: (...uploads: Upload[]) => void;
  removeUpload: (index: number) => void;

  addQuote: (message: MessageState, content: string) => void;

  editing: MessageState | null;
  setEditing: (editing: MessageState | null) => void;

  truncating: boolean;
  setTruncating: (truncating: boolean) => void;

  insertingAfter: MessageState | null;
  setInsertingAfter: (insertingAfter: MessageState | null) => void;

  reset: () => void;
}

export const useMessagingStore = create(
  subscribeWithSelector<MessagingStore>((set, get) => ({
    editor: null,
    setEditor: (editor) => {
      set({ editor });
    },

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

    setData: (data) => {
      const { editor, clearText } = get();
      if (!editor) return;

      clearText();
      Transforms.insertNodes(editor, deserialize(texts(data, '\n')));
      Transforms.removeNodes(editor, { at: [0] });

      set({ uploads: data.flat().filter((p) => p.type === 'upload') });
    },

    uploads: [],
    addUploads: (...attachments) => set({ uploads: [...get().uploads, ...attachments] }),
    removeUpload: (index) =>
      set({
        uploads: get().uploads.filter((_, i) => i !== index),
      }),

    addQuote: (message, content) => {
      const { editor } = get();
      if (!editor) return;

      const quote = {
        type: 'quote',
        model: message.config.model ?? '',
        children: [{ text: content }],
      };
      const insertAt = editor.selection?.anchor?.path[0] ?? 0;
      editor.insertNode(quote, { at: [insertAt] });
    },

    editing: null,
    setEditing: (value) => {
      const { setInsertingAfter, editor, setData } = get();
      if (!editor) return;

      if (value) setInsertingAfter(null);

      set({ editing: value, truncating: value !== null });
      void setData(value?.data ?? []);

      const { setOverrideConfig } = useConfigStore.getState();
      if (value) setOverrideConfig(value.config);
      else setOverrideConfig(null);
    },

    truncating: false,
    setTruncating: (truncating) => {
      set({ truncating });
    },

    insertingAfter: null,
    setInsertingAfter: (value) => {
      const { editing, setEditing } = get();
      if (value && editing) setEditing(null);
      set({ uploads: [], insertingAfter: value });
    },

    reset: () => {
      console.log('Resetting messaging state');
      const { setEditing, setInsertingAfter, setData } = get();
      set({ uploads: [] });
      setEditing(null);
      setInsertingAfter(null);
      void setData([]);
    },
  })),
);
