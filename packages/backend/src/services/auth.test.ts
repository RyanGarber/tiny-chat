import { describe, expect, inject, it } from 'vitest';

describe('services - auth', () => {
  it('checks for ephemeral flag on user', async () => {
    const user = inject('backend_user');
    expect(user.isEphemeral).toBe(true);
  });
});
