import { useMessaging } from '@/stores/messaging.tsx';
import { useChats } from '@/stores/chats.tsx';
import { useProviders } from '@/stores/providers.tsx';
import { zConfig } from '@tiny-chat/core-backend/src/types.ts';
import { readLocalStorageValue } from '@mantine/hooks';

export function reloadConfig() {
  const { setConfig } = useMessaging.getState();
  const { messages } = useChats.getState();
  const sorted = [...messages].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (sorted.length) {
    console.log("Found messages in chat; loading last message's config:", sorted[0].config);
    setConfig(sorted[0].config);
    return;
  }
  console.log('No messages in chat; trying fallback configs');
  let lastConfigString = readLocalStorageValue<string>({ key: 'config', sync: true });
  try {
    if (typeof lastConfigString !== 'string') {
      lastConfigString = JSON.stringify(lastConfigString);
    }
  } catch {
    // I have zero fucking clue how the config value became an object
    // ESLint literally says it CANNOT be a string
    // It has NEVER been a string
    // But here we are, with it becoming a string after I call "setItem(lastConfigString)"
    // Fuck JavaScript. Fuck TypeScript. Fuck ESLint. Fuck you all
  }
  if (lastConfigString?.includes('"service"')) {
    lastConfigString = lastConfigString.replace('"service"', '"provider"');
    localStorage.setItem('config', lastConfigString);
    console.log('Migrated old config format to new format');
  }
  const lastConfig = lastConfigString ? zConfig.parse(JSON.parse(lastConfigString)) : null;
  const fallbackProvider = useProviders.getState().chatProviders.find((s) => s.models.length > 0);
  try {
    setConfig(
      lastConfig ?? {
        provider: fallbackProvider!.name,
        model: fallbackProvider!.models[0].name,
      },
    );
    console.log(
      'Loaded config:',
      lastConfig,
      '(last config:',
      lastConfig,
      ', fallback provider:',
      fallbackProvider,
      ')',
    );
  } catch {
    console.warn('Failed to load config or fall back to default provider');
  }
}
