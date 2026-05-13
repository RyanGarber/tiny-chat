import { useChatStore } from '@/features/chat/stores/useChatStore';
import { auth } from '@/utils/api';
import { useMemo } from 'react';

export function useGreeting() {
  const session = auth.useSession();
  const createIncognito = useChatStore((s) => s.createIncognito);

  const name =
    session.data && !session.data.user.isAnonymous && !createIncognito
      ? session.data.user.name.split(' ')[0]
      : undefined;

  const time = getTime();

  return useMemo(() => {
    const greetings: string[] = [];

    const add = (withName: string, withoutName: string) => {
      if (name) greetings.push(withName.replace('@', name));
      else greetings.push(withoutName);
    };

    if (time === 'morning' || time === 'afternoon') {
      add('@ returns', 'Hi there');
      add("Let's get to it, @", "Let's get to it");
      add("What's the plan, @", "What's the plan?");
    } else if (time === 'evening') {
      add("@'s still at it", 'Still at it');
      add('@ working late?', 'Working late?');
      add("What's next for @?", "What's next?");
    } else if (time === 'overnight') {
      add('@ the night owl', 'Hi night owl');
      add('No sleep for @', 'No sleep for you');
      add('@ gets it done', 'You get it done');
    }

    return greetings[new Date().getTime() % greetings.length].replace('@', name ?? '');
  }, [name, time]);
}

function getTime(): 'morning' | 'afternoon' | 'evening' | 'overnight' {
  const time = new Date().getHours();
  if (time >= 6 && time < 12) return 'morning';
  if (time >= 12 && time < 18) return 'afternoon';
  if (time >= 18 && time < 22) return 'evening';
  return 'overnight';
}
