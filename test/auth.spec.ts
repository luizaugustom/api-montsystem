import { describe, it, expect } from 'vitest';
import { AuthService } from '../src/modules/auth/auth.service';

describe('AuthService', () => {
  it('should return token for correct credentials', () => {
    const svc = new AuthService();
    const res = svc.login('luiz', '832010pj');
    expect(res).toHaveProperty('token');
  });
});
