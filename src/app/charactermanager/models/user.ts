import { Pc } from "./pc";

export class User {
  uuid!: string;
  name!: string;
  password?: string;
  email!: string;
  pcs: Pc[] = [];
}
