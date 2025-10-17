export interface AuthenticatedUser {
  id: number;
  email: string;
  role: 'ADMIN' | 'CLIENT';
}
