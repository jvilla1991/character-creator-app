import { PC } from "./pc";

export interface User {
  uuid: string;
  name: string;
  password: string;
  email: string;
  pcs: PC[];
}
