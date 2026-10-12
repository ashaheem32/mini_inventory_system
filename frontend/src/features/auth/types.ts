export interface User {
  id: number;
  username: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
