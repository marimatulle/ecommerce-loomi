import { Request } from 'express';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
