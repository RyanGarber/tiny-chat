import { describe, expect, it } from 'vitest';
import {
  fromChatUri,
  mimeExtension,
  mimeType,
  pathIsChildOf,
  pathStartsWith,
  toChatUri,
} from './files.ts';

describe('utils - files', () => {
  it('detects common mime types from extensions', async () => {
    expect(await mimeType('', '~/.zshrc')).toEqual('text/x-shellscript');
    expect(await mimeType('', 'src/index.ts')).toEqual('text/typescript');
    expect(await mimeType('', 'App.tsx')).toEqual('text/typescript');
  });

  it('chooses common extensions from mime types', async () => {
    expect(mimeExtension('text/x-shellscript')).toEqual('bash');
    expect(mimeExtension('text/typescript')).toEqual('ts');
    expect(mimeExtension('image/jpeg')).toEqual('jpg');
  });

  it('builds chat uris', () => {
    expect(toChatUri(undefined, ['file.txt'])).toEqual('chat:///file.txt');
    expect(toChatUri('id')).toEqual('chat:///id');
    expect(toChatUri('id', [''])).toEqual('chat:///id');
    expect(toChatUri('id', ['src', '', 'index.ts', ''])).toEqual('chat:///id/src/index.ts');
  });

  it('parses chat uris', () => {
    expect(fromChatUri('/file.txt')).toBeNull();
    expect(fromChatUri('chat://')).toEqual({
      uploadId: undefined,
      path: [],
    });
    expect(fromChatUri('chat://file')).toEqual({
      uploadId: undefined,
      path: ['file'],
    });
    expect(fromChatUri('chat:///zzzzzzzzzzzzzzzzzzzzzzzz')).toEqual({
      uploadId: 'zzzzzzzzzzzzzzzzzzzzzzzz',
      path: [],
    });
    expect(fromChatUri('chat:///zzzzzzzzzzzzzzzzzzzzzzzz/src/index.ts')).toEqual({
      uploadId: 'zzzzzzzzzzzzzzzzzzzzzzzz',
      path: ['src', 'index.ts'],
    });
  });

  it('checks if a path starts with another path', () => {
    expect(pathStartsWith(['src', 'index.ts'], ['', 'src'])).toBe(true);
    expect(pathStartsWith(['', 'src', '', 'index.ts'], ['src', 'index.ts'])).toBe(true);
    expect(pathStartsWith(['src', 'index.ts'], ['src', 'index'])).toBe(false);
    expect(pathStartsWith(['src', 'index.ts'], ['lib'])).toBe(false);
  });

  it('checks if a path is a child of another path', () => {
    expect(pathIsChildOf(['src', 'index.ts'], [''])).toBe(false);
    expect(pathIsChildOf(['src', 'index.ts'], ['', 'src', ''])).toBe(true);
    expect(pathIsChildOf(['src', 'index.ts'], ['', 'src', 'gen'])).toBe(false);
    expect(pathIsChildOf(['README.md'])).toBe(true);
    expect(pathIsChildOf(['src', 'index.ts'])).toBe(false);
  });
});
